from typing import Optional

from pydantic import BaseModel

class CVExtractRequest(BaseModel):
    cv_text: str
    jd_text: Optional[str] = None

class AIMatchRequest(BaseModel):
    cv_text: str
    jd_text: str

class AIExtractResponse(BaseModel):
    status: str
    extracted_data: dict

class AIMatchResponse(BaseModel):
    status: str
    matching_score: float
    algorithm: str
