import uuid
from pydantic import BaseModel, Field, ConfigDict

class ItssSkillResponse(BaseModel):
    id: uuid.UUID
    skill_name: str
    category: str
    
    model_config = ConfigDict(from_attributes=True)

class JDSkillBase(BaseModel):
    skill_id: uuid.UUID = Field(..., description="ID của kỹ năng từ bảng itss_skills")
    # Ép buộc HR chỉ được chọn độ quan trọng từ 1 đến 5 theo đúng Database Constraint
    importance_level: int = Field(..., ge=1, le=5, description="Mức độ quan trọng (1-5)")

class JDSkillCreate(JDSkillBase):
    pass

class JDSkillResponse(JDSkillBase):
    job_id: uuid.UUID
    
    model_config = ConfigDict(from_attributes=True)