import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

class JobBase(BaseModel):
    title: str = Field(..., max_length=255, description="Tiêu đề công việc")
    description_text: str = Field(..., description="Nội dung công việc")
    location: Optional[str] = None
    salary_range: Optional[str] = None
    deadline: Optional[datetime] = None
    requirements_text: Optional[str] = None
    benefits_text: Optional[str] = None
    visibility: Optional[str] = "public"
    itss_category: Optional[str] = None
    itss_level: Optional[int] = None
    status: Optional[str] = "open"

class JobCreate(JobBase):
    company_id: uuid.UUID 

class JobUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255, description="Tiêu đề công việc")
    description_text: Optional[str] = Field(None, description="Nội dung công việc")
    location: Optional[str] = None
    salary_range: Optional[str] = None
    deadline: Optional[datetime] = None
    requirements_text: Optional[str] = None
    benefits_text: Optional[str] = None
    visibility: Optional[str] = Field(None, description="public hoặc private")
    itss_category: Optional[str] = None
    itss_level: Optional[int] = None
    status: Optional[str] = Field(None, description="open hoặc closed")

class JobResponse(JobBase):
    id: uuid.UUID
    hr_id: uuid.UUID
    company_id: uuid.UUID
    company_name: Optional[str] = None
    company_logo_url: Optional[str] = None
    company_industry: Optional[str] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
