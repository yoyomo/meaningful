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
            raise ValueError(
                "Google Calendar connection is incomplete (missing refresh token). "
                "Please sign out and sign back in - you'll be asked to grant calendar permissions again."
            )

        # Parse and normalize expiry BEFORE creating Credentials object
        expiry_dt = None
        if isinstance(expires_at, str):
            expiry_dt = self._parse_expiry(expires_at)
        elif isinstance(expires_at, datetime):
            expiry_dt = expires_at
            if expiry_dt.tzinfo is None:
                expiry_dt = expiry_dt.replace(tzinfo=timezone.utc)
            else:
                expiry_dt = expiry_dt.astimezone(timezone.utc)
        
        # CRITICAL: Ensure expiry is ALWAYS timezone-aware UTC
        if expiry_dt is not None:
            if expiry_dt.tzinfo is None:
                expiry_dt = expiry_dt.replace(tzinfo=timezone.utc)
            else:
                expiry_dt = expiry_dt.astimezone(timezone.utc)

        # Create credentials without expiry first (some versions don't accept it in constructor)
        credentials = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri=token_uri,
            client_id=self.client_id,
            client_secret=self.client_secret,
            scopes=self.SCOPES,
        )
        
        # Set expiry AFTER creation and ensure it's timezone-aware UTC
        if expiry_dt is not None:
            # Double-check it's timezone-aware before setting
            if expiry_dt.tzinfo is None:
                expiry_dt = expiry_dt.replace(tzinfo=timezone.utc)
            else:
                expiry_dt = expiry_dt.astimezone(timezone.utc)
            credentials.expiry = expiry_dt
        
        # Defensive check: ensure expiry is still timezone-aware after setting
        if credentials.expiry is not None:
            if credentials.expiry.tzinfo is None:
                credentials.expiry = credentials.expiry.replace(tzinfo=timezone.utc)
            else:
                credentials.expiry = credentials.expiry.astimezone(timezone.utc)

        # CRITICAL: Right before checking valid, ensure expiry is timezone-aware UTC
        # The Google library might have modified it or it might not have been set correctly
        if credentials.expiry is not None:
            if credentials.expiry.tzinfo is None:
                credentials.expiry = credentials.expiry.replace(tzinfo=timezone.utc)
            else:
                credentials.expiry = credentials.expiry.astimezone(timezone.utc)
        
        refreshed_payload: Optional[Dict[str, Any]] = None
        
        # CRITICAL: Check validity with defensive timezone handling
        # If we can't check validity due to timezone issues, assume invalid and refresh
        is_valid = False
        try:
            # Ensure expiry is timezone-aware before checking
            if credentials.expiry is not None:
                if credentials.expiry.tzinfo is None:
                    credentials.expiry = credentials.expiry.replace(tzinfo=timezone.utc)
                else:
                    credentials.expiry = credentials.expiry.astimezone(timezone.utc)
            
            is_valid = credentials.valid
        except TypeError as e:
            error_msg = str(e)
            if "offset-naive" in error_msg or "offset-aware" in error_msg:
                # Timezone issue - can't check validity safely
                # Best approach: assume invalid and refresh (refresh will get new timezone-aware expiry)
                # Log the issue for debugging
                import logging
                logging.warning(f"Timezone issue checking credentials validity. Expiry: {credentials.expiry}, tzinfo: {credentials.expiry.tzinfo if credentials.expiry else None}. Will refresh token.")
                is_valid = False  # Assume invalid, will refresh
            else:
                # Different TypeError, re-raise
                raise
        
        if not is_valid:
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
        """Parse ISO format datetime string and ensure it's timezone-aware (UTC)"""
        if value.endswith("Z"):
            value = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(value)
        # Ensure timezone-aware - if naive, assume UTC
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        else:
            # Convert to UTC if it has timezone info
            parsed = parsed.astimezone(timezone.utc)
        return parsed


