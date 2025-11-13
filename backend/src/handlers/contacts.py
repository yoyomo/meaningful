import json
from typing import Any, Dict, Optional

from services.contacts import ContactsService
from utils.http_responses import create_cors_headers, create_error_response, create_json_response

contacts_service = ContactsService()


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    http_method = (event.get("httpMethod") or "").upper()
    path = event.get("path") or ""

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

    if http_method == "POST" and path.endswith("/contacts/import"):
        return _handle_import_contacts(user_id, event)

    if http_method == "GET" and path.endswith("/contacts"):
        return _handle_search_contacts(user_id, event)

    return create_error_response(405, "Method not allowed")


def _handle_import_contacts(user_id: str, event: Dict[str, Any]) -> Dict[str, Any]:
    body = _parse_json_body(event.get("body"))
    max_connections = None

    if body and isinstance(body, dict):
        max_connections = body.get("maxConnections")

    result = contacts_service.import_google_contacts(
        user_id,
        max_connections=max_connections if isinstance(max_connections, int) and max_connections > 0 else 1000,
    )

    if not result.get("success"):
        return create_error_response(400, result.get("error", "Failed to import contacts"))

    return create_json_response(200, result)


def _handle_search_contacts(user_id: str, event: Dict[str, Any]) -> Dict[str, Any]:
    query_params = event.get("queryStringParameters") or {}
    search_query = (query_params.get("query") or "").strip()
    include_directory = (query_params.get("includeDirectory") or "true").lower() != "false"

    result = contacts_service.search_contacts(
        user_id=user_id,
        query=search_query,
        include_app_directory=include_directory,
    )

    return create_json_response(200, result)


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


