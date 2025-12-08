import os
import secrets
import boto3
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, Tuple
from utils.logs import log_error, log_success
from services.sms_service import get_sms_service
from services.database import DynamoDBService

# DynamoDB for storing verification codes
VERIFICATION_TABLE_NAME = os.environ.get('VERIFICATION_CODES_TABLE', 'verification_codes')
CODE_EXPIRY_MINUTES = 10

class PhoneAuthService:
    """
    Service for phone number authentication via SMS verification codes.
    """
    
    def __init__(self):
        self.dynamodb_service = DynamoDBService()
        self.sms_service = get_sms_service()
        
        # Create DynamoDB resource for verification codes table
        dynamodb_endpoint = os.environ.get('DYNAMODB_ENDPOINT')
        if dynamodb_endpoint:
            dynamodb = boto3.resource(
                'dynamodb',
                endpoint_url=dynamodb_endpoint,
                region_name=os.environ.get('AWS_REGION', 'us-east-1'),
                aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID', 'dummy'),
                aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY', 'dummy'),
            )
        else:
            dynamodb = boto3.resource('dynamodb')
        
        self.verification_table = dynamodb.Table(VERIFICATION_TABLE_NAME)
    
    def normalize_phone_number(self, phone: str) -> str:
        """Normalize phone number to E.164 format"""
        # Remove all non-digit characters except +
        cleaned = ''.join(c for c in phone if c.isdigit() or c == '+')
        # Ensure it starts with +
        if not cleaned.startswith('+'):
            # Assume US number if no country code
            cleaned = '+1' + cleaned
        return cleaned
    
    def send_verification_code(self, phone_number: str) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Send verification code to phone number.
        Returns (success, code, error_message)
        """
        try:
            normalized_phone = self.normalize_phone_number(phone_number)
            
            # Generate 6-digit code
            code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
            
            # Store code in DynamoDB with expiry
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=CODE_EXPIRY_MINUTES)
            self.verification_table.put_item(
                Item={
                    'phone_number': normalized_phone,
                    'code': code,
                    'expires_at': expires_at.isoformat(),
                    'created_at': datetime.now(timezone.utc).isoformat(),
                    'verified': False,
                }
            )
            
            # Send SMS
            success = self.sms_service.send_verification_code(normalized_phone, code)
            
            if success:
                log_success(f"Verification code sent to {normalized_phone}")
                return (True, code, None)
            else:
                return (False, None, "Failed to send SMS. Please check your phone number and try again.")
        
        except Exception as e:
            error_msg = str(e)
            log_error(f"Error sending verification code: {error_msg}")
            return (False, None, f"Failed to send verification code: {error_msg}")
    
    def verify_code(self, phone_number: str, code: str) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
        """
        Verify code and create/return user.
        Returns (success, error_message, user_data)
        """
        try:
            normalized_phone = self.normalize_phone_number(phone_number)
            
            # Get verification record
            response = self.verification_table.get_item(
                Key={'phone_number': normalized_phone}
            )
            
            if 'Item' not in response:
                return (False, "Verification code not found. Please request a new code.", None)
            
            item = response['Item']
            stored_code = item.get('code')
            expires_at_str = item.get('expires_at')
            already_verified = item.get('verified', False)
            
            # Check if already verified
            if already_verified:
                return (False, "This code has already been used. Please request a new code.", None)
            
            # Check expiry
            if expires_at_str:
                expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00'))
                if datetime.now(timezone.utc) > expires_at:
                    return (False, "Verification code has expired. Please request a new code.", None)
            
            # Verify code
            if stored_code != code:
                return (False, "Invalid verification code. Please try again.", None)
            
            # Mark as verified
            self.verification_table.update_item(
                Key={'phone_number': normalized_phone},
                UpdateExpression='SET verified = :verified',
                ExpressionAttributeValues={':verified': True}
            )
            
            # Create or get user
            user = self._get_or_create_user(normalized_phone)
            
            log_success(f"Phone verification successful for {normalized_phone}, user_id: {user['id']}")
            return (True, None, user)
        
        except Exception as e:
            error_msg = str(e)
            log_error(f"Error verifying code: {error_msg}")
            return (False, f"Verification failed: {error_msg}", None)
    
    def _get_or_create_user(self, phone_number: str) -> Dict[str, Any]:
        """Get existing user by phone number or create new one"""
        # Check if user exists with this phone number
        # Note: This requires a GSI on phone_number, or we scan (not ideal for production)
        # For now, we'll use phone number as user ID (normalized)
        user_id = f"phone_{phone_number.replace('+', '')}"
        
        user = self.dynamodb_service.get_user(user_id)
        
        if user:
            # Update last login
            self.dynamodb_service.update_user(user_id, {
                'updated_at': datetime.now(timezone.utc).isoformat(),
            })
            return user
        
        # Create new user
        now = datetime.now(timezone.utc).isoformat()
        user_data = {
            'id': user_id,
            'phone_number': phone_number,
            'created_at': now,
            'updated_at': now,
            'auth_method': 'phone',
        }
        
        self.dynamodb_service.create_user(user_data)
        log_success(f"Created new user via phone auth: {user_id}")
        
        return user_data

