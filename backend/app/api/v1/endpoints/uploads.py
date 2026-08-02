from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.api.deps import get_current_user
from app.core.storage import UploadKind, upload_to_s3
from app.models.user import User

router = APIRouter()


@router.post("/")
def create_upload(
    file: UploadFile = File(...),
    kind: UploadKind = Form(...),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    url = upload_to_s3(file, kind, current_user.id)
    return {"url": url}
