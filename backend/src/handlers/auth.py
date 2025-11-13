import os
from typing import Dict, Any
from urllib.parse import quote
from services.google_oauth import GoogleOAuthService
from utils.http_responses import create_json_response, create_redirect_response, create_error_response
from utils.env import *  # Load environment variables

# Constants
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Google authentication handler for OAuth flow and callback
    """
    
    http_method = event.get('httpMethod', '')
    path = event.get('path', '')
    
    if path == '/auth/google' and http_method == 'GET':
        return handle_google_auth_initiate(event, context)
    elif path == '/auth/callback' and http_method == 'GET':
        return handle_google_auth_callback(event, context)
    
    return create_error_response(404, 'Not found')


def handle_google_auth_initiate(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Initiate Google OAuth flow - returns authorization URL
    """
    try:
        oauth_service = GoogleOAuthService()
        auth_url, state = oauth_service.get_authorization_url()
        
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
        
        oauth_service = GoogleOAuthService()
        result = oauth_service.handle_callback(code, state)
        
        if result['success']:
            # Redirect back to frontend with success
            user = result['user']
            name_param = quote(user.get('name', ''))
            phone_number = user.get('phone_number')
            phone_param = f"&phone={quote(phone_number)}" if phone_number else ""
            return create_redirect_response(
                f"{FRONTEND_URL}?auth=success&user_id={user['id']}&name={name_param}{phone_param}"
            )
        else:
            # Redirect back with error
            return create_redirect_response(f"{FRONTEND_URL}?error=auth_failed")
            
    except Exception as e:
        return create_redirect_response(f"{FRONTEND_URL}?error=server_error")