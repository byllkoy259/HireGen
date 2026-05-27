import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_hr
from app.core.database import get_db
from app.models.models import Application, JobDescription, User
from app.services.ai.extractor import extract_cv_to_json
from app.services.ai.matcher import baseline_match_cv_with_jd
from app.services.ai.tasks import process_candidate_cv_task

from app.schemas.ai import AIExtractResponse, AIMatchResponse, CVExtractRequest, AIMatchRequest

router = APIRouter(
    prefix="/api/ai", 
    tags=["AI Integration - Baseline"]
)

@router.post("/test-extract", response_model=AIExtractResponse)
async def test_extract_cv(request: CVExtractRequest):
    """
    Endpoint thử nghiệm bóc tách CV text sang JSON bằng Gemini-2.5-Flash.
    """
    if not request.cv_text.strip():
        raise HTTPException(status_code=400, detail="Nội dung CV không được để trống")
    
    data = await extract_cv_to_json(request.cv_text, request.jd_text or "")
    
    if not data:
        raise HTTPException(status_code=500, detail="Không thể trích xuất dữ liệu từ Gemini")
        
    return {
        "status": "success",
        "extracted_data": data
    }

@router.post("/test-embedding-match", response_model=AIMatchResponse)
async def test_match_cv_jd(request: AIMatchRequest):
    """
    Endpoint thử nghiệm so khớp (Matching) giữa CV và JD.
    Sử dụng Local Embedding Model (all-MiniLM-L6-v2) và Cosine Similarity.
    """
    if not request.cv_text.strip() or not request.jd_text.strip():
        raise HTTPException(status_code=400, detail="CV và JD không được để trống")

    try:
        # Gọi hàm xử lý logic Baseline
        match_score = baseline_match_cv_with_jd(request.cv_text, request.jd_text)
        
        return {
            "status": "success",
            "matching_score": match_score,
            "algorithm": "embedding_cosine_v1 (Sentence-Transformers + Cosine Similarity)"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi tính toán so khớp: {str(e)}")


@router.post("/test-match", response_model=AIMatchResponse)
async def test_match_cv_jd_legacy(request: AIMatchRequest):
    return await test_match_cv_jd(request)


@router.post("/match/job/{job_id}")
async def run_ai_matching_for_job(
    job_id: uuid.UUID,
    force: bool = Query(False, description="Re-run AI matching for applications that already have AI results."),
    db: AsyncSession = Depends(get_db),
    current_hr: User = Depends(get_current_hr),
):
    job_result = await db.execute(
        select(JobDescription).where(
            JobDescription.id == job_id,
            JobDescription.hr_id == current_hr.id,
        )
    )
    job = job_result.scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or you do not have permission to run matching.")

    applications_result = await db.execute(
        select(Application)
        .where(Application.job_id == job_id)
        .options(selectinload(Application.resume))
    )
    applications = applications_result.scalars().all()

    queued = 0
    skipped = 0
    missing_resume = 0

    for application in applications:
        has_ai_result = application.ai_status == "processed" or (
            application.final_match_score is not None and bool(application.extracted_data)
        )
        if has_ai_result and not force:
            skipped += 1
            continue

        if not application.resume or not application.resume.cv_url:
            missing_resume += 1
            continue

        application.ai_status = "queued"
        application.ai_error = None
        application.last_ai_error = None
        application.last_ai_rerun_at = datetime.utcnow()
        application.last_ai_attempt_status = "queued"
        process_candidate_cv_task.delay(str(application.id), application.resume.cv_url)
        queued += 1

    await db.commit()

    return {
        "status": "queued" if queued > 0 else "no_pending_applications",
        "job_id": str(job_id),
        "queued": queued,
        "skipped": skipped,
        "missing_resume": missing_resume,
        "total_applications": len(applications),
    }


@router.post("/applications/{application_id}/rerun")
async def rerun_ai_matching_for_application(
    application_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_hr: User = Depends(get_current_hr),
):
    query = (
        select(Application)
        .join(JobDescription, Application.job_id == JobDescription.id)
        .where(
            Application.id == application_id,
            JobDescription.hr_id == current_hr.id,
        )
        .options(selectinload(Application.resume))
    )
    result = await db.execute(query)
    application = result.scalars().first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found or you do not have permission to rerun AI.")

    if application.ai_status in {"queued", "processing"}:
        return {
            "status": "already_queued",
            "application_id": str(application.id),
            "ai_status": application.ai_status,
        }

    if not application.resume or not application.resume.cv_url:
        raise HTTPException(status_code=400, detail="Application has no resume URL to process.")

    application.ai_status = "queued"
    application.ai_error = None
    application.last_ai_error = None
    application.last_ai_rerun_at = datetime.utcnow()
    application.last_ai_attempt_status = "queued"
    await db.commit()

    process_candidate_cv_task.delay(str(application.id), application.resume.cv_url)

    return {
        "status": "queued",
        "application_id": str(application.id),
    }
