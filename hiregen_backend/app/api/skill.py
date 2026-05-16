from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.models.models import ItssSkill
from app.schemas.skill import ItssSkillResponse

router = APIRouter(
    prefix="/api/skills",
    tags=["Skills"]
)

@router.get("/", response_model=List[ItssSkillResponse])
async def get_all_itss_skills(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ItssSkill))
    return result.scalars().all()