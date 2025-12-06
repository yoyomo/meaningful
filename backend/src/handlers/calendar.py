import os
import re
from typing import Dict, Any
from datetime import datetime, timezone
from utils.http_responses import create_json_response, create_error_response, create_cors_headers
from services.google_calendar import GoogleCalendarService
from services.database import DynamoDBService
from services.friends import FriendsService


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Google Calendar sync and events handler
    """
    
    http_method = event.get('httpMethod', '').upper()
    path = event.get('path', '')
    
    # Handle CORS preflight
    if http_method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': create_cors_headers(),
            'body': ''
        }
    
    # Extract user_id from path if present
    path_params = event.get("pathParameters") or {}
    user_id = path_params.get("user_id")
    
    if path == '/calendar/sync' and http_method == 'POST':
        return handle_calendar_sync(event, context)
    elif path and '/calendar/events' in path and http_method == 'GET':
        return handle_get_events(event, context, user_id)
    
    return create_error_response(404, 'Not found')


def handle_calendar_sync(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Sync Google Calendar data
    TODO: Implement Google Calendar API integration
    """
    return create_json_response(200, {
        'message': 'Calendar sync - to be implemented',
        'synced': False
    })


def handle_get_events(event: Dict[str, Any], context: Any, user_id: str = None) -> Dict[str, Any]:
    """
    Get upcoming calendar events from Google Calendar
    """
    try:
        if not user_id:
            # Try to get from path params if not passed
            path_params = event.get("pathParameters") or {}
            user_id = path_params.get("user_id")
        
        if not user_id:
            return create_error_response(400, "User ID is required")
        
        # Get user's Google tokens
        dynamodb_service = DynamoDBService()
        user = dynamodb_service.get_user(user_id)
        if not user:
            return create_error_response(404, "User not found")
        
        google_tokens = user.get("google_tokens")
        if not google_tokens or not isinstance(google_tokens, dict):
            return create_error_response(400, "Google Calendar is not connected")
        
        if not google_tokens.get("refresh_token"):
            return create_error_response(400, "Google Calendar connection is incomplete (missing refresh token)")
        
        # Get upcoming events
        calendar_service = GoogleCalendarService()
        events, refreshed_tokens = calendar_service.list_upcoming_events(
            google_tokens,
            max_results=10,
        )
        
        # Persist refreshed tokens if any
        if refreshed_tokens:
            dynamodb_service.update_user(user_id, {"google_tokens": refreshed_tokens})
        
        # Get user's friends to match attendees
        friends_service = FriendsService()
        friends = friends_service.list_friends(user_id)
        
        # Build a map of email -> friend info for quick lookup
        email_to_friend = {}
        for friend in friends:
            emails = friend.get("emails", [])
            for email in emails:
                if isinstance(email, str) and email.strip():
                    email_to_friend[email.strip().lower()] = friend
        
        # Helper to check if a string looks like a phone number
        def is_phone_number(text: str) -> bool:
            if not text or not isinstance(text, str):
                return False
            # Check if it starts with + or contains phone-like patterns
            text_clean = text.strip()
            if text_clean.startswith("+"):
                return True
            # Check for patterns like "34 637-213-975" or similar
            phone_pattern = r'[\d\s\-\(\)]{10,}'
            if re.search(phone_pattern, text_clean):
                return True
            return False
        
        # Helper to get friend name from attendees
        def get_friend_name_from_attendees(attendees: list, user_email: str) -> str:
            user_email_lower = user_email.lower() if user_email else ""
            for att in attendees:
                att_email = att.get("email", "").lower()
                if att_email and att_email != user_email_lower:
                    friend = email_to_friend.get(att_email)
                    if friend:
                        # Prefer display_name, then name from linked user, then email
                        display_name = friend.get("display_name")
                        if display_name and isinstance(display_name, str) and display_name.strip():
                            # Don't use phone numbers as display names
                            if not is_phone_number(display_name):
                                return display_name.strip()
                        # Try to get name from linked user
                        linked_user_id = friend.get("linked_user_id")
                        if linked_user_id:
                            linked_user = dynamodb_service.get_user(linked_user_id)
                            if linked_user:
                                name = linked_user.get("name")
                                if name and isinstance(name, str) and name.strip() and not is_phone_number(name):
                                    return name.strip()
                        # Fallback to email
                        if att_email:
                            return att_email.split("@")[0]
            return None
        
        # Get user's email for filtering
        user_email = user.get("email", "")
        
        # Filter for events created by Meaningful app only
        # Format events for frontend
        formatted_events = []
        for event in events:
            # Only include events created by the Meaningful app
            # Check extended properties first (most reliable)
            extended_props = event.get("extendedProperties", {})
            private_props = extended_props.get("private", {})
            is_meaningful_event = private_props.get("meaningful") == "true"
            
            # Fallback: check description for "Planned via Meaningful"
            if not is_meaningful_event:
                description = event.get("description", "")
                is_meaningful_event = "Planned via Meaningful" in description
            
            if not is_meaningful_event:
                continue
            
            # Only include events that have attendees (scheduled calls with friends)
            attendees = event.get("attendees", [])
            if not attendees:
                continue
            
            start = event.get("start", {})
            end = event.get("end", {})
            
            # Get event summary and fix it if it contains a phone number
            event_summary = event.get("summary", "Untitled Event")
            if is_phone_number(event_summary):
                # Try to get friend name from attendees
                friend_name = get_friend_name_from_attendees(attendees, user_email)
                if friend_name:
                    event_summary = f"Catch up with {friend_name}"
                else:
                    # Fallback: use first attendee's email
                    for att in attendees:
                        att_email = att.get("email", "")
                        if att_email and att_email.lower() != user_email.lower():
                            event_summary = f"Catch up with {att_email.split('@')[0]}"
                            break
            
            formatted_events.append({
                "id": event.get("id"),
                "summary": event_summary,
                "start": start.get("dateTime") or start.get("date"),
                "end": end.get("dateTime") or end.get("date"),
                "htmlLink": event.get("htmlLink"),
                "hangoutLink": event.get("hangoutLink"),
                "attendees": [
                    {
                        "email": att.get("email"),
                        "displayName": att.get("displayName"),
                        "responseStatus": att.get("responseStatus", "needsAction"),
                    }
                    for att in attendees
                ],
            })
        
        return create_json_response(200, {
            "events": formatted_events,
        })
    except ValueError as exc:
        return create_error_response(400, str(exc))
    except Exception as exc:
        return create_error_response(500, "Failed to fetch calendar events", str(exc))