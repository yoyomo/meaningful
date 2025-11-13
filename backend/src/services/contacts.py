import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple

import requests
from boto3.dynamodb.conditions import Attr, Key
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2.credentials import Credentials

from services.database import DynamoDBService, create_dynamodb_resource
from utils.logs import log_error, log_success


class ContactsService:
    """
    Handles importing and searching user contacts sourced from connected providers.
    """

    PEOPLE_API_URL = "https://people.googleapis.com/v1/people/me/connections"
    PEOPLE_FIELDS = "names,emailAddresses,phoneNumbers"

    def __init__(self) -> None:
        self.dynamodb_service = DynamoDBService()
        dynamodb = create_dynamodb_resource()
        self.contacts_table = dynamodb.Table(os.environ["CONTACTS_TABLE"])

        self.client_id = os.environ.get("GOOGLE_CLIENT_ID")
        self.client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")

    # --------------------------------------------------------------------- #
    # Public API
    # --------------------------------------------------------------------- #
    def import_google_contacts(self, user_id: str, max_connections: int = 1000) -> Dict[str, Any]:
        """
        Import the authenticated user's Google contacts via the People API.
        """
        user_record = self.dynamodb_service.get_user(user_id)
        if not user_record:
            return {"success": False, "error": "User not found"}

        google_tokens = user_record.get("google_tokens")
        if not isinstance(google_tokens, dict):
            return {"success": False, "error": "Google account not connected"}

        access_token, refreshed_tokens = self._ensure_valid_access_token(user_id, google_tokens)
        if not access_token:
            return {"success": False, "error": "Unable to refresh Google access token"}

        if refreshed_tokens:
            self._persist_updated_tokens(user_id, refreshed_tokens)

        imported_contacts = self._fetch_people_connections(access_token, max_connections=max_connections)
        if imported_contacts is None:
            return {"success": False, "error": "Failed to fetch contacts from Google"}

        saved_count = self._upsert_contacts(user_id, imported_contacts)
        log_success(f"Imported {saved_count} Google contacts for user {user_id}")

        return {
            "success": True,
            "imported": saved_count,
            "providers": ["google_people"],
        }

    def search_contacts(
        self,
        user_id: str,
        query: str,
        limit: int = 25,
        include_app_directory: bool = True,
    ) -> Dict[str, Any]:
        """
        Search the user's stored contacts (and optionally the broader user directory) by name, email, or phone.
        """
        normalized_query = query.strip()
        if not normalized_query:
            return {"contacts": [], "appUsers": []}

        saved_contacts = self._load_user_contacts(user_id)
        contacts_matches = self._filter_contacts(saved_contacts, normalized_query, limit)

        app_user_matches: List[Dict[str, Any]] = []
        if include_app_directory:
            app_user_matches = self._search_app_users(normalized_query, limit)

        return {
            "contacts": contacts_matches[:limit],
            "appUsers": app_user_matches[:limit],
        }

    # --------------------------------------------------------------------- #
    # Token helpers
    # --------------------------------------------------------------------- #
    def _ensure_valid_access_token(
        self, user_id: str, tokens: Dict[str, Any]
    ) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
        """
        Ensure we have a valid Google OAuth access token, refreshing if necessary.
        Returns the access token and (optionally) a refreshed token payload to persist.
        """
        access_token = tokens.get("access_token")
        expires_at_str = tokens.get("expires_at")
        expiry = self._parse_expiry(expires_at_str)

        if access_token and expiry:
            now = datetime.now(timezone.utc)
            if expiry - now > timedelta(minutes=2):
                return access_token, None

        if access_token and not expiry:
            # No expiry recorded (legacy data). Assume current token is valid.
            return access_token, None

        refresh_token = tokens.get("refresh_token")
        token_uri = tokens.get("token_uri", "https://oauth2.googleapis.com/token")

        if not refresh_token or not self.client_id or not self.client_secret:
            log_error(f"Cannot refresh Google token for user {user_id}: missing refresh token or client credentials")
            return None, None

        credentials = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri=token_uri,
            client_id=self.client_id,
            client_secret=self.client_secret,
            scopes=[
                "openid",
                "https://www.googleapis.com/auth/userinfo.profile",
                "https://www.googleapis.com/auth/userinfo.email",
                "https://www.googleapis.com/auth/user.phonenumbers.read",
                "https://www.googleapis.com/auth/calendar.readonly",
                "https://www.googleapis.com/auth/contacts.readonly",
            ],
        )

        if expiry:
            credentials.expiry = expiry

        try:
            credentials.refresh(GoogleAuthRequest())
        except Exception as exc:
            log_error(f"Failed to refresh Google access token for user {user_id}: {exc}")
            return None, None

        refreshed_payload = {
            "access_token": credentials.token,
            "refresh_token": credentials.refresh_token or refresh_token,
            "token_uri": credentials.token_uri,
            "expires_at": credentials.expiry.isoformat() if credentials.expiry else None,
        }
        return credentials.token, refreshed_payload

    def _persist_updated_tokens(self, user_id: str, tokens: Dict[str, Any]) -> None:
        """
        Persist refreshed Google OAuth tokens for a user.
        """
        self.dynamodb_service.update_user(
            user_id,
            {
                "google_tokens": tokens,
                "updated_at": datetime.utcnow().isoformat(),
            },
        )

    @staticmethod
    def _parse_expiry(expiry_str: Optional[str]) -> Optional[datetime]:
        if not expiry_str:
            return None
        try:
            parsed = datetime.fromisoformat(expiry_str)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)
        except ValueError:
            return None

    # --------------------------------------------------------------------- #
    # People API helpers
    # --------------------------------------------------------------------- #
    def _fetch_people_connections(
        self,
        access_token: str,
        *,
        page_size: int = 200,
        max_connections: int = 1000,
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Fetch connections from the Google People API.
        """
        collected: List[Dict[str, Any]] = []
        page_token: Optional[str] = None

        while len(collected) < max_connections:
            params = {
                "pageSize": min(page_size, max_connections - len(collected)),
                "personFields": self.PEOPLE_FIELDS,
            }
            if page_token:
                params["pageToken"] = page_token

            try:
                response = requests.get(
                    self.PEOPLE_API_URL,
                    headers={"Authorization": f"Bearer {access_token}"},
                    params=params,
                    timeout=10,
                )
            except requests.RequestException as exc:
                log_error(f"Google People API request failed: {exc}")
                return None

            if response.status_code == 401:
                log_error("Google People API unauthorized (401). Access token may be invalid.")
                return None

            if response.status_code >= 400:
                log_error(f"Google People API error {response.status_code}: {response.text}")
                return None

            data = response.json()
            connections = data.get("connections", [])
            collected.extend(connections)

            page_token = data.get("nextPageToken")
            if not page_token:
                break

        return collected[:max_connections]

    def _upsert_contacts(self, user_id: str, connections: Iterable[Dict[str, Any]]) -> int:
        now_iso = datetime.utcnow().isoformat()
        saved = 0

        for connection in connections:
            resource_name = connection.get("resourceName")
            if not resource_name:
                continue

            names = self._extract_names(connection)
            emails = self._extract_emails(connection)
            phones = self._extract_phones(connection)
            search_terms = self._build_search_terms(names, emails, phones)

            if not search_terms:
                # Skip contacts without meaningful identifiers
                continue

            item = {
                "user_id": user_id,
                "contact_id": resource_name,
                "names": names,
                "emails": emails,
                "phones": phones,
                "search_terms": list(search_terms),
                "source": "google_people",
                "synced_at": now_iso,
            }

            self.contacts_table.put_item(Item=item)
            saved += 1

        return saved

    # --------------------------------------------------------------------- #
    # Search helpers
    # --------------------------------------------------------------------- #
    def _load_user_contacts(self, user_id: str) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        exclusive_start_key: Optional[Dict[str, Any]] = None

        while True:
            query_kwargs: Dict[str, Any] = {
                "KeyConditionExpression": Key("user_id").eq(user_id),
            }
            if exclusive_start_key:
                query_kwargs["ExclusiveStartKey"] = exclusive_start_key

            response = self.contacts_table.query(**query_kwargs)
            results.extend(response.get("Items", []))

            exclusive_start_key = response.get("LastEvaluatedKey")
            if not exclusive_start_key:
                break

        return results

    def _filter_contacts(self, contacts: Iterable[Dict[str, Any]], query: str, limit: int) -> List[Dict[str, Any]]:
        normalized_query = query.lower()
        numeric_query = "".join(ch for ch in query if ch.isdigit())

        matches: List[Dict[str, Any]] = []
        for contact in contacts:
            search_terms = contact.get("search_terms", [])

            if normalized_query and any(normalized_query in term for term in search_terms):
                matches.append(self._format_contact(contact))
            elif numeric_query and any(numeric_query in term for term in search_terms):
                matches.append(self._format_contact(contact))

            if len(matches) >= limit:
                break

        return matches

    def _search_app_users(self, query: str, limit: int) -> List[Dict[str, Any]]:
        users_table = self.dynamodb_service.users_table
        trimmed_query = query.strip()
        results: List[Dict[str, Any]] = []

        try:
            if "@" in trimmed_query:
                lowered = trimmed_query.lower()
                email_lookup = users_table.query(
                    IndexName="EmailIndex",
                    KeyConditionExpression=Key("email").eq(lowered),
                    Limit=limit,
                )
                results.extend(email_lookup.get("Items", []))
            else:
                scan_kwargs = {
                    "FilterExpression": (
                        Attr("name").contains(trimmed_query)
                        | Attr("phone_number").contains(trimmed_query)
                        | Attr("username").contains(trimmed_query)
                    ),
                    "Limit": limit,
                }
                scan_result = users_table.scan(**scan_kwargs)
                results.extend(scan_result.get("Items", []))
        except Exception as exc:
            log_error(f"Failed to search users directory: {exc}")
            return []

        formatted = []
        seen_ids = set()
        for user in results:
            user_id = user.get("id")
            if not user_id or user_id in seen_ids:
                continue
            seen_ids.add(user_id)
            formatted.append(
                {
                    "userId": user_id,
                    "name": user.get("name"),
                    "email": user.get("email"),
                    "phoneNumber": user.get("phone_number"),
                    "username": user.get("username"),
                    "source": "meaningful_directory",
                }
            )
            if len(formatted) >= limit:
                break

        return formatted

    @staticmethod
    def _format_contact(contact: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "contactId": contact.get("contact_id"),
            "names": contact.get("names", []),
            "emails": contact.get("emails", []),
            "phones": contact.get("phones", []),
            "source": contact.get("source", "google_people"),
        }

    @staticmethod
    def _extract_names(connection: Dict[str, Any]) -> List[str]:
        names = connection.get("names", []) or []
        result = []
        for entry in names:
            display = entry.get("displayName")
            if display and display not in result:
                result.append(display)
        return result

    @staticmethod
    def _extract_emails(connection: Dict[str, Any]) -> List[str]:
        emails = connection.get("emailAddresses", []) or []
        result = []
        for entry in emails:
            email = entry.get("value")
            if email:
                lowered = email.lower()
                if lowered not in result:
                    result.append(lowered)
        return result

    @staticmethod
    def _extract_phones(connection: Dict[str, Any]) -> List[str]:
        phones = connection.get("phoneNumbers", []) or []
        result = []
        for entry in phones:
            number = entry.get("value")
            if number and number not in result:
                result.append(number)
        return result

    @staticmethod
    def _build_search_terms(names: Iterable[str], emails: Iterable[str], phones: Iterable[str]) -> List[str]:
        terms = set()

        for name in names:
            lowered = name.lower()
            if lowered:
                terms.add(lowered)

        for email in emails:
            lowered = email.lower()
            if lowered:
                terms.add(lowered)

        for phone in phones:
            digits = "".join(ch for ch in phone if ch.isdigit())
            if digits:
                terms.add(digits)

        return list(terms)


