import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from boto3.dynamodb.conditions import Key

from services.database import DynamoDBService, create_dynamodb_resource


class FriendsService:
    def __init__(self) -> None:
        self.dynamodb_service = DynamoDBService()
        dynamodb = create_dynamodb_resource()

        friends_table_name = os.environ.get("FRIENDS_TABLE")
        if not friends_table_name:
            raise RuntimeError("FRIENDS_TABLE environment variable is not set")

        contacts_table_name = os.environ.get("CONTACTS_TABLE")
        if not contacts_table_name:
            raise RuntimeError("CONTACTS_TABLE environment variable is not set")

        self.friends_table = dynamodb.Table(friends_table_name)
        self.contacts_table = dynamodb.Table(contacts_table_name)

    def list_friends(self, user_id: str) -> List[Dict[str, Any]]:
        response = self.friends_table.query(
            KeyConditionExpression=Key("user_id").eq(user_id),
        )
        items = response.get("Items", [])
        items.sort(key=lambda item: item.get("created_at", ""), reverse=True)
        return items

    def get_friend(self, user_id: str, friend_id: str) -> Optional[Dict[str, Any]]:
        response = self.friends_table.get_item(Key={"user_id": user_id, "friend_id": friend_id})
        return response.get("Item")

    def add_friend_from_contact(self, user_id: str, contact_id: str) -> Dict[str, Any]:
        contact = self._get_contact(user_id, contact_id)
        if not contact:
            raise ValueError("Contact not found")

        friend_item = self._build_friend_item(
            user_id=user_id,
            friend_type="contact",
            reference_id=contact_id,
            display_name=self._resolve_contact_display_name(contact),
            emails=self._ensure_string_list(contact.get("emails")),
            phone_numbers=self._ensure_string_list(contact.get("phones")),
            linked_user_id=None,
        )

        self._put_friend_item(friend_item)
        return friend_item

    def add_friend_from_app_user(self, user_id: str, app_user_id: str) -> Dict[str, Any]:
        if user_id == app_user_id:
            raise ValueError("Cannot add yourself as a friend")

        app_user = self.dynamodb_service.get_user(app_user_id)
        if not app_user:
            raise ValueError("Meaningful user not found")

        friend_item = self._build_friend_item(
            user_id=user_id,
            friend_type="app_user",
            reference_id=app_user_id,
            display_name=self._resolve_app_user_display_name(app_user),
            emails=self._ensure_string_list(app_user.get("email")),
            phone_numbers=self._ensure_string_list(app_user.get("phone_number")),
            linked_user_id=app_user_id,
        )

        self._put_friend_item(friend_item)
        return friend_item

    def remove_friend(self, user_id: str, friend_id: str) -> None:
        self.friends_table.delete_item(
            Key={"user_id": user_id, "friend_id": friend_id},
            ConditionExpression="attribute_exists(friend_id)",
        )

    def _get_contact(self, user_id: str, contact_id: str) -> Optional[Dict[str, Any]]:
        response = self.contacts_table.get_item(Key={"user_id": user_id, "contact_id": contact_id})
        return response.get("Item")

    def _build_friend_item(
        self,
        *,
        user_id: str,
        friend_type: str,
        reference_id: str,
        display_name: str,
        emails: List[str],
        phone_numbers: List[str],
        linked_user_id: Optional[str],
    ) -> Dict[str, Any]:
        now_iso = datetime.utcnow().isoformat()
        return {
            "user_id": user_id,
            "friend_id": f"{friend_type}#{reference_id}",
            "friend_type": friend_type,
            "reference_id": reference_id,
            "display_name": display_name,
            "emails": emails,
            "phone_numbers": phone_numbers,
            "linked_user_id": linked_user_id,
            "created_at": now_iso,
        }

    def _put_friend_item(self, item: Dict[str, Any]) -> None:
        self.friends_table.put_item(
            Item=item,
            ConditionExpression="attribute_not_exists(friend_id)",
        )

    @staticmethod
    def _resolve_contact_display_name(contact: Dict[str, Any]) -> str:
        names = FriendsService._ensure_string_list(contact.get("names"))
        emails = FriendsService._ensure_string_list(contact.get("emails"))
        phones = FriendsService._ensure_string_list(contact.get("phones"))

        for name in names:
            if name.strip():
                return name.strip()

        for email in emails:
            if email.strip():
                return email.strip()

        for phone in phones:
            if phone.strip():
                return phone.strip()

        return "Unnamed friend"

    @staticmethod
    def _resolve_app_user_display_name(app_user: Dict[str, Any]) -> str:
        if isinstance(app_user.get("name"), str) and app_user["name"].strip():
            return app_user["name"].strip()
        if isinstance(app_user.get("email"), str) and app_user["email"].strip():
            return app_user["email"].strip()
        if isinstance(app_user.get("phone_number"), str) and app_user["phone_number"].strip():
            return app_user["phone_number"].strip()
        return "Meaningful member"

    @staticmethod
    def _ensure_string_list(value: Any) -> List[str]:
        if value is None:
            return []
        if isinstance(value, str):
            return [value]
        if isinstance(value, list):
            result = []
            for entry in value:
                if isinstance(entry, str):
                    result.append(entry)
            return result
        return []

