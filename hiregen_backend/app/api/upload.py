from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from app.api.deps import get_current_user
from app.models.models import User
from app.services.minio_service import minio_service

router = APIRouter(
    prefix="/api/upload",
    tags=["Upload"]
)

@router.post("")
async def upload_file_api(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    try:
        # Giới hạn dung lượng (tùy chọn) hoặc để config mặc định của FastAPI
        file_data = await file.read()
        
        object_name = minio_service.build_unique_object_name(
            prefix="uploads",
            owner_id=str(current_user.id),
            filename=file.filename,
        )
        
        # Đẩy file lên MinIO
        file_url = minio_service.upload_file(
            object_name=object_name,
            file_data=file_data,
            content_type=file.content_type
        )
        
        return {"url": file_url}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi upload file: {str(e)}")
