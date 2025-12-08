import os
from typing import Dict, Any, Optional
from urllib.parse import quote
from services.google_oauth import GoogleOAuthService
from services.phone_auth import PhoneAuthService
from utils.http_responses import create_json_response, create_redirect_response, create_error_response, create_cors_headers
from utils.env import *  # Load environment variables

# Constants
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
# AWS_REGION is automatically provided by Lambda runtime
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')


def get_api_url_from_event(event: Dict[str, Any]) -> Optional[str]:
    """
    Extract API Gateway URL from Lambda event
    Falls back to environment variable or localhost for local development
    """
    # Try to get from request context (API Gateway)
    request_context = event.get('requestContext', {})
    api_id = request_context.get('apiId')
    stage = request_context.get('stage')
    
    if api_id and stage:
        # Construct API Gateway URL
        return f"https://{api_id}.execute-api.{AWS_REGION}.amazonaws.com/{stage}"
    
    # Fall back to environment variable or localhost
    return os.environ.get('API_URL', 'http://localhost:3001')


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Google authentication handler for OAuth flow and callback
    """
    
    http_method = event.get('httpMethod', '')
    path = event.get('path', '')
    
    # Handle CORS preflight
    if http_method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': create_cors_headers(),
            'body': ''
        }
    
    if path == '/auth/google' and http_method == 'GET':
        return handle_google_auth_initiate(event, context)
    elif path == '/auth/callback' and http_method == 'GET':
        return handle_google_auth_callback(event, context)
    elif path == '/auth/phone/send-code' and http_method == 'POST':
        return handle_phone_send_code(event, context)
    elif path == '/auth/phone/verify' and http_method == 'POST':
        return handle_phone_verify(event, context)
    
    return create_error_response(404, 'Not found')


def handle_google_auth_initiate(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Initiate Google OAuth flow - returns authorization URL
    """
    try:
        query_params = event.get('queryStringParameters', {}) or {}
        user_id = query_params.get('user_id')  # Optional: check if user exists and needs consent
        force_consent = query_params.get('force_consent', 'false').lower() == 'true'
        
        # Get API URL from event context
        api_url = get_api_url_from_event(event)
        oauth_service = GoogleOAuthService(api_url=api_url)
        auth_url, state = oauth_service.get_authorization_url(
            user_id=user_id,
            force_consent=force_consent
        )
        
        return create_json_response(200, {
            'auth_url': auth_url,
            'state': state
        })
    except Exception as e:
        return create_error_response(500, 'Failed to initiate OAuth', str(e))


def handle_google_auth_callback(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle Google OAuth callback and create user session
    """
    try:
        query_params = event.get('queryStringParameters', {}) or {}
        code = query_params.get('code')
        state = query_params.get('state')
        error = query_params.get('error')
        
        if error:
            # User denied access or other error
            return create_redirect_response(f"{FRONTEND_URL}?error={error}")
        
        if not code:
            return create_redirect_response(f"{FRONTEND_URL}?error=no_code")
        
        # Get API URL from event context
        api_url = get_api_url_from_event(event)
        oauth_service = GoogleOAuthService(api_url=api_url)
        result = oauth_service.handle_callback(code, state)
        
        if result['success']:
            # Redirect back to frontend with success
            user = result['user']
            name_param = quote(user.get('name', ''))
            phone_number = user.get('phone_number')
            phone_param = f"&phone={quote(phone_number)}" if phone_number else ""
            
            # Check if user needs to re-authenticate (missing refresh token)
            needs_reauth = result.get('needs_reauth', False)
            reauth_param = "&needs_reauth=true" if needs_reauth else ""
            
            return create_redirect_response(
                f"{FRONTEND_URL}?auth=success&user_id={user['id']}&name={name_param}{phone_param}{reauth_param}"
            )
        else:
            # Redirect back with error
            return create_redirect_response(f"{FRONTEND_URL}?error=auth_failed")
            
    except Exception as e:
        return create_redirect_response(f"{FRONTEND_URL}?error=server_error")


def handle_phone_send_code(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Send SMS verification code to phone number
    """
    try:
        body = event.get('body')
        if not body:
            return create_error_response(400, 'Phone number is required')
        
        import json
        payload = json.loads(body)
        phone_number = payload.get('phoneNumber')
        
        if not phone_number or not isinstance(phone_number, str):
            return create_error_response(400, 'Valid phone number is required')
        
        phone_auth = PhoneAuthService()
        success, code, error = phone_auth.send_verification_code(phone_number)
        
        if success:
            return create_json_response(200, {
                'success': True,
                'message': 'Verification code sent',
                # Don't send code in production, but useful for development
                'code': code if os.environ.get('STAGE') == 'dev' else None
            })
        else:
            return create_error_response(400, error or 'Failed to send verification code')
    
    except json.JSONDecodeError:
        return create_error_response(400, 'Invalid JSON payload')
    except Exception as e:
        return create_error_response(500, 'Failed to send verification code', str(e))


def handle_phone_verify(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Verify SMS code and authenticate user
    """
    try:
        body = event.get('body')
        if not body:
            return create_error_response(400, 'Phone number and code are required')
        
        import json
        payload = json.loads(body)
        phone_number = payload.get('phoneNumber')
        code = payload.get('code')
        
        if not phone_number or not isinstance(phone_number, str):
            return create_error_response(400, 'Valid phone number is required')
        if not code or not isinstance(code, str):
            return create_error_response(400, 'Verification code is required')
        
        phone_auth = PhoneAuthService()
        success, error, user = phone_auth.verify_code(phone_number, code)
        
        if success and user:
            # Redirect to frontend with user info (similar to Google OAuth flow)
            user_id = user.get('id')
            name = user.get('name', '')
            phone = user.get('phone_number', phone_number)
            
            return create_redirect_response(
                f"{FRONTEND_URL}?auth=success&user_id={quote(user_id)}&name={quote(name)}&phone={quote(phone)}&auth_method=phone"
            )
        else:
            return create_redirect_response(f"{FRONTEND_URL}?error={quote(error or 'verification_failed')}")
    
    except json.JSONDecodeError:
        return create_error_response(400, 'Invalid JSON payload')
    except Exception as e:
        return create_error_response(500, 'Failed to verify code', str(e))