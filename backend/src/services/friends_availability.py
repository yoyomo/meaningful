from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

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


@dataclass
class ParticipantMatchReport:
    friend: Dict[str, Any]
    status: str
    timezone: Optional[str] = None
    google_connected: bool = False
    details: Optional[str] = None
    linked_user_id: Optional[str] = None


@dataclass
class ParticipantContext:
    friend: Dict[str, Any]
    linked_user_id: str
    availability: Availability
    timezone: ZoneInfo
    timezone_name: str
    google_tokens: Optional[Dict[str, Any]]


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

    def recommend_meeting_slot(
        self,
        user_id: str,
        friend_ids: List[str],
        *,
        target_days_ahead: int = 14,
        window_days: int = 7,
        duration_minutes: int = 60,
        max_suggestions: int = 3,
    ) -> Dict[str, Any]:
        if not friend_ids:
            raise ValueError("At least one friend is required to compute a match")
        if duration_minutes <= 0:
            raise ValueError("duration_minutes must be positive")
        if target_days_ahead < 0:
            raise ValueError("target_days_ahead must be zero or greater")
        if window_days <= 0:
            raise ValueError("window_days must be positive")

        now_utc = datetime.now(timezone.utc)
        default_start_utc = (now_utc + timedelta(days=target_days_ahead)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        default_end_utc = default_start_utc + timedelta(days=window_days)

        participant_reports: List[ParticipantMatchReport] = []
        participant_contexts: List[ParticipantContext] = []

        owner_report, owner_context = self._resolve_owner_context(user_id)
        participant_reports.append(owner_report)
        if owner_context:
            participant_contexts.append(owner_context)

        for friend_id in friend_ids:
            report, context = self._resolve_participant_context(user_id, friend_id)
            participant_reports.append(report)
            if context:
                participant_contexts.append(context)

        result: Dict[str, Any] = {
            "status": "pending",
            "requestedFriendIds": friend_ids,
            "searchWindow": {
                "targetDaysAhead": target_days_ahead,
                "windowDays": window_days,
                "durationMinutes": duration_minutes,
                "startsAt": self._format_datetime(default_start_utc),
                "endsAt": self._format_datetime(default_end_utc),
            },
            "participants": [
                {
                    "friend": report.friend,
                    "status": report.status,
                    "timezone": report.timezone,
                    "googleConnected": report.google_connected,
                    "details": report.details,
                    "linkedUserId": report.linked_user_id,
                }
                for report in participant_reports
            ],
            "recommendation": None,
            "alternatives": [],
            "notes": [],
        }

        expected_contexts = len(friend_ids) + 1
        if len(participant_contexts) != expected_contexts:
            result["status"] = "needs_setup"
            result["notes"].append(
                "You and your selected friend must both have weekly availability configured in Meaningful."
            )
            return result

        intervals_per_participant: List[List[Tuple[datetime, datetime]]] = []
        google_confidence_flags: List[bool] = []
        window_ranges_utc: List[Tuple[datetime, datetime]] = []
        for context in participant_contexts:
            local_start = (
                now_utc.astimezone(context.timezone)
                + timedelta(days=target_days_ahead)
            ).replace(hour=0, minute=0, second=0, microsecond=0)
            local_end = local_start + timedelta(days=window_days)
            window_ranges_utc.append(
                (
                    local_start.astimezone(timezone.utc),
                    local_end.astimezone(timezone.utc),
                )
            )
            free_slots, used_google = self._compute_free_windows_for_participant(
                context,
                local_start,
                local_end,
            )
            intervals_per_participant.append(free_slots)
            google_confidence_flags.append(used_google)

        if window_ranges_utc:
            start_utc = min(window_ranges_utc, key=lambda pair: pair[0])[0]
            end_utc = max(window_ranges_utc, key=lambda pair: pair[1])[1]
            result["searchWindow"]["startsAt"] = self._format_datetime(start_utc)
            result["searchWindow"]["endsAt"] = self._format_datetime(end_utc)

        # Find overlapping free windows
        overlap_windows = self._intersect_multiple(intervals_per_participant, duration_minutes)
        
        # Extract 30-minute slots from each free window (not the full window)
        overlap_slots = []
        for window_start, window_end in overlap_windows:
            # Create 30-minute slots within this free window
            current_start = window_start
            while current_start + timedelta(minutes=duration_minutes) <= window_end:
                slot_end = current_start + timedelta(minutes=duration_minutes)
                overlap_slots.append((current_start, slot_end))
                # Move to next slot (with 15-minute spacing, or back-to-back)
                current_start = current_start + timedelta(minutes=duration_minutes)
                # Limit to max_suggestions total
                if len(overlap_slots) >= max_suggestions:
                    break
            if len(overlap_slots) >= max_suggestions:
                break
        
        # Take only the requested number of suggestions
        overlap_slots = overlap_slots[:max_suggestions]

        if not overlap_slots:
            result["status"] = "no_overlap"
            result["notes"].append(
                "No overlapping availability was found in the requested window. Try a wider window or ask friends to update their schedules."
            )
            return result

        confidence = self._resolve_confidence(google_confidence_flags)
        result["status"] = "matched"
        result["recommendation"] = {
            "start": self._format_datetime(overlap_slots[0][0]),
            "end": self._format_datetime(overlap_slots[0][1]),
            "confidence": confidence,
        }
        if len(overlap_slots) > 1:
            result["alternatives"] = [
                {
                    "start": self._format_datetime(slot[0]),
                    "end": self._format_datetime(slot[1]),
                }
                for slot in overlap_slots[1:]
            ]
        return result

    def schedule_meeting_slot(
        self,
        user_id: str,
        friend_id: str,
        *,
        start: str,
        end: str,
        title: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            start_dt = datetime.fromisoformat(start.replace("Z", "+00:00"))
            end_dt = datetime.fromisoformat(end.replace("Z", "+00:00"))
        except ValueError:
            raise ValueError("start and end must be ISO8601 timestamps")
        if end_dt <= start_dt:
            raise ValueError("end must be after start")

        owner_record = self.dynamodb_service.get_user(user_id)
        if not owner_record:
            raise ValueError("Unable to load your profile")

        owner_tokens = owner_record.get("google_tokens")
        if owner_tokens is None:
            raise ValueError(
                "Google Calendar is not connected. Please sign out completely, then sign back in with Google. "
                "Make sure to grant all calendar permissions when prompted."
            )
        if not isinstance(owner_tokens, Dict):
            token_type = type(owner_tokens).__name__
            raise ValueError(
                f"Google Calendar tokens are in an unexpected format (got {token_type}, expected dict). "
                "Please sign out completely, then sign back in with Google to reconnect your calendar."
            )
        
        # Verify we have the required token fields
        refresh_token = owner_tokens.get("refresh_token")
        if not refresh_token:
            # Log for debugging
            import logging
            logging.error(f"User {user_id} missing refresh_token. Token keys: {list(owner_tokens.keys())}")
            raise ValueError(
                "Google Calendar connection is incomplete (missing refresh token). "
                "Please sign out completely, then sign back in with Google and grant all permissions. "
                "You may need to revoke access at https://myaccount.google.com/permissions first."
            )

        friend = self.friends_service.get_friend(user_id, friend_id)
        if not friend:
            raise ValueError("Friend relationship not found")
        if friend.get("friend_type") != "app_user" or not friend.get("linked_user_id"):
            raise ValueError("This friend must have a Meaningful account connected")

        friend_user = self.dynamodb_service.get_user(friend["linked_user_id"])
        if not friend_user:
            raise ValueError("Unable to load your friend's profile")

        # Get friend's email - should be saved during OAuth sign-in
        friend_email = friend_user.get("email")
        
        # Debug: log what we found
        if not friend_email or not isinstance(friend_email, str) or not friend_email.strip():
            # Log available fields for debugging
            available_fields = list(friend_user.keys())
            import logging
            logging.warning(
                f"Friend user {friend['linked_user_id']} missing email. "
                f"Available fields: {available_fields}. "
                f"Email value: {friend_email}"
            )
            raise ValueError(
                f"Friend does not have a valid email on file. "
                f"Please ask your friend to sign out and sign back in to update their profile."
            )
        
        friend_email = friend_email.strip()

        # Get friend's name - prioritize name from user record, then display_name, avoid phone numbers
        friend_name = friend_user.get("name")
        if not friend_name or not isinstance(friend_name, str) or not friend_name.strip():
            friend_name = friend.get("display_name")
        # If display_name looks like a phone number (starts with +), use "Friend" instead
        if friend_name and isinstance(friend_name, str) and friend_name.strip().startswith("+"):
            friend_name = None
        if not friend_name or not isinstance(friend_name, str) or not friend_name.strip():
            friend_name = "Friend"
        
        summary = title or f"Catch up with {friend_name}"
        description = notes or "Planned via Meaningful."

        timezone_name = (
            owner_record.get("availability", {}).get("timezone")
            if isinstance(owner_record.get("availability"), Dict)
            else None
        ) or "UTC"
        try:
            ZoneInfo(timezone_name)
        except Exception:
            timezone_name = "UTC"

        attendees = [{"email": friend_email}]
        owner_email = owner_record.get("email")
        if isinstance(owner_email, str) and owner_email.strip():
            attendees.insert(0, {"email": owner_email.strip(), "responseStatus": "accepted"})

        event_body = {
            "summary": summary,
            "description": description,
            "start": {"dateTime": start_dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"), "timeZone": timezone_name},
            "end": {"dateTime": end_dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"), "timeZone": timezone_name},
            "attendees": attendees,
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {"method": "email", "minutes": 24 * 60},
                    {"method": "popup", "minutes": 10},
                ],
            },
            "conferenceData": {
                "createRequest": {
                    "requestId": f"meaningful-{uuid4()}",
                    "conferenceSolutionKey": {"type": "hangoutsMeet"},
                }
            },
            "extendedProperties": {
                "private": {
                    "meaningful": "true",  # Mark events created by Meaningful app
                }
            },
        }

        try:
            event, refreshed_tokens = self.google_calendar_service.create_event(
                owner_tokens,
                event_body,
                conference_data=True,
            )
            if refreshed_tokens:
                self.dynamodb_service.update_user(user_id, {"google_tokens": refreshed_tokens})
        except RuntimeError as exc:
            error_msg = str(exc).lower()
            if any(keyword in error_msg for keyword in ["insufficient", "scope", "permission", "403", "access_denied"]):
                raise ValueError(
                    "Your Google Calendar connection is missing required permissions to create events. "
                    "Please sign out completely, then sign back in to grant the new calendar event permissions."
                ) from exc
            raise ValueError(f"Failed to create calendar event: {str(exc)}") from exc

        # Extract event details for response
        event_id = event.get("id")
        event_summary = event.get("summary")
        event_html_link = event.get("htmlLink")
        hangout_link = event.get("hangoutLink")
        
        # Fallback for hangout link from conference data
        if not hangout_link and event.get("conferenceData", {}).get("entryPoints"):
            hangout_link = event.get("conferenceData", {}).get("entryPoints", [{}])[0].get("uri")
        
        return {
            "status": "scheduled",
            "event": {
                "id": event_id,
                "summary": event_summary,
                "htmlLink": event_html_link,  # URL to view event in Google Calendar
                "hangoutLink": hangout_link,  # Google Meet link if available
                "start": event.get("start"),
                "end": event.get("end"),
            },
        }

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

    def _resolve_participant_context(
        self, user_id: str, friend_id: str
    ) -> Tuple[ParticipantMatchReport, Optional[ParticipantContext]]:

        friend = self.friends_service.get_friend(user_id, friend_id)
        friend_payload = {
            "friendId": friend_id,
        }
        if friend:
            friend_payload.update(
                {
                    "displayName": friend.get("display_name", "Friend"),
                    "friendType": friend.get("friend_type"),
                    "referenceId": friend.get("reference_id"),
                }
            )

        report = ParticipantMatchReport(
            friend=friend_payload,
            status="unavailable",
        )

        if not friend:
            report.details = "Friend relationship not found."
            return report, None

        linked_user_id = friend.get("linked_user_id")
        report.linked_user_id = linked_user_id
        if not linked_user_id:
            report.status = "missing_connection"
            report.details = "Friend has not linked their Meaningful account yet."
            return report, None

        user_record = self.dynamodb_service.get_user(linked_user_id)
        if not user_record:
            report.status = "user_not_found"
            report.details = "Unable to load the friend's user profile."
            return report, None

        availability_record = user_record.get("availability")
        if not isinstance(availability_record, Dict):
            report.status = "no_availability"
            report.details = "Friend has not configured weekly availability."
            return report, None

        availability = Availability.from_record(availability_record)
        timezone_name = availability.timezone or "UTC"
        try:
            tz = ZoneInfo(timezone_name)
        except Exception:
            tz = ZoneInfo("UTC")
            timezone_name = "UTC"

        report.status = "ready"
        report.timezone = timezone_name

        tokens = user_record.get("google_tokens") if isinstance(user_record.get("google_tokens"), Dict) else None
        report.google_connected = tokens is not None
        if not tokens:
            report.details = "Using saved weekly availability only."

        context = ParticipantContext(
            friend=friend_payload,
            linked_user_id=linked_user_id,
            availability=availability,
            timezone=tz,
            timezone_name=timezone_name,
            google_tokens=tokens,
        )
        return report, context

    def _resolve_owner_context(self, user_id: str) -> Tuple[ParticipantMatchReport, Optional[ParticipantContext]]:
        friend_payload = {
            "friendId": f"user#{user_id}",
            "displayName": "You",
            "friendType": "self",
            "referenceId": user_id,
        }

        report = ParticipantMatchReport(
            friend=friend_payload,
            status="unavailable",
        )

        user_record = self.dynamodb_service.get_user(user_id)
        if not user_record:
            report.status = "user_not_found"
            report.details = "Unable to load your profile."
            return report, None

        display_name = (
            user_record.get("name")
            or user_record.get("display_name")
            or user_record.get("email")
            or "You"
        )
        friend_payload["displayName"] = display_name

        availability_record = user_record.get("availability")
        if not isinstance(availability_record, Dict):
            report.status = "no_availability"
            report.details = "Set up your weekly availability in Settings."
            return report, None

        availability = Availability.from_record(availability_record)
        timezone_name = availability.timezone or "UTC"
        try:
            tz = ZoneInfo(timezone_name)
        except Exception:
            tz = ZoneInfo("UTC")
            timezone_name = "UTC"

        report.status = "ready"
        report.timezone = timezone_name

        tokens = user_record.get("google_tokens") if isinstance(user_record.get("google_tokens"), Dict) else None
        report.google_connected = tokens is not None
        if not tokens:
            report.details = "Using saved weekly availability only."

        context = ParticipantContext(
            friend=friend_payload,
            linked_user_id=user_id,
            availability=availability,
            timezone=tz,
            timezone_name=timezone_name,
            google_tokens=tokens,
        )
        return report, context

    def _compute_free_windows_for_participant(
        self,
        context: ParticipantContext,
        local_window_start: datetime,
        local_window_end: datetime,
    ) -> Tuple[List[Tuple[datetime, datetime]], bool]:

        slots = self._expand_slots_within_window(context.availability, local_window_start, local_window_end)
        slots_utc = [(start.astimezone(timezone.utc), end.astimezone(timezone.utc)) for start, end in slots]

        used_google = False
        if context.google_tokens:
            window_start_utc = local_window_start.astimezone(timezone.utc)
            window_end_utc = local_window_end.astimezone(timezone.utc)
            busy_periods, refreshed = self.google_calendar_service.get_busy_periods(
                context.google_tokens, window_start_utc, window_end_utc, context.timezone_name
            )
            used_google = True
            if refreshed:
                self.dynamodb_service.update_user(context.linked_user_id, {"google_tokens": refreshed})
            busy_intervals = self._parse_busy_windows(busy_periods)
            slots_utc = self._subtract_busy_windows(slots_utc, busy_intervals)

        filtered_slots = [slot for slot in slots_utc if slot[0] < slot[1]]
        return filtered_slots, used_google

    @staticmethod
    def _expand_slots_within_window(
        availability: Availability,
        window_start: datetime,
        window_end: datetime,
    ) -> List[Tuple[datetime, datetime]]:
        slots: List[Tuple[datetime, datetime]] = []
        cursor = window_start.replace(hour=0, minute=0, second=0, microsecond=0)
        while cursor < window_end:
            day_key = cursor.strftime("%A").lower()
            day_slots = availability.weekly.get(day_key, [])
            for slot in day_slots:
                start, end = FriendsAvailabilityService._slot_range(cursor, slot)
                if end <= window_start or start >= window_end:
                    continue
                slot_start = max(start, window_start)
                slot_end = min(end, window_end)
                if slot_start < slot_end:
                    slots.append((slot_start, slot_end))
            cursor += timedelta(days=1)
        slots.sort(key=lambda item: item[0])
        return slots

    @staticmethod
    def _parse_busy_windows(busy_periods: List[Dict[str, Any]]) -> List[Tuple[datetime, datetime]]:
        windows: List[Tuple[datetime, datetime]] = []
        for entry in busy_periods:
            start = FriendsAvailabilityService._parse_calendar_datetime(entry.get("start"))
            end = FriendsAvailabilityService._parse_calendar_datetime(entry.get("end"))
            if start and end and end > start:
                windows.append((start, end))
        windows.sort(key=lambda item: item[0])
        return windows

    @staticmethod
    def _subtract_busy_windows(
        slots: List[Tuple[datetime, datetime]],
        busy_windows: List[Tuple[datetime, datetime]],
    ) -> List[Tuple[datetime, datetime]]:
        if not busy_windows:
            return slots
        result: List[Tuple[datetime, datetime]] = []
        for start, end in slots:
            current_start = start
            for busy_start, busy_end in busy_windows:
                if busy_end <= current_start or busy_start >= end:
                    continue
                if busy_start <= current_start < busy_end:
                    current_start = max(current_start, busy_end)
                    if current_start >= end:
                        break
                    continue
                if busy_start > current_start:
                    result.append((current_start, min(busy_start, end)))
                    current_start = max(current_start, busy_end)
                    if current_start >= end:
                        break
            if current_start < end:
                result.append((current_start, end))
        filtered = [(s, e) for s, e in result if e > s]
        filtered.sort(key=lambda item: item[0])
        return filtered

    @staticmethod
    def _intersect_multiple(
        interval_sets: List[List[Tuple[datetime, datetime]]],
        duration_minutes: int,
    ) -> List[Tuple[datetime, datetime]]:
        if not interval_sets:
            return []
        intersection = interval_sets[0]
        for intervals in interval_sets[1:]:
            intersection = FriendsAvailabilityService._intersect_pair(intersection, intervals)
            if not intersection:
                return []
        min_duration = timedelta(minutes=duration_minutes)
        return [
            (start, end)
            for start, end in intersection
            if end - start >= min_duration
        ]

    @staticmethod
    def _intersect_pair(
        a: List[Tuple[datetime, datetime]],
        b: List[Tuple[datetime, datetime]],
    ) -> List[Tuple[datetime, datetime]]:
        i = j = 0
        result: List[Tuple[datetime, datetime]] = []
        while i < len(a) and j < len(b):
            start = max(a[i][0], b[j][0])
            end = min(a[i][1], b[j][1])
            if start < end:
                result.append((start, end))
            if a[i][1] < b[j][1]:
                i += 1
            else:
                j += 1
        return result

    @staticmethod
    def _resolve_confidence(google_flags: List[bool]) -> str:
        if all(google_flags):
            return "high"
        if any(google_flags):
            return "medium"
        return "low"


