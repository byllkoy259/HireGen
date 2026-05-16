import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.security import SECRET_KEY, ALGORITHM
from app.models.models import User

# 1. Khai báo mồi nhử cho Swagger UI
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# 2. Hàm xác thực người dùng
async def get_current_user(
    token: str = Depends(oauth2_scheme), 
    db: AsyncSession = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Không thể xác thực thông tin (Token không hợp lệ hoặc đã hết hạn).",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Bóc tách Token bằng SECRET_KEY
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.PyJWTError: # Bắt mọi lỗi liên quan đến giải mã Token
        raise credentials_exception

    # Chui vào Database tìm xem User có tồn tại không (Async SQLAlchemy 2.0)
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()

    if user is None:
        raise credentials_exception
        
    return user

# 3. Hàm phân quyền chuyên sâu
async def get_current_hr(
    current_user: User = Depends(get_current_user)
) -> User:
    # Nếu Role không phải là HR, lập tức đá văng ra ngoài
    if current_user.role != "HR":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Không đủ quyền truy cập. Chức năng này chỉ dành cho Agency/HR."
        )
    return current_user

# 4. Hàm phân quyền quản trị
async def get_current_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    if current_user.role != "Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Không đủ quyền truy cập. Chức năng này chỉ dành cho Admin."
        )
    return current_user