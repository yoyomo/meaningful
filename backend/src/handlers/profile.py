import json
import re
from datetime import datetime
from typing import Any, Dict, Optional

from services.database import DynamoDBService
from utils.http_responses import create_cors_headers, create_error_response, create_json_response

dynamodb_service = DynamoDBService()

PHONE_PATTERN = re.compile(r"^\+?[0-9\s\-\(\)]{5,}$")


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    http_method = (event.get("httpMethod") or "").upper()

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

    if http_method == "GET":
        return _handle_get_profile(user_id)

    if http_method == "PUT":
        return _handle_update_profile(user_id, event)

    return create_error_response(405, "Method not allowed")


def _handle_get_profile(user_id: str) -> Dict[str, Any]:
    user = dynamodb_service.get_user(user_id)
    if not user:
        return create_error_response(404, "User not found")

    profile = _serialize_profile(user_id, user)
    return create_json_response(200, {"profile": profile})


def _handle_update_profile(user_id: str, event: Dict[str, Any]) -> Dict[str, Any]:
    payload = _parse_json_body(event.get("body"))
    if payload is None:
        return create_error_response(400, "Invalid JSON payload")

    update_expressions = []
    expression_values: Dict[str, Any] = {}
    expression_names: Dict[str, str] = {}
    remove_clauses = []

    # Allow optional name updates
    if "name" in payload:
        name_raw = payload.get("name")
        if name_raw is None:
            remove_clauses.append("#name")
            expression_names["#name"] = "name"
        elif isinstance(name_raw, str):
            trimmed_name = name_raw.strip()
            if not trimmed_name:
                remove_clauses.append("#name")
                expression_names["#name"] = "name"
            else:
                update_expressions.append("#name = :name")
                expression_names["#name"] = "name"
                expression_values[":name"] = trimmed_name
        else:
            return create_error_response(400, "Name must be a string")

    # Phone number updates
    if "phoneNumber" in payload:
        phone_raw = payload.get("phoneNumber")
        if phone_raw is None:
            remove_clauses.append("phone_number")
        elif isinstance(phone_raw, str):
            trimmed_phone = phone_raw.strip()
            if not trimmed_phone:
                remove_clauses.append("phone_number")
            elif PHONE_PATTERN.fullmatch(trimmed_phone):
                update_expressions.append("phone_number = :phone_number")
                expression_values[":phone_number"] = trimmed_phone
            else:
                return create_error_response(400, "Invalid phone number format")
        else:
            return create_error_response(400, "Phone number must be a string")

    if not update_expressions and not remove_clauses:
        return create_error_response(400, "No valid profile fields provided")

    update_expressions.append("updated_at = :updated_at")
    expression_values[":updated_at"] = datetime.utcnow().isoformat()

    update_expression = f"SET {', '.join(update_expressions)}"
    if remove_clauses:
        update_expression = f"{update_expression} REMOVE {', '.join(remove_clauses)}"

    update_kwargs: Dict[str, Any] = {
        "Key": {"id": user_id},
        "UpdateExpression": update_expression,
        "ExpressionAttributeValues": expression_values,
    }
    if expression_names:
        update_kwargs["ExpressionAttributeNames"] = expression_names

    try:
        dynamodb_service.users_table.update_item(**update_kwargs)
    except Exception as exc:
        return create_error_response(500, "Failed to update profile", str(exc))

    updated_user = dynamodb_service.get_user(user_id)
    if not updated_user:
        return create_error_response(404, "User not found after update")

    profile = _serialize_profile(user_id, updated_user)
    return create_json_response(200, {"profile": profile})


def _serialize_profile(user_id: str, user: Dict[str, Any]) -> Dict[str, Optional[str]]:
    return {
        "id": user_id,
        "name": user.get("name"),
        "email": user.get("email"),
        "phoneNumber": user.get("phone_number"),
    }


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


