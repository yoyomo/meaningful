from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Final, List, Literal, Tuple, TypedDict

SCHEMA_PATH = Path(__file__).with_name("availability_schema.json")

with SCHEMA_PATH.open("r", encoding="utf-8") as schema_file:
    _schema = json.load(schema_file)

DayKey = Literal[
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
]

_expected_day_keys: Tuple[DayKey, ...] = (
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
)

if tuple(_schema.get("dayKeys", [])) != _expected_day_keys:
    raise ValueError("availability_schema.json dayKeys do not match expected order")

DAY_KEYS: Final[Tuple[DayKey, ...]] = _expected_day_keys
TIME_REGEX: Final[re.Pattern[str]] = re.compile(_schema["timePattern"])
DEFAULT_TIMEZONE: Final[str] = _schema.get("defaultTimezone", "UTC")


class TimeSlot(TypedDict):
    start: str
    end: str


class WeeklyAvailability(TypedDict):
    sunday: List[TimeSlot]
    monday: List[TimeSlot]
    tuesday: List[TimeSlot]
    wednesday: List[TimeSlot]
    thursday: List[TimeSlot]
    friday: List[TimeSlot]
    saturday: List[TimeSlot]


class AvailabilityRecord(TypedDict):
    timezone: str
    weekly: WeeklyAvailability
    updatedAt: str | None


class AvailabilityUpdatePayload(TypedDict, total=False):
    timezone: str
    weeklyAvailability: WeeklyAvailability
    weekly: WeeklyAvailability

