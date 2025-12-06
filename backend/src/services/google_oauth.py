import os
from typing import Dict, Any, Optional
from utils.logs import log_error, log_success
from google.auth.transport import requests
from google.oauth2 import id_token
from google_auth_oauthlib.flow import Flow
import boto3
from datetime import datetime, timezone
import requests as http_requests
from utils.env import *  # Load environment variables


# Constants - read once at module load
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
USERS_TABLE = os.environ.get('USERS_TABLE')
# API_URL is dynamically determined from SAM template or defaults to localhost
API_URL = os.environ.get('API_URL', 'http://localhost:3001')

class GoogleOAuthService:
    def __init__(self):
        self.client_id = GOOGLE_CLIENT_ID
        self.client_secret = GOOGLE_CLIENT_SECRET
        self.redirect_uri = f"{API_URL}/auth/callback"
        self.frontend_url = FRONTEND_URL
        
        # Validate required credentials
        if not self.client_id:
            log_error("GOOGLE_CLIENT_ID is not set")
        if not self.client_secret:
            log_error("GOOGLE_CLIENT_SECRET is not set")
        if not self.client_id or not self.client_secret:
            raise ValueError("Google OAuth credentials are missing. Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.")
        
        log_success(f"OAuth redirect URI: {self.redirect_uri}")
        
        # DynamoDB - use local DynamoDB if endpoint is configured
        dynamodb_endpoint = os.environ.get('DYNAMODB_ENDPOINT')
        if dynamodb_endpoint:
            # Local DynamoDB
            self.dynamodb = boto3.resource(
                'dynamodb',
                endpoint_url=dynamodb_endpoint,
                region_name=os.environ.get('AWS_REGION', 'us-east-1'),
                aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID', 'dummy'),
                aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY', 'dummy'),
            )
            log_success(f"Using local DynamoDB at {dynamodb_endpoint}")
        else:
            # AWS DynamoDB
            self.dynamodb = boto3.resource('dynamodb')
            log_success("Using AWS DynamoDB")
        
        self.users_table = self.dynamodb.Table(USERS_TABLE)
        
        # Google OAuth scopes - what permissions we need
        self.scopes = [
            'openid',
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/user.phonenumbers.read',
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/calendar.readonly',
            'https://www.googleapis.com/auth/contacts.readonly',
        ]
    
    def get_authorization_url(self, user_id: Optional[str] = None, force_consent: bool = False) -> tuple[str, str]:
        """
        Generate Google OAuth authorization URL
        
        Args:
            user_id: Optional user ID (for logging)
            force_consent: If True, force consent screen
        """
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [self.redirect_uri]
                }
            },
            scopes=self.scopes
        )
        flow.redirect_uri = self.redirect_uri
        
        # Build authorization URL parameters
        auth_params = {
            'access_type': 'offline',  # For refresh tokens
            'include_granted_scopes': 'true',
        }
        
        # Only force consent if explicitly requested (e.g., when user needs to re-auth)
        if force_consent:
            auth_params['prompt'] = 'consent'
        
        authorization_url, state = flow.authorization_url(**auth_params)
        
        return authorization_url, state
    
    def handle_callback(self, code: str, state: str) -> Dict[str, Any]:
        """
        Handle OAuth callback and create/update user
        """
        try:
            # Exchange code for tokens
            flow = Flow.from_client_config(
                {
                    "web": {
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                        "redirect_uris": [self.redirect_uri]
                    }
                },
                scopes=self.scopes
            )
            flow.redirect_uri = self.redirect_uri
            
            # Get tokens
            flow.fetch_token(code=code)
            credentials = flow.credentials
            
            # Log token info for debugging
            has_refresh = bool(credentials.refresh_token)
            log_success(f"OAuth callback: received tokens - has refresh_token: {has_refresh}")
            if has_refresh:
                log_success(f"Refresh token received: {credentials.refresh_token[:30]}...")
            else:
                log_error("CRITICAL: No refresh token received from Google even with prompt='select_account consent'")
                log_error("User may need to revoke access at https://myaccount.google.com/permissions and try again")
            
            # Verify and decode ID token
            id_info = id_token.verify_oauth2_token(
                credentials.id_token, 
                requests.Request(), 
                self.client_id
            )
            
            # Get additional user info including phone number
            phone_number = self._get_user_phone_number(credentials.token)
            
            # Extract user information
            user_id = id_info['sub']
            
            # Get refresh token - check new credentials first, then existing database record
            refresh_token = credentials.refresh_token
            
            # IMPORTANT: Google OAuth quirk - refresh_token might be None even with prompt='consent'
            # if the user has already granted access. We need to check the raw token response.
            if not refresh_token:
                # Try to get it from the raw token response (Google sometimes puts it there)
                try:
                    # The Flow object might have the raw response
                    if hasattr(flow, 'credentials') and hasattr(flow.credentials, 'refresh_token'):
                        refresh_token = flow.credentials.refresh_token
                except:
                    pass
            
            log_success(f"OAuth callback for user {user_id}: received refresh_token = {bool(refresh_token)}")
            
            if not refresh_token:
                log_error(f"No refresh token in new credentials for user {user_id}, checking existing user record...")
                try:
                    existing_user = self.users_table.get_item(Key={'id': user_id})
                    if 'Item' in existing_user:
                        existing_tokens = existing_user['Item'].get('google_tokens', {})
                        existing_refresh = existing_tokens.get('refresh_token')
                        if existing_refresh:
                            refresh_token = existing_refresh
                            log_success(f"Using existing refresh token from database for user {user_id}")
                        else:
                            log_error(f"User {user_id} has no refresh token in database either")
                            log_error(f"Google OAuth app may be in 'Testing' mode - refresh tokens only work for test users")
                            log_error(f"Or user needs to revoke access at https://myaccount.google.com/permissions")
                except Exception as e:
                    log_error(f"Error checking existing user {user_id}: {e}")
            
            # Log final state
            if refresh_token:
                log_success(f"User {user_id} will have refresh_token saved: {refresh_token[:20]}...")
            else:
                log_error(f"CRITICAL: User {user_id} has NO refresh token - calendar features will not work!")
                log_error(f"This usually means:")
                log_error(f"  1. OAuth app is in 'Testing' mode (only test users get refresh tokens)")
                log_error(f"  2. User needs to revoke access and re-authenticate")
                log_error(f"  3. OAuth app configuration issue")
            
            # Build google_tokens - only include refresh_token if we have one
            # Ensure expires_at is always saved with timezone info (UTC)
            expires_at_str = None
            if credentials.expiry:
                # Always convert to UTC and ensure timezone-aware
                expiry = credentials.expiry
                if expiry.tzinfo is None:
                    expiry_utc = expiry.replace(tzinfo=timezone.utc)
                else:
                    expiry_utc = expiry.astimezone(timezone.utc)
                expires_at_str = expiry_utc.isoformat()
            
            google_tokens = {
                'access_token': credentials.token,
                'token_uri': credentials.token_uri,
                'expires_at': expires_at_str
            }
            # Only add refresh_token if we have one (don't save None)
            if refresh_token:
                google_tokens['refresh_token'] = refresh_token
            
            user_data = {
                'id': id_info['sub'],  # Google user ID
                'email': id_info['email'],
                'name': id_info['name'],
                'picture': id_info.get('picture', ''),
                'phone_number': phone_number,
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
                'google_tokens': google_tokens
            }
            
            # Store or update user in DynamoDB without losing existing fields (e.g., availability)
            try:
                update_expression_parts = [
                    "#email = :email",
                    "#name = :name",
                    "picture = :picture",
                    "google_tokens = :google_tokens",
                    "updated_at = :updated_at",
                    "created_at = if_not_exists(created_at, :created_at)",
                ]
                expression_names = {
                    '#email': 'email',
                    '#name': 'name',
                }
                expression_values = {
                    ':email': user_data['email'],
                    ':name': user_data['name'],
                    ':picture': user_data['picture'],
                    ':google_tokens': user_data['google_tokens'],
                    ':updated_at': user_data['updated_at'],
                    ':created_at': user_data['created_at'],
                }

                remove_expression = None
                phone_number = user_data.get('phone_number')
                if phone_number:
                    update_expression_parts.append('phone_number = :phone_number')
                    expression_values[':phone_number'] = phone_number
                else:
                    remove_expression = 'REMOVE phone_number'

                update_expression = "SET " + ", ".join(update_expression_parts)
                if remove_expression:
                    update_expression = f"{update_expression} {remove_expression}"

                self.users_table.update_item(
                    Key={'id': user_data['id']},
                    UpdateExpression=update_expression,
                    ExpressionAttributeNames=expression_names,
                    ExpressionAttributeValues=expression_values,
                )
            except Exception as db_error:
                # Log but don't fail - OAuth succeeded even if DB write failed
                error_type = type(db_error).__name__
                error_msg = str(db_error)
                log_error(f"DynamoDB write failed (OAuth succeeded, user authenticated): {error_type}: {error_msg}")
            
            # Check if we have a refresh token - if not, user needs to re-authenticate
            has_refresh_token = bool(user_data['google_tokens'].get('refresh_token'))
            
            return {
                'success': True,
                'user': {
                    'id': user_data['id'],
                    'email': user_data['email'],
                    'name': user_data['name'],
                    'picture': user_data['picture'],
                    'phone_number': user_data['phone_number']
                },
                'needs_reauth': not has_refresh_token,  # Frontend can use this to trigger re-auth
                'has_refresh_token': has_refresh_token
            }
            
        except Exception as e:
            error_msg = str(e)
            error_type = type(e).__name__
            log_error(f"OAuth callback error: ({error_type}) {error_msg}")
            log_error(f"Using redirect_uri: {self.redirect_uri}")
            log_error(f"Client ID: {self.client_id[:20]}..." if self.client_id else "Client ID: NOT SET")
            return {
                'success': False,
                'error': error_msg
            }
    
    def _get_user_phone_number(self, access_token: str) -> Optional[str]:
        """
        Get user's phone number using People API
        """
        try:
            # Call People API to get phone numbers
            response = http_requests.get(
                'https://people.googleapis.com/v1/people/me?personFields=phoneNumbers',
                headers={'Authorization': f'Bearer {access_token}'}
            )
            
            if response.status_code == 200:
                data = response.json()
                phone_numbers = data.get('phoneNumbers', [])
                if phone_numbers:
                    # Return the first phone number (usually primary)
                    return phone_numbers[0].get('value', '')
            
            return None
            
        except Exception as e:
            log_error(f"Error fetching phone number: {e}")
            return None
    
    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get user by Google ID
        """
        try:
            response = self.users_table.get_item(Key={'id': user_id})
            return response.get('Item')
        except Exception as e:
            log_error(f"Error getting user: {e}")
            return None