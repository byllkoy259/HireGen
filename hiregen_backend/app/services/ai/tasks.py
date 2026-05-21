import asyncio
import re
import unicodedata
from datetime import datetime
from typing import Any

from sqlalchemy import update
from sqlalchemy.future import select

from app.core.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.models.models import Application, JobDescription
from app.services.ai.pdf_parser import get_and_parse_pdf_from_minio
from app.services.ai.extractor import extract_cv_to_json
from app.services.ai.embedding import get_text_embedding
from app.services.ai.matcher import baseline_match_cv_with_jd

try:
    import chromadb

    chroma_client = chromadb.HttpClient(host="localhost", port=8001)
    cv_collection = chroma_client.get_or_create_collection(name="baseline_candidate_cvs")
except Exception as exc:
    print(f"[ChromaDB Warning] Vector store is unavailable: {exc}")
    cv_collection = None


async def update_application_ai_fields(application_id: str, **values: Any) -> None:
    async with AsyncSessionLocal() as session:
        try:
            stmt = update(Application).where(Application.id == application_id).values(**values)
            await session.execute(stmt)
            await session.commit()
        except Exception as exc:
            await session.rollback()
            print(f"[PostgreSQL Error] Cannot update AI fields for application {application_id}: {exc}")


def normalize_skills(extracted_data: dict) -> list[str]:
    candidates = (
        extracted_data.get("hard_skills")
        or extracted_data.get("skills")
        or extracted_data.get("technical_skills")
        or []
    )
    if not isinstance(candidates, list):
        return []
    return list(dict.fromkeys(str(skill).strip() for skill in candidates if str(skill).strip()))


def normalize_text(value: Any) -> str:
    text = str(value or "").lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(char for char in text if not unicodedata.combining(char))
    return re.sub(r"\s+", " ", text).strip()


def flatten_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, dict):
        return " ".join(flatten_text(item) for item in value.values())
    if isinstance(value, list):
        return " ".join(flatten_text(item) for item in value)
    return str(value)


def clamp_score(score: float, lower: float = 0.0, upper: float = 100.0) -> float:
    return round(max(lower, min(upper, score)), 2)


def extract_llm_match_score(extracted_data: dict) -> float | None:
    ai_report = extracted_data.get("ai_report") or {}
    if not isinstance(ai_report, dict):
        return None

    for key in ("match_score", "score", "fit_score", "overall_score"):
        value = ai_report.get(key)
        if value is None:
            continue
        try:
            score = clamp_score(float(value))
            return score if score > 0 else None
        except (TypeError, ValueError):
            continue
    return None


def split_requirement_items(requirements_text: str) -> list[str]:
    if not requirements_text:
        return []

    items = []
    for line in re.split(r"[\n\r;]+", requirements_text):
        cleaned = re.sub(r"^[\s\-•*+0-9.)]+", "", line).strip()
        if cleaned:
            items.append(cleaned)
    return items


def has_any(haystack: str, needles: list[str]) -> bool:
    return any(normalize_text(needle) in haystack for needle in needles)


def keyword_score(haystack: str, keywords: list[str]) -> float:
    normalized_keywords = [normalize_text(keyword) for keyword in keywords if keyword.strip()]
    if not normalized_keywords:
        return 0.0
    matched = sum(1 for keyword in normalized_keywords if keyword in haystack)
    return matched / len(normalized_keywords)


def stronger_mismatch_level(level_a: str, level_b: str) -> str:
    rank = {"UNKNOWN": 0, "LOW": 1, "MEDIUM": 2, "HIGH": 3}
    return level_a if rank.get(level_a, 0) >= rank.get(level_b, 0) else level_b


def score_requirement_item(requirement: str, cv_haystack: str) -> tuple[float, list[str], str]:
    req = normalize_text(requirement)
    evidence: list[str] = []
    note = "Scored from direct and semantic keyword evidence in extracted CV data."

    if has_any(req, ["tieng nhat", "jlpt", "n4"]):
        if has_any(cv_haystack, ["jlpt n1", "n1", "jlpt n2", "n2", "jlpt n3", "n3", "jlpt n4", "n4"]):
            evidence.append("Japanese/JLPT evidence")
            return 100.0, evidence, "Japanese requirement is satisfied or exceeded."
        if has_any(cv_haystack, ["japanese", "nhat ban", "tieng nhat"]):
            evidence.append("Japanese working context")
            return 70.0, evidence, "Japanese exposure is present, certificate level is unclear."
        return 20.0, evidence, "No Japanese evidence found."

    if has_any(req, ["tieng anh", "english", "tai lieu ky thuat", "doc hieu"]):
        if has_any(cv_haystack, ["english", "tieng anh", "technical document", "documentation", "tai lieu yeu cau"]):
            evidence.append("English/documentation evidence")
            return 85.0, evidence, "English technical reading/documentation evidence is present."
        if has_any(cv_haystack, ["documentation", "tai lieu", "api document"]):
            evidence.append("Documentation evidence")
            return 65.0, evidence, "Documentation evidence is present, English level is less explicit."
        return 25.0, evidence, "No English/documentation evidence found."

    if has_any(req, ["microsoft office", "office", "van phong"]):
        if has_any(cv_haystack, ["microsoft office", "excel", "word", "powerpoint", "office"]):
            evidence.append("Office tools")
            return 90.0, evidence, "Office tool evidence is present."
        if has_any(cv_haystack, ["documentation", "tai lieu", "report", "bao cao"]):
            evidence.append("Documentation/reporting")
            return 45.0, evidence, "Documentation/reporting evidence partially supports office workflow readiness."
        return 20.0, evidence, "No office tool evidence found."

    if has_any(req, ["may tinh", "mang", "windows", "linux", "he dieu hanh"]):
        partials = [
            ("linux", ["linux"]),
            ("windows", ["windows"]),
            ("network", ["network", "mang", "mqtt", "api", "distributed system", "he thong phan tan"]),
            ("system", ["system", "he thong", "backend", "docker", "aws"]),
        ]
        matched = []
        for label, terms in partials:
            if has_any(cv_haystack, terms):
                matched.append(label)
        evidence.extend(matched)
        return min(100.0, 20.0 + len(matched) * 18.0), evidence, "Computer/network/OS score is based on covered foundations."

    if has_any(req, ["giao tiep", "ho tro nguoi dung", "support", "user"]):
        communication = has_any(cv_haystack, ["communication", "giao tiep", "hop ky thuat", "team"])
        support = has_any(cv_haystack, ["support", "ho tro", "troubleshoot", "phan tich loi", "cai thien do on dinh", "bao tri"])
        if communication:
            evidence.append("communication")
        if support:
            evidence.append("support/troubleshooting")
        if communication and support:
            return 75.0, evidence, "Communication and support-adjacent troubleshooting evidence are present."
        if communication or support:
            return 55.0, evidence, "Only part of the user support requirement is evidenced."
        return 25.0, evidence, "No support or communication evidence found."

    if has_any(req, ["hoc hoi", "thai do", "tich cuc", "sinh vien moi tot nghiep", "chua co nhieu kinh nghiem"]):
        if has_any(cv_haystack, ["self-learning", "self learning", "hoc hoi", "student", "sinh vien", "education", "dai hoc"]):
            evidence.append("learning/entry-level signal")
            return 90.0, evidence, "Learning attitude or entry-level eligibility evidence is present."
        return 70.0, evidence, "Requirement is trainability-oriented and not strongly exclusionary."

    req_tokens = {
        token
        for token in re.findall(r"[a-z0-9]+", req)
        if len(token) >= 3 and token not in {"can", "cac", "the", "and", "voi", "cho", "ung", "vien"}
    }
    if not req_tokens:
        return 50.0, evidence, note
    matched = [token for token in req_tokens if token in cv_haystack]
    evidence.extend(matched[:5])
    return clamp_score((len(matched) / len(req_tokens)) * 100), evidence, note


def score_role_alignment(job_obj: JobDescription | None, cv_haystack: str) -> tuple[float, str, str]:
    if not job_obj:
        return 50.0, "Không có đủ ngữ cảnh JD để đánh giá độ khớp vai trò.", "UNKNOWN"

    job_text = normalize_text(" ".join([
        job_obj.title or "",
        job_obj.itss_category or "",
        job_obj.description_text or "",
        job_obj.requirements_text or "",
    ]))

    support_job = has_any(job_text, [
        "it support", "helpdesk", "service desk", "it service management",
        "ho tro", "nguoi dung", "cai dat", "cau hinh", "tai khoan", "thiet bi"
    ])
    direct_support = has_any(cv_haystack, [
        "it support", "helpdesk", "service desk", "user support", "ho tro nguoi dung",
        "cai dat", "cau hinh", "quan ly tai khoan", "windows"
    ])
    support_adjacent = has_any(cv_haystack, [
        "linux", "documentation", "tai lieu", "phan tich loi", "canh bao loi",
        "bao tri", "he thong", "docker", "aws", "communication"
    ])
    development_heavy = has_any(cv_haystack, [
        "backend software engineer", "software engineer", "backend developer",
        "spring boot", "fastapi", "rest api", "microservices"
    ])

    if support_job:
        if direct_support:
            return 80.0, "CV có tín hiệu trực tiếp về IT Support/helpdesk hoặc hỗ trợ người dùng.", "LOW"
        if support_adjacent and development_heavy:
            return 40.0, "CV thiên mạnh về phát triển phần mềm/backend; chỉ có tín hiệu liền kề như hệ thống, xử lý lỗi, tài liệu hoặc giao tiếp, chưa có kinh nghiệm IT Support trực tiếp.", "HIGH"
        if support_adjacent:
            return 55.0, "CV có một số tín hiệu liền kề IT Support nhưng chưa thể hiện rõ vai trò support/helpdesk.", "MEDIUM"
        return 30.0, "JD thiên về IT Support trong khi CV gần như không có bằng chứng hỗ trợ người dùng hoặc vận hành IT nội bộ.", "HIGH"

    if development_heavy:
        return 75.0, "Định hướng CV phù hợp với JD thiên về phát triển phần mềm.", "LOW"
    return 60.0, "Không phát hiện lệch vai trò nghiêm trọng.", "LOW"


def calculate_hybrid_match_score(
    *,
    extracted_data: dict,
    job_obj: JobDescription | None,
    jd_text: str,
    embedding_score: float | None,
) -> dict:
    cv_haystack = normalize_text(flatten_text(extracted_data))
    requirements_text = job_obj.requirements_text if job_obj else jd_text
    requirement_items = split_requirement_items(requirements_text or jd_text)

    requirement_scores = []
    for item in requirement_items:
        score, evidence, note = score_requirement_item(item, cv_haystack)
        requirement_scores.append({
            "requirement": item,
            "score": score,
            "evidence": evidence,
            "note": note,
        })

    if requirement_scores:
        requirement_avg = sum(item["score"] for item in requirement_scores) / len(requirement_scores)
    else:
        requirement_avg = 50.0

    role_alignment_score, role_alignment_reason, role_mismatch_level = score_role_alignment(job_obj, cv_haystack)
    candidate_itss = extracted_data.get("itss_prediction") or {}
    candidate_itss_category = normalize_text(candidate_itss.get("category") if isinstance(candidate_itss, dict) else "")
    job_itss_category = normalize_text(job_obj.itss_category if job_obj else "")
    itss_category_mismatch_level = "LOW"
    if candidate_itss_category and job_itss_category:
        same_category = candidate_itss_category in job_itss_category or job_itss_category in candidate_itss_category
        if not same_category:
            itss_category_mismatch_level = "MEDIUM"
            if has_any(job_itss_category, ["it service management", "service management", "support"]) and has_any(
                candidate_itss_category,
                ["business application", "software", "development", "application development"],
            ):
                itss_category_mismatch_level = "HIGH"
    role_mismatch_level = stronger_mismatch_level(role_mismatch_level, itss_category_mismatch_level)
    rubric_score = clamp_score(requirement_avg * 0.60 + role_alignment_score * 0.40)
    llm_score = extract_llm_match_score(extracted_data)

    weighted_parts = []
    if llm_score is not None:
        weighted_parts.append(("llm", llm_score, 0.55))
        weighted_parts.append(("rubric", rubric_score, 0.30))
        if embedding_score is not None:
            weighted_parts.append(("embedding", embedding_score, 0.15))
    else:
        weighted_parts.append(("rubric", rubric_score, 0.65))
        if embedding_score is not None:
            weighted_parts.append(("embedding", embedding_score, 0.35))

    total_weight = sum(weight for _, _, weight in weighted_parts)
    final_score = sum(score * weight for _, score, weight in weighted_parts) / total_weight if total_weight else rubric_score

    if role_mismatch_level == "HIGH":
        final_score = min(final_score, 45.0)
    elif role_mismatch_level == "MEDIUM":
        final_score = min(final_score, 60.0)

    score_label = "Phù hợp thấp - Có tiềm năng chuyển hướng"
    if final_score >= 80:
        score_label = "Phù hợp cao"
    elif final_score >= 60:
        score_label = "Phù hợp tiềm năng"
    elif final_score < 35:
        score_label = "Phù hợp thấp"

    scoring_method = "hybrid_llm_rubric_embedding_v1" if llm_score is not None else "hybrid_rubric_embedding_v1"
    return {
        "embedding_match_score": embedding_score,
        "llm_match_score": llm_score,
        "rubric_match_score": rubric_score,
        "final_match_score": clamp_score(final_score),
        "scoring_method": scoring_method,
        "requirement_scores": requirement_scores,
        "role_alignment_score": role_alignment_score,
        "role_alignment_reason": role_alignment_reason,
        "role_mismatch_level": role_mismatch_level,
        "itss_category_mismatch_level": itss_category_mismatch_level,
        "score_label": score_label,
        "score_weights": [
            {"source": source, "score": score, "weight": weight}
            for source, score, weight in weighted_parts
        ],
    }


def build_evaluation_result(
    *,
    extracted_data: dict,
    jd_text: str,
    embedding_score: float | None,
    hybrid_result: dict,
    ai_status: str,
    report_source: str,
) -> dict:
    skills = normalize_skills(extracted_data)
    ai_report = extracted_data.get("ai_report") or {}
    gaps = ai_report.get("gaps") if isinstance(ai_report, dict) else []
    itss = extracted_data.get("itss_prediction") or {}

    missing_skills = []
    if isinstance(gaps, list):
        missing_skills = [
            str(gap.get("skill") if isinstance(gap, dict) else gap).strip()
            for gap in gaps
            if str(gap.get("skill") if isinstance(gap, dict) else gap).strip()
        ]

    jd_lower = jd_text.lower()
    matched_skills = [skill for skill in skills if skill.lower() in jd_lower]

    return {
        "embedding_match_score": embedding_score,
        "llm_match_score": hybrid_result.get("llm_match_score"),
        "llm_score_reason": ai_report.get("score_reason", "") if isinstance(ai_report, dict) else "",
        "rubric_match_score": hybrid_result.get("rubric_match_score"),
        "final_match_score": hybrid_result.get("final_match_score"),
        "scoring_method": hybrid_result.get("scoring_method") or "none",
        "requirement_scores": hybrid_result.get("requirement_scores", []),
        "role_alignment_score": hybrid_result.get("role_alignment_score"),
        "role_alignment_reason": hybrid_result.get("role_alignment_reason"),
        "role_mismatch_level": hybrid_result.get("role_mismatch_level"),
        "itss_category_mismatch_level": hybrid_result.get("itss_category_mismatch_level"),
        "score_label": hybrid_result.get("score_label"),
        "score_weights": hybrid_result.get("score_weights", []),
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "itss_category": itss.get("category"),
        "itss_level": itss.get("level"),
        "itss_level_label": itss.get("level_label"),
        "strengths": ai_report.get("strengths", []) if isinstance(ai_report, dict) else [],
        "weaknesses": ai_report.get("weaknesses", []) if isinstance(ai_report, dict) else [],
        "recommendation": ai_report.get("recommendation", "") if isinstance(ai_report, dict) else "",
        "report_source": report_source,
        "ai_status": ai_status,
        "pipeline_version": "hybrid_standardized_v1",
        "embedding_model": "all-MiniLM-L6-v2",
        "llm_model": "gemini-2.5-flash",
    }


async def async_process_cv_pipeline(application_id: str, file_url: str):
    print(f"\n[Pipeline] Start AI processing for application ID: {application_id}")
    await update_application_ai_fields(
        application_id,
        ai_status="processing",
        ai_error=None,
        report_source="none",
    )

    cv_text = get_and_parse_pdf_from_minio(file_url)
    if not cv_text:
        await update_application_ai_fields(
            application_id,
            ai_status="failed",
            ai_error=f"Cannot read or parse CV file: {file_url}",
            report_source="none",
            ai_processed_at=datetime.utcnow(),
        )
        return

    jd_text = ""
    job_obj = None
    async with AsyncSessionLocal() as session:
        try:
            app_result = await session.execute(select(Application).where(Application.id == application_id))
            app_obj = app_result.scalars().first()
            if app_obj and app_obj.job_id:
                job_result = await session.execute(select(JobDescription).where(JobDescription.id == app_obj.job_id))
                job_obj = job_result.scalars().first()
                if job_obj:
                    jd_text = "\n\n".join([
                        f"Vị trí tuyển dụng: {job_obj.title}",
                        f"Mô tả công việc: {job_obj.description_text}",
                        f"Yêu cầu kỹ năng: {job_obj.requirements_text}",
                    ])
        except Exception as exc:
            print(f"[DB Error] Cannot load JD context: {exc}")

    extracted_data = await extract_cv_to_json(cv_text, jd_text)
    gemini_ok = bool(extracted_data)
    report_source = "gemini" if extracted_data.get("ai_report") else "none"

    skills = normalize_skills(extracted_data)
    skills_text = ", ".join(skills) if skills else cv_text[:1000]

    embedding_score = None
    if job_obj and job_obj.requirements_text:
        try:
            embedding_score = baseline_match_cv_with_jd(skills_text, job_obj.requirements_text)
            print(f"[Matching] embedding_match_score={embedding_score}%")
        except Exception as exc:
            print(f"[Matching Error] Cannot calculate embedding score: {exc}")

    if cv_collection is not None:
        try:
            cv_vector = get_text_embedding(skills_text)
            cv_collection.upsert(
                embeddings=[cv_vector],
                documents=[skills_text],
                metadatas=[{
                    "application_id": str(application_id),
                    "full_name": extracted_data.get("personal_info", {}).get("full_name", "Unknown") if gemini_ok else "Unknown",
                    "itss_category": extracted_data.get("itss_prediction", {}).get("category", "") if gemini_ok else "",
                    "itss_level": extracted_data.get("itss_prediction", {}).get("level", "") if gemini_ok else "",
                }],
                ids=[str(application_id)],
            )
        except Exception as exc:
            print(f"[ChromaDB Error] Cannot upsert CV vector: {exc}")

    if gemini_ok and embedding_score is not None:
        ai_status = "processed"
        ai_error = None
    elif gemini_ok or embedding_score is not None:
        ai_status = "partial"
        ai_error = None if gemini_ok else "Gemini extraction failed; embedding score was calculated from raw CV text."
    else:
        ai_status = "failed"
        ai_error = "Gemini extraction and embedding matching both failed."

    hybrid_result = calculate_hybrid_match_score(
        extracted_data=extracted_data or {},
        job_obj=job_obj,
        jd_text=jd_text,
        embedding_score=embedding_score,
    )
    final_score = hybrid_result.get("final_match_score")
    llm_score = hybrid_result.get("llm_match_score")
    print(
        "[Matching] "
        f"rubric_match_score={hybrid_result.get('rubric_match_score')}%, "
        f"llm_match_score={llm_score}%, "
        f"final_match_score={final_score}%, "
        f"role_mismatch_level={hybrid_result.get('role_mismatch_level')}"
    )

    evaluation_result = build_evaluation_result(
        extracted_data=extracted_data or {},
        jd_text=jd_text,
        embedding_score=embedding_score,
        hybrid_result=hybrid_result,
        ai_status=ai_status,
        report_source=report_source,
    )

    await update_application_ai_fields(
        application_id,
        extracted_data=extracted_data or None,
        evaluation_result=evaluation_result,
        match_score=final_score,
        embedding_match_score=embedding_score,
        llm_match_score=llm_score,
        final_match_score=final_score,
        scoring_method=evaluation_result["scoring_method"],
        ai_status=ai_status,
        ai_error=ai_error,
        report_source=report_source,
        ai_processed_at=datetime.utcnow(),
    )

    print(f"[Pipeline] Completed application {application_id} with ai_status={ai_status}, report_source={report_source}\n")


@celery_app.task(name="process_candidate_cv_task")
def process_candidate_cv_task(application_id: str, file_url: str):
    asyncio.run(async_process_cv_pipeline(application_id, file_url))
