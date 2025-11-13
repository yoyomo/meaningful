import boto3
from typing import Dict, Optional, Mapping
import os
from datetime import datetime
from typing import cast

from models.availability import Availability


def create_dynamodb_resource() -> boto3.resources.base.ServiceResource:
    endpoint_url = os.environ.get('DYNAMODB_ENDPOINT')
    if endpoint_url:
        return boto3.resource(
            'dynamodb',
            endpoint_url=endpoint_url,
            region_name=os.environ.get('AWS_REGION', 'us-east-1'),
            aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID', 'dummy'),
            aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY', 'dummy'),
        )
    return boto3.resource('dynamodb')


class DynamoDBService:
    def __init__(self):
        self.dynamodb = create_dynamodb_resource()
        self.users_table = self.dynamodb.Table(os.environ['USERS_TABLE'])
        self.calendars_table = self.dynamodb.Table(os.environ['CALENDARS_TABLE'])
        self.friends_table = self.dynamodb.Table(os.environ['FRIENDS_TABLE'])
    
    def get_user(self, user_id: str) -> Optional[Dict[str, object]]:
        """Get user by ID"""
        try:
            response = self.users_table.get_item(Key={'id': user_id})
            return response.get('Item')
        except Exception as e:
            print(f"Error getting user: {e}")
            return None
    
    def create_user(self, user_data: Mapping[str, object]) -> bool:
        """Create a new user"""
        try:
            self.users_table.put_item(Item=dict(user_data))
            return True
        except Exception as e:
            print(f"Error creating user: {e}")
            return False
    
    def update_user(self, user_id: str, updates: Mapping[str, object]) -> bool:
        """Update user data"""
        try:
            # Build update expression
            update_expression = "SET "
            expression_values = {}
            
            for key, value in updates.items():
                update_expression += f"{key} = :{key}, "
                expression_values[f":{key}"] = value
            
            update_expression = update_expression.rstrip(", ")
            
            self.users_table.update_item(
                Key={'id': user_id},
                UpdateExpression=update_expression,
                ExpressionAttributeValues=expression_values
            )
            return True
        except Exception as e:
            print(f"Error updating user: {e}")
            return False

    def get_user_availability(self, user_id: str) -> Optional[Availability]:
        """Get a user's stored availability"""
        user = self.get_user(user_id)
        if not user:
            return None
        availability_raw = user.get('availability')
        if isinstance(availability_raw, Mapping):
            return Availability.from_record(cast(Mapping[str, object], availability_raw))
        return None

    def set_user_availability(self, user_id: str, availability: Availability) -> bool:
        """Persist a user's availability data"""
        try:
            self.users_table.update_item(
                Key={'id': user_id},
                UpdateExpression="SET availability = :availability, updated_at = :updated_at",
                ExpressionAttributeValues={
                    ':availability': availability.to_dict(),
                    ':updated_at': datetime.utcnow().isoformat(),
                }
            )
            return True
        except Exception as e:
            print(f"Error updating user availability: {e}")
            return False