import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class InterviewCreate(BaseModel):
    application_id: uuid.UUID
    scheduled_time: datetime
    meeting_link: Optional[str] = None
    notes: Optional[str] = None

class InterviewResponse(InterviewCreate):
    id: uuid.UUID
    hr_id: uuid.UUID
    status: str
    
    model_config = ConfigDict(from_attributes=True)