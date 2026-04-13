from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.contacts import router as contacts_router
from app.routers.campaigns import router as campaigns_router
from app.routers.calls import router as calls_router
from app.routers.webhook import router as webhook_router

__all__ = [
    "auth_router", "users_router", "contacts_router",
    "campaigns_router", "calls_router", "webhook_router",
]
