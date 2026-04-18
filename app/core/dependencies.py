"""
VoiceAgent — Auth Dependencies (Auth-Free Mode)
All endpoints are publicly accessible. No JWT required.
"""

from app.db.models import User
import uuid

# A fixed system user ID used for all data operations
SYSTEM_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


def get_current_user() -> User:
    return User(
        id=SYSTEM_USER_ID,
        email="system@voiceagent.local",
        name="System",
        provider="system",
        password_hash=None,
        avatar_url=None,
    )

async def get_user_from_token(token: str, db) -> User:
    """Legacy compatibility shim — always returns the system user."""
    return get_current_user()