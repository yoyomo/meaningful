import json
from typing import Any, Dict, Optional

from botocore.exceptions import ClientError

from services.friends import FriendsService
from services.friends_availability import FriendsAvailabilityService
from utils.http_responses import create_cors_headers, create_error_response, create_json_response

friends_service = FriendsService()
availability_service = FriendsAvailabilityService()


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    http_method = (event.get("httpMethod") or "").upper()
    resource = event.get("resource") or ""

    if http_method == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": create_cors_headers(),
            "body": "",
        }

    path_params = event.get("pathParameters") or {}
    user_id = path_params.get("user_id")

    if not user_id:
        return create_error_response(400, "User ID is required")

    if http_method == "GET" and resource.endswith("/friends/available-now"):
        return _handle_available_now(user_id)

    if http_method == "POST" and resource.endswith("/friends/match-slot"):
        return _handle_match_slot(user_id, event)

    if http_method == "GET":
        return _handle_list_friends(user_id)

    if http_method == "POST":
        return _handle_add_friend(user_id, event)

    if http_method == "DELETE":
        friend_id = (path_params.get("friend_id") or "").strip()
        if not friend_id:
            return create_error_response(400, "friend_id path parameter is required")
        return _handle_remove_friend(user_id, friend_id)

    return create_error_response(405, "Method not allowed")


def _handle_list_friends(user_id: str) -> Dict[str, Any]:
    friends = friends_service.list_friends(user_id)
    return create_json_response(200, {"friends": friends})


def _handle_add_friend(user_id: str, event: Dict[str, Any]) -> Dict[str, Any]:
    payload = _parse_json_body(event.get("body"))
    if payload is None:
        return create_error_response(400, "Invalid JSON payload")

    source_type = payload.get("sourceType")
    if source_type not in {"contact", "app_user"}:
        return create_error_response(400, "sourceType must be 'contact' or 'app_user'")

    try:
        if source_type == "contact":
            contact_id = payload.get("contactId")
            if not isinstance(contact_id, str) or not contact_id.strip():
                return create_error_response(400, "contactId is required when sourceType is 'contact'")
            friend = friends_service.add_friend_from_contact(user_id, contact_id.strip())
        else:
            app_user_id = payload.get("appUserId")
            if not isinstance(app_user_id, str) or not app_user_id.strip():
                return create_error_response(400, "appUserId is required when sourceType is 'app_user'")
            friend = friends_service.add_friend_from_app_user(user_id, app_user_id.strip())
    except ClientError as error:
        if error.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return create_error_response(409, "Friend already added")
        return create_error_response(500, "Failed to add friend", error.response["Error"]["Message"])
    except ValueError as exc:
        return create_error_response(400, str(exc))
    except Exception as exc:
        return create_error_response(500, "Failed to add friend", str(exc))

    return create_json_response(201, {"friend": friend})


def _handle_remove_friend(user_id: str, friend_id: str) -> Dict[str, Any]:
    try:
        friends_service.remove_friend(user_id, friend_id)
    except ClientError as error:
        if error.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return create_error_response(404, "Friend not found")
        return create_error_response(500, "Failed to remove friend", error.response["Error"]["Message"])
    except Exception as exc:
        return create_error_response(500, "Failed to remove friend", str(exc))

    return create_json_response(200, {"removed": True})


def _handle_available_now(user_id: str) -> Dict[str, Any]:
    try:
        result = availability_service.compute_available_now(user_id)
    except Exception as exc:
        return create_error_response(500, "Failed to evaluate friend availability", str(exc))

    return create_json_response(200, result)


def _handle_match_slot(user_id: str, event: Dict[str, Any]) -> Dict[str, Any]:
    payload = _parse_json_body(event.get("body"))
    if payload is None:
        return create_error_response(400, "Invalid JSON payload")

    raw_friend_ids = payload.get("friendIds")
    if not isinstance(raw_friend_ids, list):
        return create_error_response(400, "friendIds must be an array containing at least one friend ID")

    friend_ids = []
    for entry in raw_friend_ids:
        if isinstance(entry, str) and entry.strip():
            friend_ids.append(entry.strip())
    if len(friend_ids) != 1:
        return create_error_response(400, "friendIds must contain exactly one valid friend ID")

    try:
        duration = int(payload.get("durationMinutes", 60))
        days_from_now = int(payload.get("daysFromNow", 14))
        window_days = int(payload.get("windowDays", 7))
    except (TypeError, ValueError):
        return create_error_response(400, "durationMinutes, daysFromNow, and windowDays must be numbers")

    try:
        match = availability_service.recommend_meeting_slot(
            user_id,
            friend_ids,
            duration_minutes=duration,
            target_days_ahead=days_from_now,
            window_days=window_days,
        )
    except ValueError as exc:
        return create_error_response(400, str(exc))
    except Exception as exc:
        return create_error_response(500, "Failed to compute a matching slot", str(exc))

    return create_json_response(200, match)


def _parse_json_body(body: Optional[str]) -> Optional[Dict[str, Any]]:
    if body is None:
        return None

    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return None

    if isinstance(data, dict):
        return data

    return None


