import json
from typing import Any, Dict, Mapping, Optional

from services.database import DynamoDBService
from utils.http_responses import create_cors_headers, create_error_response, create_json_response
from models.availability import Availability

dynamodb_service = DynamoDBService()


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    http_method = event.get('httpMethod', '').upper()

    if http_method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': create_cors_headers(),
            'body': ''
        }

    path_parameters = event.get('pathParameters') or {}
    user_id = path_parameters.get('user_id')
    if not user_id:
        return create_error_response(400, 'User ID is required')

    if http_method == 'GET':
        return handle_get_availability(user_id)

    if http_method == 'PUT':
        body = event.get('body')
        if body is None:
            return create_error_response(400, 'Request body is required')

        payload = _parse_json_body(body)
        if payload is None:
            return create_error_response(400, 'Invalid JSON payload')

        try:
            availability = Availability.from_request(payload)
        except ValueError as exc:
            return create_error_response(400, 'Invalid availability payload', str(exc))

        updated = dynamodb_service.set_user_availability(user_id, availability)
        if not updated:
            return create_error_response(500, 'Failed to update availability')

        return create_json_response(200, {'availability': availability.to_dict()})

    return create_error_response(405, 'Method not allowed')


def handle_get_availability(user_id: str) -> Dict[str, Any]:
    availability = dynamodb_service.get_user_availability(user_id)
    availability_record = availability or Availability.empty()
    return create_json_response(200, {'availability': availability_record.to_dict()})


def _parse_json_body(body: str) -> Optional[Mapping[str, object]]:
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return None

    if isinstance(payload, Mapping):
        return payload

    return None

