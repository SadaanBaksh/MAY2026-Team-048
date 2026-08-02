from fastapi import APIRouter

from app.api.v1.endpoints import (
    apartments,
    ai,
    auth,
    categories,
    comments,
    notifications,
    tickets,
    uploads,
    users,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(apartments.router, prefix="/apartments", tags=["apartments"])
api_router.include_router(categories.router, prefix="/categories", tags=["categories"])
api_router.include_router(tickets.router, prefix="/tickets", tags=["tickets"])
api_router.include_router(comments.router, prefix="/tickets", tags=["comments"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(uploads.router, prefix="/uploads", tags=["uploads"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
