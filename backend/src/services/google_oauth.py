import os
from typing import Dict, Any, Optional
from utils.logs import log_error, log_success
from google.auth.transport import requests
from google.oauth2 import id_token
from google_auth_oauthlib.flow import Flow
import boto3
from datetime import datetime
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
    
    def get_authorization_url(self) -> str:
        """
        Generate Google OAuth authorization URL
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
        
        authorization_url, state = flow.authorization_url(
            access_type='offline',  # For refresh tokens
            include_granted_scopes='true'
        )
        
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
            
            # Verify and decode ID token
            id_info = id_token.verify_oauth2_token(
                credentials.id_token, 
                requests.Request(), 
                self.client_id
            )
            
            # Get additional user info including phone number
            phone_number = self._get_user_phone_number(credentials.token)
            
            # Extract user information
            user_data = {
                'id': id_info['sub'],  # Google user ID
                'email': id_info['email'],
                'name': id_info['name'],
                'picture': id_info.get('picture', ''),
                'phone_number': phone_number,
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
                'google_tokens': {
                    'access_token': credentials.token,
                    'refresh_token': credentials.refresh_token,
                    'token_uri': credentials.token_uri,
                    'expires_at': credentials.expiry.isoformat() if credentials.expiry else None
                }
            }
            
            # Store or update user in DynamoDB without losing existing fields (e.g., availability)
            try:
                update_expression_parts = [
                    "SET #email = :email",
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
            
            return {
                'success': True,
                'user': {
                    'id': user_data['id'],
                    'email': user_data['email'],
                    'name': user_data['name'],
                    'picture': user_data['picture'],
                    'phone_number': user_data['phone_number']
                }
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