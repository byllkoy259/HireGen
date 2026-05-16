import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.models import User, Company, JobDescription, ItssSkill, JDSkill
from app.schemas.job import JobCreate, JobUpdate, JobResponse
from app.schemas.skill import JDSkillCreate, JDSkillResponse
from app.api.deps import get_current_hr

router = APIRouter(
    prefix="/api/jobs",
    tags=["Job Descriptions"]
)

# 1. API lấy danh sách công việc mở
@router.get("/public", response_model=List[JobResponse])
async def get_public_jobs(db: AsyncSession = Depends(get_db)):
    query = (
        select(JobDescription)
        .options(selectinload(JobDescription.company))
        .where(JobDescription.status == 'open')
    )

    result = await db.execute(query)
    jobs = result.scalars().all()

    response = []

    for job in jobs:
        response.append(
            JobResponse(
                id=job.id,
                hr_id=job.hr_id,
                company_id=job.company_id,
                company_name=job.company.name if job.company else None,
                company_logo_url=job.company.logo_url if job.company else None,
                company_industry=job.company.industry if job.company else None,
                title=job.title,
                description_text=job.description_text,
                location=job.location,
                salary_range=job.salary_range,
                deadline=job.deadline,
                requirements_text=job.requirements_text,
                benefits_text=job.benefits_text,
                visibility=job.visibility,
                itss_category=job.itss_category,
                itss_level=job.itss_level,
                status=job.status,
                created_at=job.created_at
            )
        )

    return response

# 2. API tạo bài tuyển dụng
@router.post("/", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    job_in: JobCreate,
    db: AsyncSession = Depends(get_db),
    current_hr: User = Depends(get_current_hr)
):
    # Bước 1: Kiểm tra quyền phụ trách công ty thông qua hr_representatives (Chống IDOR chuẩn)
    result = await db.execute(
        select(Company).where(
            Company.id == job_in.company_id,
            Company.hr_representatives.any(User.id == current_hr.id)
        )
    )
    company = result.scalars().first()
    
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy công ty, hoặc bạn không có quyền đăng tuyển hộ đối tác này."
        )

    # Bước 2: Khởi tạo và lưu Job (Sử dụng model_dump để mapping tự động toàn bộ các trường mới)
    new_job = JobDescription(
        hr_id=current_hr.id,
        **job_in.model_dump()
    )

    db.add(new_job)
    await db.commit()
    await db.refresh(new_job)

    return new_job

# 3. API lấy danh sách job của bản thân tạo ra
@router.get("/me", response_model=List[JobResponse])
async def get_my_jobs(
    db: AsyncSession = Depends(get_db),
    current_hr: User = Depends(get_current_hr)
):
    result = await db.execute(
        select(JobDescription).where(JobDescription.hr_id == current_hr.id)
    )
    jobs = result.scalars().all()
    return jobs

# 4. API lấy chi tiết 1 job
@router.get("/{job_id}", response_model=JobResponse)
async def get_job_detail(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_hr: User = Depends(get_current_hr)
):
    result = await db.execute(
        select(JobDescription).where(
            JobDescription.id == job_id,
            JobDescription.hr_id == current_hr.id
        )
    )
    job = result.scalars().first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Không tìm thấy Job hoặc bạn không có quyền xem.")
    return job

# 5. API cập nhật Job
@router.put("/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: uuid.UUID,
    job_in: JobUpdate,
    db: AsyncSession = Depends(get_db),
    current_hr: User = Depends(get_current_hr)
):
    result = await db.execute(
        select(JobDescription).where(
            JobDescription.id == job_id,
            JobDescription.hr_id == current_hr.id
        )
    )
    job = result.scalars().first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Không tìm thấy Job hoặc bạn không có quyền sửa.")

    update_data = job_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(job, field, value)

    await db.commit()
    await db.refresh(job)
    return job

# 6. API xóa Job
@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_hr: User = Depends(get_current_hr)
):
    result = await db.execute(
        select(JobDescription).where(
            JobDescription.id == job_id,
            JobDescription.hr_id == current_hr.id
        )
    )
    job = result.scalars().first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Không tìm thấy Job hoặc bạn không có quyền xóa.")

    await db.delete(job)
    await db.commit()
    
    return None

# 7. API gán kỹ năng vào Job
@router.post("/{job_id}/skills", response_model=JDSkillResponse, status_code=status.HTTP_201_CREATED)
async def add_skill_to_job(
    job_id: uuid.UUID,
    skill_in: JDSkillCreate,
    db: AsyncSession = Depends(get_db),
    current_hr: User = Depends(get_current_hr)
):
    job_result = await db.execute(
        select(JobDescription).where(
            JobDescription.id == job_id,
            JobDescription.hr_id == current_hr.id
        )
    )
    job = job_result.scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="Job không tồn tại hoặc bạn không có quyền sửa Job này.")

    skill_result = await db.execute(select(ItssSkill).where(ItssSkill.id == skill_in.skill_id))
    if not skill_result.scalars().first():
        raise HTTPException(status_code=404, detail="Kỹ năng không hợp lệ (Không có trong từ điển ITSS).")

    existing_jd_skill = await db.execute(
        select(JDSkill).where(JDSkill.job_id == job_id, JDSkill.skill_id == skill_in.skill_id)
    )
    if existing_jd_skill.scalars().first():
        raise HTTPException(status_code=400, detail="Kỹ năng này đã được gán cho vị trí này rồi.")

    new_jd_skill = JDSkill(
        job_id=job_id,
        skill_id=skill_in.skill_id,
        importance_level=skill_in.importance_level
    )
    db.add(new_jd_skill)
    await db.commit()
    await db.refresh(new_jd_skill)
    return new_jd_skill