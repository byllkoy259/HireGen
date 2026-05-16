import uuid
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

# 1. CV
class EducationItem(BaseModel):
    school_name: str
    major: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    description: Optional[str] = None

class ExperienceItem(BaseModel):
    company_name: str
    position: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    description: Optional[str] = None

class ProjectItem(BaseModel):
    project_name: str
    role: str
    technologies: Optional[str] = None
    description: Optional[str] = None

class CertificationItem(BaseModel):
    name: str
    issuer: Optional[str] = None
    year: Optional[str] = None

class ResumeBase(BaseModel):
    # Tạm thời Frontend sẽ gửi link file (sau khi đã upload lên S3/MinIO hoặc local)
    cv_url: str = Field(..., max_length=255, description="Đường dẫn file PDF CV đã upload")
    is_primary: Optional[bool] = Field(True, description="Đánh dấu đây là CV chính")

class ResumeCreate(ResumeBase):
    pass

class ResumeResponse(ResumeBase):
    id: uuid.UUID
    candidate_id: uuid.UUID
    
    extracted_text: Optional[str] = None
    itss_category_predicted: Optional[str] = None
    itss_level_predicted: Optional[int] = None
    
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# 2. Ứng tuyển
class ApplicationBase(BaseModel):
    job_id: uuid.UUID = Field(..., description="ID của công việc muốn ứng tuyển")
    resume_id: uuid.UUID = Field(..., description="ID của CV dùng để ứng tuyển")

class ApplicationCreate(ApplicationBase):
    application_type: str = Field("applied", pattern="^(applied|invited)$")

class ApplicationResponse(ApplicationBase):
    id: uuid.UUID
    candidate_id: uuid.UUID
    application_type: str
    status: str
    
    match_score: Optional[float] = None 
    applied_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CompanyShortInfo(BaseModel):
    name: str
    logo_url: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class JobShortInfo(BaseModel):
    title: str
    location: Optional[str] = None
    company: CompanyShortInfo
    model_config = ConfigDict(from_attributes=True)

class CandidateApplicationListResponse(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    resume_id: uuid.UUID
    application_type: str
    status: str
    applied_at: datetime
    job: JobShortInfo
    resume: Optional[ResumeResponse] = None

    model_config = ConfigDict(from_attributes=True)

# 3. Thông tin ứng viên
class CandidateProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, max_length=255, description="Họ và tên")
    avatar_url: Optional[str] = Field(None, max_length=255, description="Đường dẫn ảnh đại diện")
    about_me: Optional[str] = Field(None, description="Giới thiệu bản thân")
    phone: Optional[str] = Field(None, max_length=50, description="Số điện thoại")
    date_of_birth: Optional[date] = Field(None, description="Ngày tháng năm sinh (YYYY-MM-DD)")
    address: Optional[str] = Field(None, max_length=255, description="Địa chỉ hiện tại")
    years_of_experience: Optional[float] = Field(None, ge=0, description="Số năm kinh nghiệm")
    desired_position: Optional[str] = Field(None, max_length=255, description="Vị trí mong muốn")
    github_url: Optional[str] = Field(None, max_length=255, description="Đường dẫn github")
    linkedin_url: Optional[str] = Field(None, max_length=255, description="Đường dẫn linkedin")
    portfolio_url: Optional[str] = Field(None, max_length=255, description="Đường dẫn portfolio")
    
    tech_skills: Optional[List[str]] = None
    soft_skills: Optional[List[str]] = None
    education: Optional[List[EducationItem]] = None
    work_experience: Optional[List[ExperienceItem]] = None
    projects: Optional[List[ProjectItem]] = None
    certifications: Optional[List[CertificationItem]] = None
    

class CandidateProfileResponse(CandidateProfileUpdate):
    user_id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)