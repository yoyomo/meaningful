"""
Environment variable utilities
"""

# Load environment variables from .env file for local development
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # dotenv not available, skip (will work in Lambda without it)
    pass