from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.models import User, HRProfile
from app.schemas.hr import HRProfileUpdate

router = APIRouter(
    prefix="/api/hr",
    tags=["HR"]
)

@router.get("/profile")
async def get_hr_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != "HR":
        raise HTTPException(status_code=403, detail="Chỉ HR mới có thể xem hồ sơ này.")
        
    result = await db.execute(select(HRProfile).where(HRProfile.user_id == current_user.id))
    profile = result.scalars().first()
    
    if not profile:
        # Tự động tạo nếu chưa có
        profile = HRProfile(user_id=current_user.id, full_name=current_user.email.split('@')[0])
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
        
    return {
        "full_name": profile.full_name,
        "phone_number": profile.phone_number,
        "department": profile.department,
        "position": profile.position,
        "avatar_url": profile.avatar_url
    }

@router.put("/profile")
async def update_hr_profile(
    data_in: HRProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != "HR":
        raise HTTPException(status_code=403, detail="Chỉ HR mới có thể cập nhật hồ sơ này.")
        
    result = await db.execute(select(HRProfile).where(HRProfile.user_id == current_user.id))
    profile = result.scalars().first()
    
    if not profile:
        profile = HRProfile(user_id=current_user.id, full_name=current_user.email.split('@')[0])
        db.add(profile)
        
    if data_in.full_name is not None:
        profile.full_name = data_in.full_name
    if data_in.phone_number is not None:
        profile.phone_number = data_in.phone_number
    if data_in.department is not None:
        profile.department = data_in.department
    if data_in.position is not None:
        profile.position = data_in.position
    if data_in.avatar_url is not None:
        profile.avatar_url = data_in.avatar_url
        
    await db.commit()
    
    return {"msg": "Cập nhật hồ sơ HR thành công"}
