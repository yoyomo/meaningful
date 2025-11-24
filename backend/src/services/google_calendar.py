import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


class GoogleCalendarService:
    """
    Helper for calling Google Calendar FreeBusy API using stored OAuth tokens.
    """

    SCOPES = [
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "openid",
    ]

    def __init__(self) -> None:
        self.client_id = os.environ.get("GOOGLE_CLIENT_ID")
        self.client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")
        if not self.client_id or not self.client_secret:
            raise RuntimeError("Google client credentials are not configured")

    def get_busy_periods(
        self,
        tokens: Dict[str, Any],
        time_min: datetime,
        time_max: datetime,
        timezone_id: str,
    ) -> Tuple[List[Dict[str, str]], Optional[Dict[str, Any]]]:
        """
        Query Google Calendar free/busy API for the primary calendar between time_min and time_max.
        Returns (busy_periods, refreshed_tokens_if_any).
        """
        credentials, refreshed_payload = self._ensure_credentials(tokens)
        service = build("calendar", "v3", credentials=credentials, cache_discovery=False)

        body = {
            "timeMin": self._format_datetime(time_min),
            "timeMax": self._format_datetime(time_max),
            "timeZone": timezone_id,
            "items": [{"id": "primary"}],
        }

        try:
            response = service.freebusy().query(body=body).execute()
        except HttpError as error:
            error_reason = getattr(error, "reason", None)
            raise RuntimeError(f"Google Calendar API error: {error_reason or error}") from error

        calendars = response.get("calendars", {})
        primary = calendars.get("primary", {})
        busy = primary.get("busy", [])
        return busy, refreshed_payload

    def create_event(
        self,
        tokens: Dict[str, Any],
        event_body: Dict[str, Any],
        *,
        conference_data: bool = True,
    ) -> Tuple[Dict[str, Any], Optional[Dict[str, Any]]]:
        """
        Create a calendar event on the primary calendar. Optionally request Meet link.
        Returns (event_response, refreshed_tokens_if_any).
        """
        credentials, refreshed_payload = self._ensure_credentials(tokens)
        service = build("calendar", "v3", credentials=credentials, cache_discovery=False)

        insert_kwargs: Dict[str, Any] = {
            "calendarId": "primary",
            "body": event_body,
        }
        if conference_data:
            insert_kwargs["conferenceDataVersion"] = 1

        try:
            event = (
                service.events()
                .insert(**insert_kwargs)
                .execute()
            )
        except HttpError as error:
            error_reason = getattr(error, "reason", None)
            raise RuntimeError(f"Google Calendar API error: {error_reason or error}") from error

        return event, refreshed_payload

    def _ensure_credentials(self, tokens: Dict[str, Any]) -> Tuple[Credentials, Optional[Dict[str, Any]]]:
        access_token = tokens.get("access_token")
        refresh_token = tokens.get("refresh_token")
        token_uri = tokens.get("token_uri", "https://oauth2.googleapis.com/token")
        expires_at = tokens.get("expires_at")

        if not refresh_token:
            raise RuntimeError("Missing Google refresh token for calendar access")

        credentials = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri=token_uri,
            client_id=self.client_id,
            client_secret=self.client_secret,
            scopes=self.SCOPES,
        )

        if isinstance(expires_at, str):
            credentials.expiry = self._parse_expiry(expires_at)

        refreshed_payload: Optional[Dict[str, Any]] = None
        if not credentials.valid:
            credentials.refresh(GoogleAuthRequest())
            refreshed_payload = {
                "access_token": credentials.token,
                "refresh_token": credentials.refresh_token or refresh_token,
                "token_uri": credentials.token_uri,
                "expires_at": credentials.expiry.isoformat() if credentials.expiry else None,
            }

        return credentials, refreshed_payload

    @staticmethod
    def _format_datetime(value: datetime) -> str:
        return value.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    @staticmethod
    def _parse_expiry(value: str) -> datetime:
        if value.endswith("Z"):
            value = value.replace("Z", "+00:00")
        return datetime.fromisoformat(value).astimezone(timezone.utc)


