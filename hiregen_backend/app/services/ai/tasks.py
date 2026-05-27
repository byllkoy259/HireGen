import asyncio
import re
import unicodedata
from datetime import datetime
from typing import Any

from sqlalchemy import update
from sqlalchemy.future import select

from app.core.celery_app import celery_app
from app.core.database import AsyncSessionLocal, engine
from app.models.models import Application, JobDescription
from app.services.ai.pdf_parser import get_and_parse_pdf_from_minio
from app.services.ai.extractor import PROMPT_VERSION, extract_cv_to_json
from app.services.ai.embedding import get_text_embedding
from app.services.ai.matcher import baseline_match_cv_with_jd

try:
    import chromadb

    chroma_client = chromadb.HttpClient(host="localhost", port=8001)
    cv_collection = chroma_client.get_or_create_collection(name="baseline_candidate_cvs")
except Exception as exc:
    print(f"[ChromaDB Warning] Vector store is unavailable: {exc}")
    cv_collection = None

PIPELINE_VERSION = "hybrid_standardized_v2"
RUBRIC_VERSION = "itss_category_rubric_v1"
MIN_CV_TEXT_LENGTH = 500
MIN_JD_TEXT_LENGTH = 300

ITSS_RUBRICS = {
    "BUSINESS_APP_DEV": {
        "label": "Business Application Development",
        "core_keywords": [
            "frontend", "backend", "web", "api", "rest api", "spring boot",
            "react", "vue", "fastapi", "database", "sql", "postgresql",
            "business system", "application", "microservices",
        ],
        "direct_roles": [
            "frontend developer", "backend developer", "fullstack developer",
            "software engineer", "web developer", "application developer",
        ],
    },
    "SYSTEM_DEV": {
        "label": "System Development",
        "core_keywords": [
            "embedded", "system", "linux", "os", "c++", "c#", "java",
            "python", "iot", "mqtt", "sensor", "smart factory", "industrial",
            "device", "performance", "backend", "api", "postgresql",
        ],
        "direct_roles": [
            "embedded engineer", "system engineer", "software engineer",
            "backend software engineer", "iot engineer",
        ],
    },
    "PROJECT_MANAGEMENT": {
        "label": "Project Management",
        "core_keywords": [
            "project management", "schedule", "planning", "risk",
            "stakeholder", "scrum", "agile", "resource", "quality",
            "delivery", "roadmap",
        ],
        "direct_roles": ["project manager", "scrum master", "team leader", "project leader"],
    },
    "IT_STRATEGY": {
        "label": "IT Strategy",
        "core_keywords": [
            "strategy", "roadmap", "architecture", "enterprise architecture",
            "business analysis", "solution design", "consulting", "it planning",
        ],
        "direct_roles": ["it consultant", "solution architect", "business analyst", "it strategist"],
    },
    "IT_SERVICE_MANAGEMENT": {
        "label": "IT Service Management",
        "core_keywords": [
            "it support", "helpdesk", "service desk", "incident",
            "troubleshooting", "user support", "account management",
            "device setup", "windows", "microsoft office", "itil",
        ],
        "direct_roles": ["it support", "helpdesk", "service desk engineer", "it support engineer"],
    },
    "NETWORK_INFRA": {
        "label": "Network / Infrastructure",
        "core_keywords": [
            "network", "infrastructure", "server", "linux", "cloud", "aws",
            "azure", "docker", "kubernetes", "ci/cd", "security", "firewall",
            "devops", "monitoring",
        ],
        "direct_roles": [
            "infrastructure engineer", "network engineer", "cloud engineer",
            "devops engineer", "security engineer",
        ],
    },
    "GENERAL_IT": {
        "label": "General IT",
        "core_keywords": ["software", "system", "database", "api", "cloud", "network"],
        "direct_roles": ["engineer", "developer", "it engineer"],
    },
}

CATEGORY_COMPATIBILITY = {
    ("BUSINESS_APP_DEV", "SYSTEM_DEV"): "MEDIUM",
    ("SYSTEM_DEV", "BUSINESS_APP_DEV"): "MEDIUM",
    ("SYSTEM_DEV", "NETWORK_INFRA"): "MEDIUM",
    ("NETWORK_INFRA", "SYSTEM_DEV"): "MEDIUM",
    ("IT_SERVICE_MANAGEMENT", "NETWORK_INFRA"): "MEDIUM",
    ("NETWORK_INFRA", "IT_SERVICE_MANAGEMENT"): "MEDIUM",
    ("IT_SERVICE_MANAGEMENT", "BUSINESS_APP_DEV"): "HIGH",
    ("IT_SERVICE_MANAGEMENT", "SYSTEM_DEV"): "HIGH",
    ("BUSINESS_APP_DEV", "IT_SERVICE_MANAGEMENT"): "HIGH",
    ("SYSTEM_DEV", "IT_SERVICE_MANAGEMENT"): "HIGH",
    ("PROJECT_MANAGEMENT", "BUSINESS_APP_DEV"): "MEDIUM",
    ("PROJECT_MANAGEMENT", "SYSTEM_DEV"): "MEDIUM",
    ("BUSINESS_APP_DEV", "PROJECT_MANAGEMENT"): "MEDIUM",
    ("SYSTEM_DEV", "PROJECT_MANAGEMENT"): "MEDIUM",
    ("IT_STRATEGY", "PROJECT_MANAGEMENT"): "MEDIUM",
    ("IT_STRATEGY", "BUSINESS_APP_DEV"): "MEDIUM",
    ("PROJECT_MANAGEMENT", "IT_STRATEGY"): "MEDIUM",
    ("BUSINESS_APP_DEV", "IT_STRATEGY"): "MEDIUM",
}


async def update_application_ai_fields(application_id: str, **values: Any) -> None:
    async with AsyncSessionLocal() as session:
        try:
            stmt = update(Application).where(Application.id == application_id).values(**values)
            await session.execute(stmt)
            await session.commit()
        except Exception as exc:
            await session.rollback()
            print(f"[PostgreSQL Error] Cannot update AI fields for application {application_id}: {exc}")


async def mark_ai_attempt_error(
    application_id: str,
    message: str,
    *,
    keep_existing_report: bool,
    status: str = "failed",
) -> None:
    now = datetime.utcnow()
    values: dict[str, Any] = {
        "last_ai_error": message,
        "last_ai_rerun_at": now,
        "last_ai_attempt_status": "retry_failed" if keep_existing_report else status,
        "ai_error": message,
    }

    if keep_existing_report:
        values["ai_status"] = "retry_failed"
    else:
        values.update({
            "ai_status": status,
            "report_source": "none",
            "ai_processed_at": now,
        })

    await update_application_ai_fields(application_id, **values)


async def load_application_context(application_id: str) -> dict[str, Any] | None:
    async with AsyncSessionLocal() as session:
        app_result = await session.execute(select(Application).where(Application.id == application_id))
        app_obj = app_result.scalars().first()
        if not app_obj:
            return None

        job_obj = None
        if app_obj.job_id:
            job_result = await session.execute(select(JobDescription).where(JobDescription.id == app_obj.job_id))
            job_obj = job_result.scalars().first()

        stable_gemini_report = bool(
            app_obj.report_source == "gemini"
            and app_obj.final_match_score is not None
            and app_obj.extracted_data
            and app_obj.evaluation_result
        )

        return {
            "job": job_obj,
            "stable_gemini_report": stable_gemini_report,
            "resume_id": str(app_obj.resume_id) if app_obj.resume_id else "",
        }


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


def resolve_role_mismatch_level(role_level: str, category_mismatch: str, role_alignment_score: float) -> str:
    if category_mismatch == "HIGH":
        if role_alignment_score < 60:
            return "HIGH"
        if role_alignment_score >= 70:
            return "MEDIUM"
        return stronger_mismatch_level(role_level, "MEDIUM")

    return stronger_mismatch_level(role_level, category_mismatch)


def get_itss_family_from_text(*values: Any) -> str:
    text = normalize_text(" ".join(str(value or "") for value in values))
    if not text:
        return "GENERAL_IT"

    if has_any(text, ["business application development", "application development", "business app", "software development"]):
        return "BUSINESS_APP_DEV"
    if has_any(text, ["system development", "smart factory", "embedded", "iot", "industrial system"]):
        return "SYSTEM_DEV"
    if has_any(text, ["project management", "project manager", "scrum master", "project leader"]):
        return "PROJECT_MANAGEMENT"
    if has_any(text, ["it strategy", "strategy", "consultant", "solution architect", "business analyst"]):
        return "IT_STRATEGY"
    if has_any(text, ["it service management", "it support", "helpdesk", "service desk", "itil"]):
        return "IT_SERVICE_MANAGEMENT"
    if has_any(text, ["network", "infrastructure", "cloud", "devops", "security engineer"]):
        return "NETWORK_INFRA"
    return "GENERAL_IT"


def get_job_family(job_obj: JobDescription | None) -> str:
    if not job_obj:
        return "GENERAL_IT"

    category_family = get_itss_family_from_text(job_obj.itss_category)
    if category_family != "GENERAL_IT":
        return category_family

    title_family = get_itss_family_from_text(job_obj.title)
    if title_family != "GENERAL_IT":
        return title_family

    return get_itss_family_from_text(job_obj.description_text, job_obj.requirements_text)


def infer_candidate_family(candidate_itss_category: str, cv_haystack: str) -> str:
    predicted_family = get_itss_family_from_text(candidate_itss_category)
    if predicted_family != "GENERAL_IT":
        return predicted_family

    best_family = "GENERAL_IT"
    best_score = 0.0
    for family, rubric in ITSS_RUBRICS.items():
        if family == "GENERAL_IT":
            continue
        role_bonus = 0.25 if has_any(cv_haystack, rubric["direct_roles"]) else 0.0
        score = keyword_score(cv_haystack, rubric["core_keywords"]) + role_bonus
        if score > best_score:
            best_family = family
            best_score = score

    return best_family if best_score >= 0.20 else "GENERAL_IT"


def get_category_mismatch(job_family: str, candidate_family: str) -> str:
    if not job_family or not candidate_family or "GENERAL_IT" in {job_family, candidate_family}:
        return "UNKNOWN"
    if job_family == candidate_family:
        return "LOW"
    return CATEGORY_COMPATIBILITY.get((job_family, candidate_family), "HIGH")


def level_to_int(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return int(value)
    match = re.search(r"\d+", str(value))
    return int(match.group()) if match else None


def calculate_level_fit(candidate_level: Any, job_level: Any) -> float:
    c = level_to_int(candidate_level)
    j = level_to_int(job_level)
    if c is None or j is None:
        return 60.0

    diff = c - j
    if diff == 0:
        return 100.0
    if diff == -1:
        return 75.0
    if diff <= -2:
        return 45.0
    if diff == 1:
        return 90.0
    return 75.0


def category_fit_score(mismatch_level: str) -> float:
    return {
        "LOW": 100.0,
        "MEDIUM": 75.0,
        "HIGH": 35.0,
        "UNKNOWN": 60.0,
    }.get(mismatch_level, 60.0)


def calculate_confidence(
    *,
    rubric_score: float,
    llm_score: float | None,
    embedding_score: float | None,
    role_mismatch_level: str,
    ai_status: str = "processed",
    report_source: str = "gemini",
    requirement_count: int = 0,
) -> dict:
    confidence = 100.0
    reasons = []

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

    if embedding_score is not None and embedding_score < 20 and llm_score is not None and llm_score >= 75:
        confidence -= 10
        reasons.append("Embedding similarity thấp trong khi LLM đánh giá cao.")

    confidence = clamp_score(confidence)

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

    job_family = get_job_family(job_obj)
    rubric = ITSS_RUBRICS.get(job_family, ITSS_RUBRICS["GENERAL_IT"])
    family_label = rubric["label"]
    core_score = keyword_score(cv_haystack, rubric["core_keywords"])
    role_hit = has_any(cv_haystack, rubric["direct_roles"])

    if role_hit and core_score >= 0.15:
        return 85.0, f"CV có tín hiệu vai trò và kỹ năng khớp với nhóm {family_label}.", "LOW"
    if role_hit:
        return 75.0, f"CV có tín hiệu vai trò phù hợp với nhóm {family_label}, cần xác minh thêm chiều sâu kỹ năng.", "LOW"
    if core_score >= 0.35:
        return 80.0, f"CV có nhiều kỹ năng cốt lõi phù hợp với nhóm {family_label}.", "LOW"
    if core_score >= 0.18:
        return 60.0, f"CV có một số tín hiệu liên quan đến nhóm {family_label}, nhưng chưa thật sự đầy đủ.", "MEDIUM"

    return 35.0, f"CV thiếu tín hiệu rõ ràng cho nhóm {family_label}.", "HIGH"


def calculate_hybrid_match_score(
    *,
    extracted_data: dict,
    job_obj: JobDescription | None,
    jd_text: str,
    embedding_score: float | None,
    ai_status: str = "processed",
    report_source: str = "gemini",
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
    candidate_itss_category = candidate_itss.get("category") if isinstance(candidate_itss, dict) else ""
    candidate_itss_level = candidate_itss.get("level") if isinstance(candidate_itss, dict) else None
    job_family = get_job_family(job_obj)
    candidate_family = infer_candidate_family(candidate_itss_category, cv_haystack)
    itss_category_mismatch_level = get_category_mismatch(job_family, candidate_family)
    level_fit_score = calculate_level_fit(candidate_itss_level, job_obj.itss_level if job_obj else None)
    category_score = category_fit_score(itss_category_mismatch_level)
    role_mismatch_level = resolve_role_mismatch_level(
        role_mismatch_level,
        itss_category_mismatch_level,
        role_alignment_score,
    )
    rubric_score = clamp_score(
        requirement_avg * 0.45
        + role_alignment_score * 0.30
        + level_fit_score * 0.15
        + category_score * 0.10
    )
    llm_score = extract_llm_match_score(extracted_data)

    weighted_parts = []
    if llm_score is not None:
        weighted_parts.append(("rubric", rubric_score, 0.55))
        weighted_parts.append(("llm", llm_score, 0.30))
        if embedding_score is not None:
            weighted_parts.append(("embedding", embedding_score, 0.15))
    else:
        weighted_parts.append(("rubric", rubric_score, 0.80))
        if embedding_score is not None:
            weighted_parts.append(("embedding", embedding_score, 0.20))

    total_weight = sum(weight for _, _, weight in weighted_parts)
    final_score = sum(score * weight for _, score, weight in weighted_parts) / total_weight if total_weight else rubric_score

    if role_mismatch_level == "HIGH":
        final_score = min(final_score, 45.0)
    elif role_mismatch_level == "MEDIUM":
        final_score = min(final_score, 85.0)

    score_label = "Phù hợp thấp - Có tiềm năng chuyển hướng"
    if final_score >= 80:
        score_label = "Phù hợp cao"
    elif final_score >= 60:
        score_label = "Phù hợp tiềm năng"
    elif final_score < 35:
        score_label = "Phù hợp thấp"

    confidence_result = calculate_confidence(
        rubric_score=rubric_score,
        llm_score=llm_score,
        embedding_score=embedding_score,
        role_mismatch_level=role_mismatch_level,
        ai_status=ai_status,
        report_source=report_source,
        requirement_count=len(requirement_scores),
    )

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
        "job_family": job_family,
        "candidate_family": candidate_family,
        "level_fit_score": level_fit_score,
        "category_fit_score": category_score,
        "score_label": score_label,
        "confidence_score": confidence_result["confidence_score"],
        "confidence_level": confidence_result["confidence_level"],
        "confidence_reason": confidence_result["confidence_reason"],
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
        "job_family": hybrid_result.get("job_family"),
        "candidate_family": hybrid_result.get("candidate_family"),
        "level_fit_score": hybrid_result.get("level_fit_score"),
        "category_fit_score": hybrid_result.get("category_fit_score"),
        "score_label": hybrid_result.get("score_label"),
        "confidence_score": hybrid_result.get("confidence_score"),
        "confidence_level": hybrid_result.get("confidence_level"),
        "confidence_reason": hybrid_result.get("confidence_reason"),
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
        "pipeline_version": PIPELINE_VERSION,
        "prompt_version": PROMPT_VERSION,
        "rubric_version": RUBRIC_VERSION,
        "embedding_model": "all-MiniLM-L6-v2",
        "llm_model": "gemini-2.5-flash",
    }


async def async_process_cv_pipeline(application_id: str, file_url: str):
    print(f"\n[Pipeline] Start AI processing for application ID: {application_id}")
    context = await load_application_context(application_id)
    if not context:
        print(f"[Pipeline Error] Application not found: {application_id}")
        return

    keep_existing_report = bool(context["stable_gemini_report"])
    await update_application_ai_fields(
        application_id,
        ai_status="processing",
        ai_error=None,
        last_ai_error=None,
        last_ai_rerun_at=datetime.utcnow(),
        last_ai_attempt_status="processing",
    )

    if not file_url:
        await mark_ai_attempt_error(
            application_id,
            "Resume URL is missing; cannot run AI matching.",
            keep_existing_report=keep_existing_report,
            status="failed",
        )
        return

    cv_text = get_and_parse_pdf_from_minio(file_url)
    if not cv_text:
        await mark_ai_attempt_error(
            application_id,
            f"Cannot read or parse CV file: {file_url}",
            keep_existing_report=keep_existing_report,
            status="failed",
        )
        return

    if len(cv_text.strip()) < MIN_CV_TEXT_LENGTH:
        await mark_ai_attempt_error(
            application_id,
            f"CV text is too short for reliable AI scoring ({len(cv_text.strip())} characters).",
            keep_existing_report=keep_existing_report,
            status="failed",
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

    if not job_obj:
        await mark_ai_attempt_error(
            application_id,
            "Job not found; cannot run AI matching.",
            keep_existing_report=keep_existing_report,
            status="failed",
        )
        return

    if len(jd_text.strip()) < MIN_JD_TEXT_LENGTH or not (job_obj.description_text and job_obj.requirements_text):
        await mark_ai_attempt_error(
            application_id,
            f"JD text is too short or incomplete for reliable AI scoring ({len(jd_text.strip())} characters).",
            keep_existing_report=keep_existing_report,
            status="failed",
        )
        return

    extracted_data = await extract_cv_to_json(cv_text, jd_text)
    gemini_ok = bool(extracted_data)
    if not extracted_data:
        extracted_data = {
            "raw_cv_text": cv_text,
            "skills": [],
            "itss_prediction": {},
            "ai_report": {}
        }

    report_source = "gemini" if extracted_data.get("ai_report") else "none"

    if not gemini_ok and keep_existing_report:
        await mark_ai_attempt_error(
            application_id,
            "Gemini extraction failed after retries; kept the previous successful AI report.",
            keep_existing_report=True,
            status="retry_failed",
        )
        print(f"[Pipeline] Gemini failed; kept previous processed Gemini report for application {application_id}\n")
        return

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
        report_source = report_source if gemini_ok else "fallback"
        ai_error = None if gemini_ok else "Gemini extraction failed after retries; fallback score was calculated from raw CV text."
    else:
        ai_status = "failed"
        ai_error = "Gemini extraction and embedding matching both failed."

    hybrid_result = calculate_hybrid_match_score(
        extracted_data=extracted_data or {},
        job_obj=job_obj,
        jd_text=jd_text,
        embedding_score=embedding_score,
        ai_status=ai_status,
        report_source=report_source,
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
        last_ai_error=ai_error,
        last_ai_rerun_at=datetime.utcnow(),
        last_ai_attempt_status=ai_status,
        report_source=report_source,
        ai_processed_at=datetime.utcnow(),
    )

    print(f"[Pipeline] Completed application {application_id} with ai_status={ai_status}, report_source={report_source}\n")


@celery_app.task(name="process_candidate_cv_task")
def process_candidate_cv_task(application_id: str, file_url: str):
    async def runner():
        try:
            await async_process_cv_pipeline(application_id, file_url)
        finally:
            await engine.dispose()

    asyncio.run(runner())
