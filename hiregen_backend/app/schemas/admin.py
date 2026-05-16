from pydantic import BaseModel, EmailStr, ConfigDict
import uuid
from datetime import datetime
from typing import Optional, List
from app.schemas.company import CompanyResponse

class RoleUpdate(BaseModel):
    role: str

class HRCreateByAdmin(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    company_ids: List[str]

class HRUpdateByAdmin(BaseModel):
    is_verified: Optional[bool] = None
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    company_ids: Optional[List[str]] = None
    password: Optional[str] = None

class HRAccountResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    avatar_url: Optional[str] = None
    is_verified: bool
    created_at: datetime
    companies: List[CompanyResponse]

    model_config = ConfigDict(from_attributes=True)