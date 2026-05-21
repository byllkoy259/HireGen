import uuid
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field

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
    cover_letter: Optional[str] = None
    status: str
    match_score: Optional[float] = None
    embedding_match_score: Optional[float] = None
    llm_match_score: Optional[float] = None
    final_match_score: Optional[float] = None
    scoring_method: Optional[str] = None
    ai_status: Optional[str] = None
    ai_error: Optional[str] = None
    ai_processed_at: Optional[datetime] = None
    report_source: Optional[str] = None
    extracted_data: Optional[dict[str, Any]] = None
    evaluation_result: Optional[dict[str, Any]] = None
    applied_at: datetime
    
    candidate: CandidateShortInfo
    resume: ResumeShortInfo

    model_config = ConfigDict(from_attributes=True)

class ApplicationStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(pending|reviewing|shortlisted|interviewing|rejected|hired|accepted)$")
