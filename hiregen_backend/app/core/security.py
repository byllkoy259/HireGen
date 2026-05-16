from datetime import datetime, timedelta
from typing import Any, Union
import jwt
from app.core.config import settings
from passlib.context import CryptContext

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES

# Khởi tạo CryptContext chỉ định thuật toán bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Hàm xử lý mật khẩu
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Kiểm tra mật khẩu người dùng nhập vào có khớp với mã băm trong Database hay không.
    """
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """
    Biến mật khẩu gốc thành chuỗi mã băm (hash) không thể đảo ngược.
    """
    return pwd_context.hash(password)

# Hàm xử lý token (JWT)
def create_access_token(subject: Union[str, Any], expires_delta: timedelta = None) -> str:
    """
    Tạo JWT Token. 
    subject: Thường là user_id hoặc email để định danh người dùng.
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES * 24 * 7)
        
    # Payload: Nội dung được giấu bên trong Token
    to_encode = {"exp": expire, "sub": str(subject)}
    
    # Ký và mã hóa Token bằng SECRET_KEY
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt