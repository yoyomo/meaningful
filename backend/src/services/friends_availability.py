from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from zoneinfo import ZoneInfo

from models.availability import Availability, TimeSlot
from services.database import DynamoDBService
from services.friends import FriendsService
from services.google_calendar import GoogleCalendarService


@dataclass
class AvailabilityEvaluation:
    friend: Dict[str, Any]
    status: str  # 'available', 'busy', 'unknown'
    reason: Optional[str] = None
    available_until: Optional[datetime] = None
    next_available_at: Optional[datetime] = None
    busy_until: Optional[datetime] = None
    timezone: Optional[str] = None
    confidence: str = "low"
    details: Optional[str] = None


class FriendsAvailabilityService:
    def __init__(self) -> None:
        self.friends_service = FriendsService()
        self.dynamodb_service = DynamoDBService()
        self.google_calendar_service = GoogleCalendarService()

    def compute_available_now(self, user_id: str) -> Dict[str, List[Dict[str, Any]]]:
        now_utc = datetime.now(timezone.utc)
        friends = self.friends_service.list_friends(user_id)

        results: List[AvailabilityEvaluation] = []
        for friend in friends:
            evaluation = self._evaluate_friend(friend, now_utc)
            results.append(evaluation)

        available = []
        busy = []
        unknown = []

        for evaluation in results:
            payload = self._serialize_evaluation(evaluation)
            if evaluation.status == "available":
                available.append(payload)
            elif evaluation.status == "busy":
                busy.append(payload)
            else:
                unknown.append(payload)

        return {
            "available": available,
            "busy": busy,
            "unknown": unknown,
            "generatedAt": now_utc.isoformat().replace("+00:00", "Z"),
        }

    def _evaluate_friend(self, friend: Dict[str, Any], now_utc: datetime) -> AvailabilityEvaluation:
        friend_type = friend.get("friend_type")
        friend_id = friend.get("friend_id")
        display_name = friend.get("display_name", "Friend")

        evaluation = AvailabilityEvaluation(
            friend={
                "friendId": friend_id,
                "displayName": display_name,
                "friendType": friend_type,
                "referenceId": friend.get("reference_id"),
                "linkedUserId": friend.get("linked_user_id"),
            },
            status="unknown",
        )

        linked_user_id = friend.get("linked_user_id")
        if friend_type != "app_user" or not linked_user_id:
            evaluation.reason = "no_linked_meaningful_account"
            evaluation.details = "This friend is a contact without a Meaningful account connection."
            return evaluation

        user_record = self.dynamodb_service.get_user(linked_user_id)
        if not user_record:
            evaluation.reason = "user_not_found"
            evaluation.details = "Meaningful user record could not be located."
            return evaluation

        availability_record = user_record.get("availability")
        if not isinstance(availability_record, Dict):
            evaluation.reason = "no_availability"
            evaluation.details = "Friend has not configured weekly availability."
            return evaluation

        availability = Availability.from_record(availability_record)
        timezone_name = availability.timezone or "UTC"
        try:
            tz = ZoneInfo(timezone_name)
        except Exception:
            tz = ZoneInfo("UTC")
            timezone_name = "UTC"

        now_local = now_utc.astimezone(tz)
        current_slot = self._find_current_slot(availability, now_local)
        if current_slot is None:
            evaluation.status = "busy"
            evaluation.reason = "outside_availability"
            evaluation.timezone = timezone_name
            next_slot = self._find_next_slot(availability, now_local, tz)
            evaluation.next_available_at = next_slot
            evaluation.details = "Friend has no availability scheduled for the current time."
            return evaluation

        start_local, end_local = current_slot
        evaluation.timezone = timezone_name

        tokens = user_record.get("google_tokens")
        if not isinstance(tokens, Dict):
            evaluation.status = "unknown"
            evaluation.reason = "google_calendar_disconnected"
            evaluation.details = "Friend has not connected Google Calendar."
            evaluation.available_until = end_local
            evaluation.confidence = "low"
            return evaluation

        time_min = now_utc - timedelta(minutes=1)
        time_max = min(end_local.astimezone(timezone.utc), now_utc + timedelta(hours=4))

        try:
            busy_periods, refreshed_tokens = self.google_calendar_service.get_busy_periods(
                tokens,
                time_min,
                time_max,
                timezone_name,
            )
        except Exception as exc:
            evaluation.status = "unknown"
            evaluation.reason = "calendar_check_failed"
            evaluation.details = f"Failed to verify calendar availability: {exc}"
            evaluation.available_until = end_local
            evaluation.confidence = "low"
            return evaluation

        if refreshed_tokens:
            # Persist refreshed tokens best-effort
            self.dynamodb_service.update_user(linked_user_id, {"google_tokens": refreshed_tokens})

        if busy_periods:
            evaluation.status = "busy"
            evaluation.reason = "calendar_busy"
            busy_end = self._parse_calendar_datetime(busy_periods[0].get("end"))
            evaluation.busy_until = busy_end
            next_slot = self._find_next_slot(availability, now_local, tz, earliest_after=busy_end)
            evaluation.next_available_at = next_slot
            evaluation.details = "Google Calendar indicates a busy event right now."
            evaluation.confidence = "high"
            return evaluation

        evaluation.status = "available"
        evaluation.available_until = end_local
        evaluation.confidence = "high"
        evaluation.details = "Within saved availability and no calendar conflicts detected."
        return evaluation

    @staticmethod
    def _find_current_slot(availability: Availability, now_local: datetime) -> Optional[Tuple[datetime, datetime]]:
        day_key = now_local.strftime("%A").lower()
        slots = availability.weekly.get(day_key, [])
        for slot in slots:
            start, end = FriendsAvailabilityService._slot_range(now_local, slot)
            if start <= now_local < end:
                return start, end
        return None

    @staticmethod
    def _find_next_slot(
        availability: Availability,
        now_local: datetime,
        tz: ZoneInfo,
        earliest_after: Optional[datetime] = None,
        search_days: int = 14,
    ) -> Optional[datetime]:
        comparison_start = earliest_after.astimezone(tz) if earliest_after else now_local
        for offset in range(search_days + 1):
            candidate_day = (comparison_start + timedelta(days=offset)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            day_key = candidate_day.strftime("%A").lower()
            slots = availability.weekly.get(day_key, [])
            for slot in slots:
                start, _ = FriendsAvailabilityService._slot_range(candidate_day, slot)
                if start > comparison_start:
                    return start
        return None

    @staticmethod
    def _slot_range(day_reference: datetime, slot: TimeSlot) -> Tuple[datetime, datetime]:
        start_hour, start_minute = map(int, slot.start.split(":"))
        end_hour, end_minute = map(int, slot.end.split(":"))
        start = day_reference.replace(hour=start_hour, minute=start_minute, second=0, microsecond=0)
        end = day_reference.replace(hour=end_hour, minute=end_minute, second=0, microsecond=0)
        if end <= start:
            end += timedelta(days=1)
        return start, end

    @staticmethod
    def _parse_calendar_datetime(value: Optional[str]) -> Optional[datetime]:
        if not value or not isinstance(value, str):
            return None
        normalized = value.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(normalized).astimezone(timezone.utc)
        except ValueError:
            return None

    @staticmethod
    def _serialize_evaluation(evaluation: AvailabilityEvaluation) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "friend": evaluation.friend,
            "status": evaluation.status,
            "confidence": evaluation.confidence,
        }
        if evaluation.reason:
            payload["reason"] = evaluation.reason
        if evaluation.details:
            payload["details"] = evaluation.details
        if evaluation.timezone:
            payload["timezone"] = evaluation.timezone
        if evaluation.available_until:
            payload["availableUntil"] = FriendsAvailabilityService._format_datetime(evaluation.available_until)
        if evaluation.next_available_at:
            payload["nextAvailableAt"] = FriendsAvailabilityService._format_datetime(evaluation.next_available_at)
        if evaluation.busy_until:
            payload["busyUntil"] = FriendsAvailabilityService._format_datetime(evaluation.busy_until)
        return payload

    @staticmethod
    def _format_datetime(value: datetime) -> str:
        return value.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


