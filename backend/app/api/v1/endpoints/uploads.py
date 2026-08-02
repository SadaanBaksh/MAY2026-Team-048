from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.api.deps import get_current_user
from app.api.response_docs import PAYLOAD_TOO_LARGE, UNAUTHORIZED, UNSUPPORTED_MEDIA_TYPE
from app.core.storage import UploadKind, upload_to_s3
from app.models.user import User

router = APIRouter()


@router.post("/", responses={**UNAUTHORIZED, **PAYLOAD_TOO_LARGE, **UNSUPPORTED_MEDIA_TYPE})
def create_upload(
    file: UploadFile = File(...),
    kind: UploadKind = Form(...),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    url = upload_to_s3(file, kind, current_user.id)
    return {"url": url}
