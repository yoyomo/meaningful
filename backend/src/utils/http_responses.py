"""
HTTP response utilities for Lambda functions
"""
import json
from typing import Dict, Any, Optional


def create_cors_headers() -> Dict[str, str]:
    """Create standard CORS headers for all responses"""
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT,DELETE'
    }


def create_json_response(
    status_code: int,
    body: Dict[str, Any],
    headers: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """Create a standard JSON response for Lambda"""
    response_headers = create_cors_headers()
    if headers:
        response_headers.update(headers)
    
    return {
        'statusCode': status_code,
        'headers': response_headers,
        'body': json.dumps(body)
    }


def create_redirect_response(
    location: str,
    headers: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """Create a redirect response for Lambda"""
    response_headers = {'Location': location}
    if headers:
        response_headers.update(headers)
    
    return {
        'statusCode': 302,
        'headers': response_headers,
        'body': ''
    }


def create_error_response(
    status_code: int,
    error_message: str,
    details: Optional[str] = None
) -> Dict[str, Any]:
    """Create a standard error response"""
    body = {'error': error_message}
    if details:
        body['details'] = details
    
    return create_json_response(status_code, body)