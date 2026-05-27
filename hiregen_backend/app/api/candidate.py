import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from sqlalchemy.orm import joinedload

from app.core.database import get_db
from app.models.models import User, JobDescription, Resume, Application, Candidate, ResumeSkill
from app.schemas.candidate import (
    ResumeCreate, ResumeResponse, ApplicationCreate, ApplicationResponse, 
    CandidateProfileUpdate, CandidateProfileResponse, CandidateApplicationListResponse
)
from app.api.deps import get_current_user
from app.services.minio_service import minio_service
from app.services.ai.tasks import process_candidate_cv_task

router = APIRouter(
    prefix="/api/candidate",
    tags=["Candidate Operations"]
)

# Hàm tiện ích để đảm bảo Candidate profile luôn tồn tại trước khi thao tác với Resume hoặc Application
async def ensure_candidate_profile_exists(db: AsyncSession, current_user: User) -> Candidate:
    result = await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))
    profile = result.scalars().first()
    
    if not profile:
        # Khởi tạo profile mặc định với các trường JSONB rỗng để tránh lỗi null từ Database
        full_name = current_user.email.split('@')[0] if current_user.email else "Ứng viên"
        profile = Candidate(
            user_id=current_user.id,
            full_name=full_name,
            tech_skills=[],
            soft_skills=[],
            education=[],
            work_experience=[],
            projects=[],
            certifications=[]
        )
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
        
    return profile


# 1. API upload CV (Dạng JSON)
@router.post("/resumes", response_model=ResumeResponse, status_code=status.HTTP_201_CREATED)
async def upload_resume(
    resume_in: ResumeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Đảm bảo profile tồn tại trước để không vi phạm khóa ngoại candidate_id
    await ensure_candidate_profile_exists(db, current_user)
    
    new_resume = Resume(
        candidate_id=current_user.id,
        cv_url=resume_in.cv_url,
        is_primary=resume_in.is_primary,
        status="pending"
    )
    
    db.add(new_resume)
    await db.commit()
    await db.refresh(new_resume)
    
    return new_resume


# 2. API upload file CV trực tiếp từ kho ứng viên (Frontend)
@router.post("/resumes/upload", response_model=ResumeResponse, status_code=status.HTTP_201_CREATED)
async def upload_resume_file_api(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        # Đảm bảo chắc chắn Candidate profile đã tồn tại trước khi chèn Resume
        await ensure_candidate_profile_exists(db, current_user)
        
        file_data = await file.read()
        object_name = minio_service.build_unique_object_name(
            prefix="resumes",
            owner_id=str(current_user.id),
            filename=file.filename,
        )
        
        cv_url = minio_service.upload_file(
            object_name=object_name,
            file_data=file_data,
            content_type=file.content_type
        )
        
        new_resume = Resume(
            candidate_id=current_user.id,
            cv_url=cv_url,
            is_primary=False,
            status="pending"
        )
        
        db.add(new_resume)
        await db.commit()
        await db.refresh(new_resume)
        
        return new_resume
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi xử lý và lưu file CV: {str(e)}")


# 3. API lấy danh sách CV của ứng viên
@router.get("/resumes", response_model=List[ResumeResponse])
async def get_my_resumes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Resume).where(Resume.candidate_id == current_user.id).order_by(Resume.created_at.desc())
    )
    return result.scalars().all()


# 4. API xóa CV của ứng viên
@router.delete("/resumes/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resume(
    resume_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Resume).where(Resume.id == resume_id, Resume.candidate_id == current_user.id)
    )
    resume = result.scalars().first()
    if not resume:
        raise HTTPException(status_code=404, detail="Không tìm thấy CV hoặc bạn không có quyền xóa.")
    
    await db.execute(delete(Application).where(Application.resume_id == resume.id))
    await db.execute(delete(ResumeSkill).where(ResumeSkill.resume_id == resume.id))
    await db.delete(resume)
    await db.commit()
    return None


# 5. API nộp đơn ứng tuyển
@router.post("/applications", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def apply_job(
    application_in: ApplicationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    job_result = await db.execute(select(JobDescription).where(JobDescription.id == application_in.job_id))
    job = job_result.scalars().first()
    if not job or job.status != "open":
        raise HTTPException(status_code=404, detail="Công việc không tồn tại hoặc đã đóng.")

    resume_result = await db.execute(
        select(Resume).where(
            Resume.id == application_in.resume_id,
            Resume.candidate_id == current_user.id
        )
    )
    resume = resume_result.scalars().first()
    if not resume:
        raise HTTPException(status_code=403, detail="Không tìm thấy CV, hoặc bạn không có quyền sử dụng CV này.")

    existing_app_result = await db.execute(
        select(Application).where(
            Application.job_id == application_in.job_id,
            Application.candidate_id == current_user.id
        )
    )
    if existing_app_result.scalars().first():
        raise HTTPException(status_code=400, detail="Bạn đã nộp đơn ứng tuyển cho vị trí này rồi.")

    new_application = Application(
        candidate_id=current_user.id,
        job_id=application_in.job_id,
        resume_id=application_in.resume_id,
        application_type=application_in.application_type,
        cover_letter=application_in.cover_letter.strip() if application_in.cover_letter else None,
        status="pending",
        ai_status="queued",
        report_source="none",
    )
    
    db.add(new_application)
    await db.commit()
    await db.refresh(new_application)

    process_candidate_cv_task.delay(
        str(new_application.id), 
        resume.cv_url
    )
    
    return new_application


# 6. API lấy danh sách đơn ứng tuyển
@router.get("/applications", response_model=List[CandidateApplicationListResponse])
async def get_my_applications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = (
        select(Application)
        .where(Application.candidate_id == current_user.id)
        .options(
            joinedload(Application.job).joinedload(JobDescription.company),
            joinedload(Application.resume)
        )
        .order_by(Application.applied_at.desc())
    )
    result = await db.execute(query)
    return result.scalars().all()


# 7. API xem hồ sơ cá nhân (Tự động Upsert để luôn trả về 200 OK)
@router.get("/profile", response_model=CandidateProfileResponse)
async def get_my_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    profile = await ensure_candidate_profile_exists(db, current_user)
    return profile


# 8. API cập nhật hồ sơ cá nhân
@router.put("/profile", response_model=CandidateProfileResponse)
async def update_my_profile(
    profile_in: CandidateProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Đảm bảo profile tồn tại an toàn
    profile = await ensure_candidate_profile_exists(db, current_user)

    update_data = profile_in.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)
    
    return profile


# 9. API xem hồ sơ cá nhân công khai
@router.get("/public/{user_id}", response_model=CandidateProfileResponse)
async def get_public_profile(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Candidate).where(Candidate.user_id == user_id))
    profile = result.scalars().first()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ cá nhân.")
        
    return profile
