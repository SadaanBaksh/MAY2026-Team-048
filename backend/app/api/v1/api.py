from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin,
    apartments,
    ai,
    auth,
    categories,
    comments,
    exports,
    notifications,
    notices,
    public_services,
    tickets,
    uploads,
    users,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(exports.router, prefix="/exports", tags=["exports"])
api_router.include_router(apartments.router, prefix="/apartments", tags=["apartments"])
api_router.include_router(categories.router, prefix="/categories", tags=["categories"])
api_router.include_router(tickets.router, prefix="/tickets", tags=["tickets"])
api_router.include_router(comments.router, prefix="/tickets", tags=["comments"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(notices.router, prefix="/notices", tags=["notices"])
api_router.include_router(
    public_services.router, prefix="/public-services", tags=["public-services"]
)
api_router.include_router(uploads.router, prefix="/uploads", tags=["uploads"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
