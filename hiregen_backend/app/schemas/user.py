import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict, model_validator

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    full_name: str = Field(..., min_length=3, max_length=100, description="Họ và tên")
    password: str = Field(..., min_length=8, max_length=72)
    confirm_password: str = Field(..., min_length=8, max_length=72)
    role: str = "Candidate"

    @model_validator(mode='after')
    def check_passwords_match(self) -> 'UserCreate':
        if self.password != self.confirm_password:
            raise ValueError("Mật khẩu xác nhận không khớp.")
        return self

class UserLogin(UserBase):
    password: str

class UserResponse(UserBase):
    id: uuid.UUID
    role: str
    is_verified: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

from typing import Optional
class UserUpdateMe(BaseModel):
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None