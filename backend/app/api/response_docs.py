"""Shared OpenAPI `responses=` fragments.

FastAPI only auto-documents the success status code plus 422 (request validation
errors) for each route. Everything else a route can actually return - 401 from
get_current_user, 403 from a role check, 404 from a lookup, etc. - has to be
declared explicitly via the route decorator's `responses=` kwarg or it silently
stays undocumented, even though the code genuinely returns it. These fragments
exist so that declaring accurate docs is a one-line merge, not copy-pasted
description strings scattered across 8 files.
"""

UNAUTHORIZED = {401: {"description": "Missing, invalid, or expired bearer token"}}
FORBIDDEN = {403: {"description": "Caller does not have permission to perform this action"}}
NOT_FOUND = {404: {"description": "Resource not found"}}
CONFLICT = {400: {"description": "Request conflicts with existing data (e.g. duplicate email/phone)"}}
RATE_LIMITED = {429: {"description": "Too many requests - rate limit exceeded"}}
PAYLOAD_TOO_LARGE = {413: {"description": "Uploaded file exceeds the allowed size limit"}}
UNSUPPORTED_MEDIA_TYPE = {415: {"description": "Uploaded file's content type is not supported"}}
SERVICE_UNAVAILABLE = {
    503: {"description": "The AI service is temporarily unavailable or returned an invalid response"}
}
