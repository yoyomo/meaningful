from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Iterable, List, Mapping, Optional

from shared.availability import DAY_KEYS, DEFAULT_TIMEZONE, TIME_REGEX, DayKey


def _parse_time(value: str) -> tuple[int, int]:
    if not TIME_REGEX.fullmatch(value):
        raise ValueError(f"Invalid time format: {value}")
    hour_int, minute_int = (int(part) for part in value.split(':'))
    if not (0 <= hour_int <= 23 and 0 <= minute_int <= 59):
        raise ValueError(f"Time out of bounds: {value}")
    return hour_int, minute_int


def _format_time(hour: int, minute: int) -> str:
    return f"{hour:02d}:{minute:02d}"


@dataclass(frozen=True)
class TimeSlot:
    start: str
    end: str

    def to_dict(self) -> Dict[str, str]:
        return {'start': self.start, 'end': self.end}

    @staticmethod
    def from_mapping(data: Mapping[str, object]) -> 'TimeSlot':
        start_raw = data.get('start') or data.get('startTime')
        end_raw = data.get('end') or data.get('endTime')

        if not isinstance(start_raw, str) or not isinstance(end_raw, str):
            raise ValueError("Time slots require string start and end values")

        start_hour, start_minute = _parse_time(start_raw)
        end_hour, end_minute = _parse_time(end_raw)

        if (start_hour, start_minute) >= (end_hour, end_minute):
            raise ValueError("Start time must be earlier than end time")

        return TimeSlot(
            start=_format_time(start_hour, start_minute),
            end=_format_time(end_hour, end_minute),
        )


WeeklyAvailability = Dict[DayKey, List[TimeSlot]]


def _empty_weekly() -> WeeklyAvailability:
    return {day: [] for day in DAY_KEYS}


@dataclass
class Availability:
    timezone: str
    weekly: WeeklyAvailability = field(default_factory=_empty_weekly)
    updated_at: Optional[str] = None

    def to_dict(self) -> Dict[str, object]:
        return {
            'timezone': self.timezone,
            'weekly': {day: [slot.to_dict() for slot in slots] for day, slots in self.weekly.items()},
            'updatedAt': self.updated_at,
        }

    @classmethod
    def empty(cls, timezone: str = DEFAULT_TIMEZONE) -> 'Availability':
        return cls(timezone=timezone, weekly=_empty_weekly(), updated_at=None)

    @classmethod
    def from_record(cls, record: Mapping[str, object], default_timezone: str = DEFAULT_TIMEZONE) -> 'Availability':
        timezone_raw = record.get('timezone')
        timezone = timezone_raw.strip() if isinstance(timezone_raw, str) else default_timezone
        weekly_raw = record.get('weekly')
        weekly = _parse_weekly(weekly_raw if isinstance(weekly_raw, Mapping) else {})
        updated_at_raw = record.get('updatedAt')
        updated_at = updated_at_raw if isinstance(updated_at_raw, str) else None
        return cls(timezone=timezone or default_timezone, weekly=weekly, updated_at=updated_at)

    @classmethod
    def from_request(cls, payload: Mapping[str, object]) -> 'Availability':
        timezone = _extract_timezone(payload)
        weekly_source = _extract_weekly_source(payload)
        weekly = _parse_weekly(weekly_source)
        return cls(timezone=timezone, weekly=weekly, updated_at=datetime.utcnow().isoformat())


def _extract_timezone(payload: Mapping[str, object]) -> str:
    timezone_raw = payload.get('timezone')
    if isinstance(timezone_raw, str) and timezone_raw.strip():
        return timezone_raw.strip()
    return DEFAULT_TIMEZONE


def _extract_weekly_source(payload: Mapping[str, object]) -> Mapping[str, object]:
    weekly_availability = payload.get('weeklyAvailability')
    if isinstance(weekly_availability, Mapping):
        return weekly_availability
    weekly = payload.get('weekly')
    if isinstance(weekly, Mapping):
        return weekly
    return {}


def _parse_weekly(weekly_payload: Mapping[str, object]) -> WeeklyAvailability:
    weekly: WeeklyAvailability = _empty_weekly()
    for day in DAY_KEYS:
        slots_raw = weekly_payload.get(day, [])
        if isinstance(slots_raw, Iterable) and not isinstance(slots_raw, (str, bytes)):
            weekly[day] = _parse_slots(slots_raw)
    return weekly


def _parse_slots(slots_payload: Iterable[object]) -> List[TimeSlot]:
    parsed_slots: List[TimeSlot] = []
    for slot in slots_payload:
        if isinstance(slot, Mapping):
            parsed_slots.append(TimeSlot.from_mapping(slot))
    return parsed_slots

