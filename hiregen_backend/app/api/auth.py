from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.security import get_password_hash, verify_password, create_access_token
from app.api.deps import get_current_user
from app.core.config import settings
from app.models.models import User, Candidate, HRProfile, AdminProfile
from app.schemas.user import UserCreate, UserLogin, UserResponse, UserUpdateMe

ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES

# Khởi tạo Router cho cụm Authentication
router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)

# API Register
@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    # Bước 1: Kiểm tra xem email đã tồn tại chưa
    result = await db.execute(select(User).where(User.email == user_in.email))
    existing_user = result.scalars().first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email này đã được đăng ký trong hệ thống."
        )

    # Bước 2: Băm mật khẩu
    hashed_password = get_password_hash(user_in.password)

    # Bước 3: Khởi tạo User mới 
    new_user = User(
        email=user_in.email,
        password_hash=hashed_password,
        role=user_in.role,
        is_verified=True # Tạm thời cho phép đăng nhập ngay lập tức
    )

    # Bước 4: Lưu xuống Database
    db.add(new_user)
    await db.flush()

    if user_in.role == "HR":
        new_profile = HRProfile(
            user_id=new_user.id,
            full_name=user_in.full_name
        )
        db.add(new_profile)
    
    elif user_in.role == "Candidate":
        new_profile = Candidate(
            user_id=new_user.id,
            full_name=user_in.full_name
        )
        db.add(new_profile)

    await db.commit()
    await db.refresh(new_user)

    return new_user

# API Login
@router.post("/login")
async def login_user(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    # Bước 1: Tìm User theo email
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalars().first()

    # Bước 2: Xác thực email và mật khẩu
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không chính xác.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    # Bước 2.5: Kiểm tra xem tài khoản có bị khóa không
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.",
        )

    # Bước 3: Tạo JWT Token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES * 24 * 7)
    access_token = create_access_token(
        subject=str(user.id), 
        expires_delta=access_token_expires
    )

    # Bước 4: Trả về Token và thông tin User
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_info": {
            "id": str(user.id),
            "email": user.email,
            "role": user.role
        }
    }

# API lấy thông tin User đang đăng nhập
@router.get("/me")
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    name_to_display = ""
    avatar_to_display = ""

    # Nếu là Admin, tìm tên trong bảng admin_profiles
    if current_user.role == "Admin":
        result = await db.execute(select(AdminProfile).where(AdminProfile.user_id == current_user.id))
        profile = result.scalars().first()
        if profile:
            name_to_display = profile.full_name
            avatar_to_display = profile.avatar_url

    # Nếu là HR, tìm tên trong bảng hr_profiles
    elif current_user.role == "HR":
        result = await db.execute(select(HRProfile).where(HRProfile.user_id == current_user.id))
        profile = result.scalars().first()
        if profile:
            name_to_display = profile.full_name
            avatar_to_display = profile.avatar_url
            
    # Nếu là Candidate, tìm tên trong bảng candidates
    elif current_user.role == "Candidate":
        result = await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))
        profile = result.scalars().first()
        if profile:
            name_to_display = profile.full_name
            avatar_to_display = profile.avatar_url

    # Nếu chưa có Profile, dùng tạm phần đầu email
    if not name_to_display:
        name_to_display = current_user.email.split('@')[0]

    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "role": current_user.role,
        "full_name": name_to_display,
        "avatar_url": avatar_to_display
    }

@router.put("/me")
async def update_my_profile(
    data_in: UserUpdateMe,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role == "Admin":
        result = await db.execute(select(AdminProfile).where(AdminProfile.user_id == current_user.id))
        profile = result.scalars().first()
        if not profile:
            profile = AdminProfile(user_id=current_user.id)
            db.add(profile)
        
        if data_in.display_name is not None:
            profile.full_name = data_in.display_name
        if data_in.avatar_url is not None:
            profile.avatar_url = data_in.avatar_url
            
        await db.commit()
        return {"msg": "Cập nhật thành công"}
    else:
        raise HTTPException(status_code=403, detail="Cập nhật tài khoản chỉ hỗ trợ cho Admin qua endpoint này.")