from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from middleware.role_guard import get_current_user_with_roles
from models.user import User, UserRole
from services.storage_service import storage_service

router = APIRouter(prefix="/api", tags=["Upload"])

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user_with_roles([UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENTS])),
):
    """Accepts image file and stores to object storage, returns URL."""
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB)")
    try:
        filename = file.filename or "upload"
        url = await storage_service.upload_file(content, filename, file.content_type or "application/octet-stream")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")
    return {"url": url, "mediaType": file.content_type} 