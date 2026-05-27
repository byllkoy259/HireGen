import json
import re
import unicodedata
import uuid
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.models import User, JobDescription, Application, Candidate, Resume, Company
from app.schemas.application import ApplicationDetailResponse, ApplicationStatusUpdate
from app.api.deps import get_current_hr

router = APIRouter(
    prefix="/api/hr/applications",
    tags=["HR Application Management"]
)

def get_avatar_color(app_id: str) -> str:
    """Tự động ánh xạ ID sang dải màu chuẩn của Ant Design."""
    avatar_colors = [
        '#1e4076', '#be185d', '#0369a1', '#059669',
        '#7c3aed', '#b45309', '#db2777', '#0f766e',
        '#dc2626', '#9333ea', '#0284c7', '#16a34a',
    ]
    char_sum = sum(ord(c) for c in app_id)
    return avatar_colors[char_sum % len(avatar_colors)]

def get_initials(name: str) -> str:
    """Trích xuất chữ cái đầu viết tắt từ Tên ứng viên."""
    if not name or name == "Chưa cập nhật":
        return "U"
    words = name.strip().split()
    if len(words) == 1:
        return words[0][0].upper()
    return "".join(w[0] for w in words[-2:]).upper()


def normalize_report_text(value: Any) -> str:
    text = str(value or "").lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(char for char in text if not unicodedata.combining(char))
    return re.sub(r"\s+", " ", text).strip()


def get_report_job_family(job: JobDescription | None) -> str:
    category = normalize_report_text(job.itss_category if job else "")
    title = normalize_report_text(job.title if job else "")
    text = f"{category} {title}"

    if "business application development" in text or "application development" in text or "software development" in text:
        return "BUSINESS_APP_DEV"
    if "system development" in text or "smart factory" in text or "iot" in text:
        return "SYSTEM_DEV"
    if "project management" in text or "project manager" in text:
        return "PROJECT_MANAGEMENT"
    if "it strategy" in text or "consultant" in text or "solution architect" in text:
        return "IT_STRATEGY"
    if "it service management" in text or "it support" in text or "helpdesk" in text or "service desk" in text:
        return "IT_SERVICE_MANAGEMENT"
    if "network" in text or "infrastructure" in text or "cloud" in text or "devops" in text:
        return "NETWORK_INFRA"
    return "GENERAL_IT"


def get_fallback_radar_labels(job: JobDescription | None) -> list[str]:
    family = get_report_job_family(job)
    labels_by_family = {
        "IT_SERVICE_MANAGEMENT": ["Hỗ trợ người dùng", "Troubleshooting", "Hệ điều hành/Mạng", "Giao tiếp", "Văn hóa Nhật"],
        "SYSTEM_DEV": ["Lập trình hệ thống", "IoT/Thiết bị", "Backend/API", "CSDL", "Văn hóa Nhật"],
        "BUSINESS_APP_DEV": ["Web/App", "Backend/API", "CSDL", "Nghiệp vụ/UI", "Làm việc nhóm"],
        "NETWORK_INFRA": ["Hạ tầng/Mạng", "Cloud/DevOps", "Bảo mật", "Vận hành", "Văn hóa Nhật"],
        "PROJECT_MANAGEMENT": ["Lập kế hoạch", "Điều phối", "Quản trị rủi ro", "Giao tiếp", "Văn hóa Nhật"],
        "IT_STRATEGY": ["Tư duy chiến lược", "Phân tích nghiệp vụ", "Kiến trúc giải pháp", "Tư vấn", "Văn hóa Nhật"],
    }
    return labels_by_family.get(family, ["Chuyên môn", "Kinh nghiệm", "Ngoại ngữ", "Kỹ năng mềm", "Văn hóa Nhật"])

# Helpers for report compatibility and legacy AI results
def parse_json_object(value: Any) -> dict:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}


def clamp_report_score(value: Any) -> float:
    try:
        score = float(value)
    except (TypeError, ValueError):
        score = 0.0
    return max(0.0, min(100.0, score))

def format_itss_level(value: Any, default: Any = 3) -> str:
    raw = str(value if value not in (None, "") else default).strip()
    if not raw:
        raw = str(default)
    if raw.lower().startswith("level"):
        return raw
    match = re.search(r"\d+", raw)
    if match:
        return f"Level {match.group()}"
    return f"Level {raw}"


def build_confidence_fallback(
    *,
    evaluation_result: dict,
    embedding_score: float | None,
    llm_score: float | None,
    final_score: float,
    ai_status: str,
    report_source: str,
) -> dict:
    if evaluation_result.get("confidence_level"):
        return {
            "confidence_score": evaluation_result.get("confidence_score"),
            "confidence_level": evaluation_result.get("confidence_level"),
            "confidence_reason": evaluation_result.get("confidence_reason"),
        }

    confidence = 100.0
    reasons = []
    rubric_score = clamp_report_score(evaluation_result.get("rubric_match_score", final_score))
    requirement_scores = evaluation_result.get("requirement_scores") or []
    requirement_count = len(requirement_scores) if isinstance(requirement_scores, list) else 0
    role_mismatch_level = evaluation_result.get("role_mismatch_level") or "UNKNOWN"
    itss_category_mismatch_level = evaluation_result.get("itss_category_mismatch_level") or "UNKNOWN"

    if ai_status != "processed":
        confidence -= 30
        reasons.append("Báo cáo chưa được xử lý hoàn chỉnh.")

    if report_source != "gemini":
        confidence -= 25
        reasons.append("Báo cáo không được tạo đầy đủ từ Gemini.")

    if llm_score is None:
        confidence -= 25
        reasons.append("Thiếu điểm đánh giá ngữ cảnh từ LLM.")
    else:
        diff = abs(rubric_score - llm_score)
        if diff <= 15:
            reasons.append("Rubric và LLM khá nhất quán.")
        elif diff <= 30:
            confidence -= 15
            reasons.append("Rubric và LLM có chênh lệch trung bình.")
        else:
            confidence -= 30
            reasons.append("Rubric và LLM chênh lệch lớn, cần HR xem xét kỹ.")

    if requirement_count < 3:
        confidence -= 15
        reasons.append("JD có ít tiêu chí rõ ràng để đối chiếu.")

    if role_mismatch_level == "HIGH":
        confidence -= 10
        reasons.append("Hồ sơ có dấu hiệu lệch nhóm vai trò/ITSS đáng kể.")

    if itss_category_mismatch_level == "HIGH":
        confidence -= 20
        reasons.append("ITSS category dự đoán lệch mạnh so với JD.")
    elif itss_category_mismatch_level == "MEDIUM":
        confidence -= 10
        reasons.append("ITSS category dự đoán chỉ tương thích một phần với JD.")

    if embedding_score is not None:
        if embedding_score < 20:
            confidence -= 20
            reasons.append("Embedding similarity rất thấp so với yêu cầu JD.")
            if llm_score is not None and llm_score >= 75:
                confidence -= 10
                reasons.append("LLM đánh giá cao nhưng embedding thấp, cần HR xác minh thủ công.")
        elif embedding_score < 35:
            confidence -= 10
            reasons.append("Embedding similarity thấp, độ tin cậy cần được giảm.")

    confidence = clamp_report_score(confidence)
    if confidence >= 75:
        level = "HIGH"
    elif confidence >= 50:
        level = "MEDIUM"
    else:
        level = "LOW"

    return {
        "confidence_score": confidence,
        "confidence_level": level,
        "confidence_reason": " ".join(reasons) if reasons else "Các tín hiệu đánh giá tương đối ổn định.",
    }

@router.get("/job/{job_id}", response_model=List[ApplicationDetailResponse])
async def get_applications_by_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_hr: User = Depends(get_current_hr)
):
    job_result = await db.execute(
        select(JobDescription).where(JobDescription.id == job_id, JobDescription.hr_id == current_hr.id)
    )
    if not job_result.scalars().first():
        raise HTTPException(status_code=403, detail="Bạn không có quyền xem đơn ứng tuyển của công việc này.")

    query = (
        select(Application)
        .where(Application.job_id == job_id)
        .options(
            selectinload(Application.candidate), 
            selectinload(Application.resume)
        )
        .order_by(Application.applied_at.desc())
    )
    
    result = await db.execute(query)
    return result.scalars().all()


# API HR cập nhật trạng thái đơn ứng tuyển
@router.put("/{app_id}/status", response_model=ApplicationDetailResponse)
async def update_application_status(
    app_id: uuid.UUID,
    status_in: ApplicationStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_hr: User = Depends(get_current_hr)
):
    query = (
        select(Application)
        .join(JobDescription, Application.job_id == JobDescription.id)
        .where(
            Application.id == app_id,
            JobDescription.hr_id == current_hr.id
        )
        .options(
            selectinload(Application.candidate), 
            selectinload(Application.resume)
        )
    )
    
    result = await db.execute(query)
    application = result.scalars().first()
    
    if not application:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn ứng tuyển, hoặc bạn không có quyền thao tác.")

    application.status = status_in.status
    application.reviewed_by = current_hr.id

    await db.commit()
    await db.refresh(application)
    
    return application

# API Lấy Báo Cáo AI Động (Hỗ trợ hoàn hảo Pure Generative AI Engine & Hybrid Fallback)
@router.get("/{app_id}/ai-report")
async def get_application_ai_report(
    app_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_hr: User = Depends(get_current_hr)
):
    query = (
        select(Application)
        .options(
            selectinload(Application.candidate).selectinload(Candidate.user), 
            selectinload(Application.resume),
            selectinload(Application.job).selectinload(JobDescription.company)
        )
        .join(JobDescription, Application.job_id == JobDescription.id)
        .where(
            Application.id == app_id,
            JobDescription.hr_id == current_hr.id
        )
    )
    
    result = await db.execute(query)
    application = result.scalars().first()
    
    if not application:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ hoặc bạn không có quyền truy cập.")

    # 1. Parse an toàn dữ liệu JSON trích xuất từ Gemini
    ext_data = application.extracted_data or {}
    if isinstance(ext_data, str):
        try:
            ext_data = json.loads(ext_data)
        except Exception:
            ext_data = {}

    personal_info = ext_data.get("personal_info", {})
    itss_pred = ext_data.get("itss_prediction", {})
    skills_list = ext_data.get("skills", [])
    experience_list = ext_data.get("experience", [])

    # 2. THU THẬP THÔNG TIN TÀI KHOẢN HỆ THỐNG (Ưu tiên hiển thị thông tin đăng ký thật)
    candidate_profile = application.candidate
    if candidate_profile:
        applicant_name = candidate_profile.full_name or "Chưa cập nhật"
        applicant_email = candidate_profile.user.email if getattr(candidate_profile, "user", None) else "Chưa cập nhật"
        birth_year = candidate_profile.date_of_birth.year if getattr(candidate_profile, "date_of_birth", None) else "Chưa cập nhật"
        location = getattr(candidate_profile, "address", None) or "Chưa cập nhật"
        portfolio_url = getattr(candidate_profile, "portfolio_url", None) or ""
        has_linkedin = bool(getattr(candidate_profile, "linkedin_url", None))
    else:
        applicant_name = "Chưa cập nhật"
        applicant_email = "Chưa cập nhật"
        birth_year = "Chưa cập nhật"
        location = "Chưa cập nhật"
        portfolio_url = ""
        has_linkedin = False

    # 3. TỰ ĐỘNG ĐỐI CHIẾU DANH TÍNH (So sánh tên CV vs Tên tài khoản)
    cv_full_name = personal_info.get("full_name", "").strip()
    name_check_alert = ""
    if cv_full_name:
        if cv_full_name.lower() == applicant_name.lower() or cv_full_name.lower() in applicant_name.lower() or applicant_name.lower() in cv_full_name.lower():
            name_check_alert = f"Trực quan: Tên bóc tách từ CV khớp với thông tin tài khoản đăng ký."
        else:
            name_check_alert = f"LƯU Ý: Tên bóc tách từ file CV gốc là '{cv_full_name}', CÓ SỰ KHÁC BIỆT so với tên tài khoản nộp đơn ('{applicant_name}'). HR cần xác minh lại."
    else:
        name_check_alert = "Hệ thống AI chưa nhận diện được rõ ràng trường họ tên trong file CV gốc."

    partner_name = application.job.company.name if application.job and getattr(application.job, "company", None) else "Đối tác chưa cập nhật"
    job_title = application.job.title if application.job else "Vị trí ứng tuyển"
    match_score = float(application.match_score) if application.match_score is not None else 0.0
    embedding_match_score = float(application.embedding_match_score) if application.embedding_match_score is not None else match_score
    llm_match_score = float(application.llm_match_score) if application.llm_match_score is not None else None
    final_match_score = float(application.final_match_score) if application.final_match_score is not None else match_score
    ai_status = application.ai_status or ("processed" if application.extracted_data or application.match_score is not None else "queued")
    ai_error = application.ai_error or ""
    evaluation_result = parse_json_object(application.evaluation_result)

    app_id_str = str(application.id)
    avatar_color = get_avatar_color(app_id_str)
    initials = get_initials(applicant_name)

    itss_category = application.job.itss_category if application.job and getattr(application.job, "itss_category", None) else "Software Development"
    itss_level = format_itss_level(application.job.itss_level if application.job and getattr(application.job, "itss_level", None) else 3)

    ai_itss_predicted = itss_pred.get("category", itss_category)
    ai_itss_level = format_itss_level(itss_pred.get("level", 3))

    # 4. KÍCH HOẠT PURE GENERATIVE AI ENGINE HOẶC HYBRID FALLBACK
    ai_report_data = ext_data.get("ai_report", {})
    report_source = application.report_source or ("gemini" if ai_report_data else "none")
    is_fallback = False
    
    if ai_report_data:
        # Đơn nộp mới: Tận dụng trọn vẹn 100% tư duy sâu sắc do chính Gemini viết ra
        ai_summary_raw = ai_report_data.get("ai_summary", "")
        ai_summary = f"{name_check_alert}\n\n• Nhận xét từ AI Headhunter:\n{ai_summary_raw}"
        radar_data = ai_report_data.get("radar_data", [])
        gaps = ai_report_data.get("gaps", [])
        ai_questions = ai_report_data.get("ai_questions", [])
        report_source = "gemini"
    else:
        report_source = "fallback" if ai_status != "failed" else "none"
        is_fallback = ai_status != "failed"
        # Đơn nộp cũ: Fallback mượt mà về bộ logic động tính toán bằng mã nguồn
        skills_str = ", ".join(skills_list[:6]) if skills_list else "các công nghệ nền tảng"
        exp_count = len(experience_list)
        exp_str = f"có {exp_count} mốc kinh nghiệm/dự án thực tế" if exp_count > 0 else "đang tập trung củng cố kiến thức học vấn và đồ án"
        
        ai_summary = (
            f"{name_check_alert}\n\n"
            f"• Đánh giá tổng quan: Ứng viên đạt mức tương quan {final_match_score}% so với yêu cầu JD. "
            f"Hồ sơ phân tích cho thấy ứng viên {exp_str}, bộc lộ thế mạnh cốt lõi về {skills_str}. "
            f"Năng lực chuyên môn hiện tại được trích xuất phù hợp với lộ trình {ai_itss_predicted} ({ai_itss_level}) theo hệ thống tiêu chuẩn kỹ năng ITSS của Nhật Bản."
        )

        tech_score = min(100, max(40, int(final_match_score + (len(skills_list) * 1.5))))
        exp_score = 90 if exp_count >= 3 else (80 if exp_count == 2 else (70 if exp_count == 1 else 55))
        
        lang_score = 60
        skills_dump = " ".join(skills_list).lower()
        cv_text_dump = json.dumps(ext_data).lower()
        if "n1" in skills_dump or "n2" in skills_dump or "jlpt n2" in cv_text_dump:
            lang_score = 95
        elif "n3" in skills_dump or "jlpt n3" in cv_text_dump:
            lang_score = 85
        elif "n4" in skills_dump or "n5" in skills_dump or "japanese" in skills_dump:
            lang_score = 75
        elif "ielts" in cv_text_dump or "toeic" in cv_text_dump or "english" in skills_dump:
            lang_score = 70

        soft_score = min(100, max(50, int(final_match_score * 0.85 + 25)))
        culture_score = min(100, max(50, int(lang_score * 0.8 + 20)))

        radar_labels = get_fallback_radar_labels(application.job)
        radar_scores = [tech_score, exp_score, lang_score, soft_score, culture_score]
        radar_required = [80, 75, 70, 75, 80]
        radar_data = [
            {"label": label, "candidate": radar_scores[index], "required": radar_required[index]}
            for index, label in enumerate(radar_labels)
        ]

        gaps = []
        if lang_score < 80:
            gaps.append({
                "skill": "Ngoại ngữ & Tiếng Nhật giao tiếp",
                "required": 4, "actual": 2 if lang_score < 70 else 3,
                "note": "Hồ sơ chưa thể hiện rõ chứng chỉ tiếng Nhật cấp độ cao (N2/N3). Khuyến nghị kiểm tra thêm khả năng đọc hiểu tài liệu kỹ thuật."
            })
        else:
            gaps.append({
                "skill": "Giao tiếp Tiếng Nhật thương mại",
                "required": 4, "actual": 4,
                "note": "Nền tảng ngoại ngữ đáp ứng tốt, có tiềm năng hòa nhập nhanh vào các quy trình báo cáo liên lạc (Horenso)."
            })

        sample_skill = skills_list[0] if skills_list else "lập trình chuyên môn"
        sample_exp = experience_list[0].get("company", "các dự án trước đây") if experience_list else "các đồ án thực tế"
        
        ai_questions = [
            {
                "category": "Kỹ thuật chuyên sâu",
                "question": f"Trong CV bạn có nêu bật kinh nghiệm sử dụng {sample_skill}. Hãy chia sẻ cụ thể một bài toán khó nhất bạn từng xử lý bằng công nghệ này?",
                "intent": f"Kiểm chứng năng lực thực chiến và mức độ làm chủ công nghệ {sample_skill}."
            },
            {
                "category": "Kinh nghiệm & Trách nhiệm",
                "question": f"Trong quá trình làm việc tại {sample_exp}, bạn phối hợp giải quyết xung đột với các thành viên khác như thế nào?",
                "intent": "Đánh giá tư duy làm việc nhóm và tinh thần trách nhiệm."
            }
        ]

    if ai_status == "failed" and not ai_report_data:
        ai_summary = ai_error or "Hệ thống chưa tạo được báo cáo AI cho hồ sơ này."
        radar_data = []
        gaps = []
        ai_questions = []
        report_source = "none"
        is_fallback = False

    confidence_result = build_confidence_fallback(
        evaluation_result=evaluation_result,
        embedding_score=embedding_match_score,
        llm_score=llm_match_score,
        final_score=final_match_score,
        ai_status=ai_status,
        report_source=report_source,
    )
    evaluation_result = {
        **evaluation_result,
        **{
            key: value
            for key, value in confidence_result.items()
            if evaluation_result.get(key) is None
        },
    }

    return {
        "application_id": app_id_str,
        "applicant_name": applicant_name,
        "applicant_email": applicant_email,
        "birth_year": birth_year,
        "location": location,
        "avatar_color": avatar_color,
        "initials": initials,
        "job_title": job_title,
        "partner_name": partner_name,
        "match_score": final_match_score,
        "embedding_match_score": embedding_match_score,
        "llm_match_score": llm_match_score,
        "final_match_score": final_match_score,
        "scoring_method": application.scoring_method or evaluation_result.get("scoring_method") or "embedding_cosine_v1",
        "evaluation_result": evaluation_result,

        "confidence_score": confidence_result.get("confidence_score"),
        "confidence_level": confidence_result.get("confidence_level"),
        "confidence_reason": confidence_result.get("confidence_reason"),
        
        "ai_status": ai_status,
        "ai_error": ai_error,
        "last_ai_error": getattr(application, "last_ai_error", None) or "",
        "last_ai_rerun_at": application.last_ai_rerun_at.isoformat() if getattr(application, "last_ai_rerun_at", None) else "",
        "last_ai_attempt_status": getattr(application, "last_ai_attempt_status", None) or "",
        "report_source": report_source,
        "is_fallback": is_fallback,
        "itss_category": itss_category,
        "itss_level": itss_level,
        "status": application.status,
        "applied_at": application.applied_at.isoformat() if application.applied_at else "",
        "has_linkedin": True if getattr(candidate_profile, "linkedin_url", None) else False,
        "portfolio_url": getattr(candidate_profile, "portfolio_url", None) or "",
        "cv_url": application.resume.cv_url if application.resume else "",
        "ai_itss_predicted": ai_itss_predicted,
        "ai_itss_level": ai_itss_level,
        "ai_summary": ai_summary,
        "radar_data": radar_data,
        "gaps": gaps,
        "ai_questions": ai_questions
    }
