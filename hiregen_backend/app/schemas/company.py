import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

class CompanyBase(BaseModel):
    name: str = Field(..., max_length=255, description="Tên công ty khách hàng")
    website: Optional[str] = Field(None, max_length=255, description="Website công ty")
    description: Optional[str] = Field(None, description="Mô tả về công ty")
    industry: Optional[str] = Field(None, description="Ngành nghề hoạt động")
    logo_url: Optional[str] = Field(None, max_length=255, description="URL logo công ty")

class CompanyCreate(CompanyBase):
    pass

class CompanyUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255, description="Tên công ty khách hàng")
    website: Optional[str] = Field(None, max_length=255, description="Website công ty")
    description: Optional[str] = Field(None, description="Mô tả về công ty")
    industry: Optional[str] = Field(None, description="Ngành nghề hoạt động")
    logo_url: Optional[str] = Field(None, max_length=255, description="URL logo công ty")
    
class CompanyResponse(CompanyBase):
    id: uuid.UUID
    hr_count: int = 0
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)