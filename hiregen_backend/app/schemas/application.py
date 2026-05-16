import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, Field

class CandidateShortInfo(BaseModel):
    full_name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    avatar_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class ResumeShortInfo(BaseModel):
    cv_url: str
    is_primary: bool
    model_config = ConfigDict(from_attributes=True)

class ApplicationDetailResponse(BaseModel):
    id: uuid.UUID
    candidate_id: uuid.UUID
    job_id: uuid.UUID
    application_type: str
    status: str
    match_score: Optional[float] = None
    applied_at: datetime
    
    candidate: CandidateShortInfo
    resume: ResumeShortInfo

    model_config = ConfigDict(from_attributes=True)

class ApplicationStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(pending|processed|reviewing|interviewing|rejected|hired)$")