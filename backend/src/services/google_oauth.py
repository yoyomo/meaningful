import os
import json
from typing import Dict, Any, Optional
from google.auth.transport import requests
from google.oauth2 import id_token
from google_auth_oauthlib.flow import Flow
import boto3
from datetime import datetime
import uuid
import requests as http_requests
from utils.env import *  # Load environment variables


# Constants - read once at module load
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
USERS_TABLE = os.environ.get('USERS_TABLE')


class GoogleOAuthService:
    def __init__(self):
        self.client_id = GOOGLE_CLIENT_ID
        self.client_secret = GOOGLE_CLIENT_SECRET
        # API_URL is dynamically determined from SAM template or defaults to localhost
        self.redirect_uri = f"{os.environ.get('API_URL', 'http://localhost:3001')}/auth/callback"
        self.frontend_url = FRONTEND_URL
        
        # DynamoDB - use local DynamoDB if endpoint is configured
        dynamodb_endpoint = os.environ.get('DYNAMODB_ENDPOINT')
        if dynamodb_endpoint:
            # Local DynamoDB
            self.dynamodb = boto3.resource(
                'dynamodb',
                endpoint_url=dynamodb_endpoint,
                region_name='us-east-1',
                aws_access_key_id='dummy',
                aws_secret_access_key='dummy'
            )
            print(f"✅ Using local DynamoDB at {dynamodb_endpoint}")
        else:
            # AWS DynamoDB
            self.dynamodb = boto3.resource('dynamodb')
            print("✅ Using AWS DynamoDB")
        
        self.users_table = self.dynamodb.Table(USERS_TABLE)
        
        # Google OAuth scopes - what permissions we need
        self.scopes = [
            'openid',
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/user.phonenumbers.read',
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
            
            # Store or update user in DynamoDB
            try:
                self.users_table.put_item(Item=user_data)
            except Exception as db_error:
                # Log but don't fail - OAuth succeeded even if DB write failed
                error_type = type(db_error).__name__
                error_msg = str(db_error)
                print(f"⚠️  DynamoDB write failed (OAuth succeeded, user authenticated): {error_type}: {error_msg}")
            
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
            print(f"OAuth callback error: {e}")
            return {
                'success': False,
                'error': str(e)
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
            print(f"Error fetching phone number: {e}")
            return None
    
    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get user by Google ID
        """
        try:
            response = self.users_table.get_item(Key={'id': user_id})
            return response.get('Item')
        except Exception as e:
            print(f"Error getting user: {e}")
            return None