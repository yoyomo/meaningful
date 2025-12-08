import os
from typing import Optional, Dict, Any
from utils.logs import log_error, log_success

# Try to import Twilio, but make it optional for development
try:
    from twilio.rest import Client
    TWILIO_AVAILABLE = True
except ImportError:
    TWILIO_AVAILABLE = False
    log_error("Twilio not installed. SMS features will be disabled. Install with: pip install twilio")


class SMSService:
    """
    Service for sending SMS messages via Twilio.
    Falls back gracefully if Twilio is not configured.
    """
    
    def __init__(self):
        self.account_sid = os.environ.get('TWILIO_ACCOUNT_SID')
        self.auth_token = os.environ.get('TWILIO_AUTH_TOKEN')
        self.from_number = os.environ.get('TWILIO_PHONE_NUMBER')
        
        self.enabled = (
            TWILIO_AVAILABLE and
            self.account_sid and
            self.auth_token and
            self.from_number
        )
        
        if self.enabled:
            self.client = Client(self.account_sid, self.auth_token)
            log_success("SMS service enabled with Twilio")
        else:
            self.client = None
            if not TWILIO_AVAILABLE:
                log_error("SMS service disabled: Twilio library not installed")
            elif not self.account_sid or not self.auth_token:
                log_error("SMS service disabled: Twilio credentials not configured")
            elif not self.from_number:
                log_error("SMS service disabled: TWILIO_PHONE_NUMBER not set")
    
    def send_verification_code(self, phone_number: str, code: str) -> bool:
        """
        Send SMS verification code to phone number.
        Returns True if sent successfully, False otherwise.
        """
        if not self.enabled:
            log_error(f"SMS service disabled - cannot send verification code to {phone_number}")
            return False
        
        try:
            message = self.client.messages.create(
                body=f"Your Meaningful verification code is: {code}. This code expires in 10 minutes.",
                from_=self.from_number,
                to=phone_number
            )
            log_success(f"Verification code sent to {phone_number} (SID: {message.sid})")
            return True
        except Exception as e:
            log_error(f"Failed to send SMS to {phone_number}: {e}")
            return False
    
    def send_calendar_invite(
        self,
        phone_number: str,
        friend_name: str,
        start_time: str,
        end_time: str,
        title: Optional[str] = None,
        notes: Optional[str] = None
    ) -> bool:
        """
        Send calendar invite via SMS when Google Calendar is not available.
        Returns True if sent successfully, False otherwise.
        """
        if not self.enabled:
            log_error(f"SMS service disabled - cannot send calendar invite to {phone_number}")
            return False
        
        try:
            # Format the time nicely
            from datetime import datetime
            try:
                start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
                time_str = start_dt.strftime("%B %d at %I:%M %p")
            except:
                time_str = start_time
            
            event_title = title or f"Catch up with {friend_name}"
            message = (
                f"📅 Meaningful: {event_title}\n"
                f"📅 When: {time_str}\n"
                f"{f'📝 {notes}' if notes else ''}\n"
                f"Add this to your calendar manually."
            )
            
            sms_message = self.client.messages.create(
                body=message,
                from_=self.from_number,
                to=phone_number
            )
            log_success(f"Calendar invite SMS sent to {phone_number} (SID: {sms_message.sid})")
            return True
        except Exception as e:
            log_error(f"Failed to send calendar invite SMS to {phone_number}: {e}")
            return False
    
    def send_meeting_reminder(
        self,
        phone_number: str,
        friend_name: str,
        start_time: str,
        title: Optional[str] = None
    ) -> bool:
        """
        Send meeting reminder via SMS.
        Returns True if sent successfully, False otherwise.
        """
        if not self.enabled:
            log_error(f"SMS service disabled - cannot send reminder to {phone_number}")
            return False
        
        try:
            from datetime import datetime
            try:
                start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                time_str = start_dt.strftime("%B %d at %I:%M %p")
            except:
                time_str = start_time
            
            event_title = title or f"Catch up with {friend_name}"
            message = (
                f"⏰ Reminder: {event_title} with {friend_name}\n"
                f"Starts in 10 minutes at {time_str}"
            )
            
            sms_message = self.client.messages.create(
                body=message,
                from_=self.from_number,
                to=phone_number
            )
            log_success(f"Reminder SMS sent to {phone_number} (SID: {sms_message.sid})")
            return True
        except Exception as e:
            log_error(f"Failed to send reminder SMS to {phone_number}: {e}")
            return False


# Singleton instance
_sms_service: Optional[SMSService] = None

def get_sms_service() -> SMSService:
    """Get singleton SMS service instance"""
    global _sms_service
    if _sms_service is None:
        _sms_service = SMSService()
    return _sms_service

