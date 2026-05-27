import asyncio
import json
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from app.services.ai.config import client


PROMPT_VERSION = "gemini_cv_extract_vi_v3"
GEMINI_RETRY_DELAYS = [10, 30, 60]


class AIReportPayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    ai_summary: str = ""
    match_score: float | None = None
    score_reason: str = ""
    radar_data: list[dict[str, Any]] = Field(default_factory=list)
    gaps: list[dict[str, Any]] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    recommendation: str = ""
    ai_questions: list[dict[str, Any]] = Field(default_factory=list)


class ExtractedCVPayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    personal_info: dict[str, Any] = Field(default_factory=dict)
    education: list[dict[str, Any]] = Field(default_factory=list)
    experience: list[dict[str, Any]] = Field(default_factory=list)
    hard_skills: list[str] = Field(default_factory=list)
    soft_skills: list[str] = Field(default_factory=list)
    languages: list[dict[str, Any]] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    itss_prediction: dict[str, Any] = Field(default_factory=dict)
    ai_report: AIReportPayload


def clean_json_text(raw_text: str) -> str:
    text = raw_text.strip()
    if text.startswith("```json"):
        return text[7:-3].strip()
    if text.startswith("```"):
        return text[3:-3].strip()
    return text


def validate_extracted_payload(raw_text: str) -> dict:
    data = json.loads(clean_json_text(raw_text))
    payload = ExtractedCVPayload.model_validate(data)
    normalized = payload.model_dump()

    if not normalized.get("skills"):
        combined_skills = []
        for key in ("hard_skills", "soft_skills"):
            if isinstance(normalized.get(key), list):
                combined_skills.extend(normalized[key])
        normalized["skills"] = list(dict.fromkeys(str(skill).strip() for skill in combined_skills if str(skill).strip()))

    normalized["prompt_version"] = PROMPT_VERSION
    return normalized


async def generate_gemini_text(prompt: str) -> str:
    response = await asyncio.to_thread(
        client.models.generate_content,
        model="gemini-2.5-flash",
        contents=prompt,
    )
    return response.text.strip()


async def repair_json_payload(raw_text: str, error: Exception) -> dict:
    repair_prompt = f"""
    The following text was intended to be one JSON object for a CV assessment, but parsing or schema validation failed.
    Return exactly one corrected valid JSON object. Do not use markdown. Keep all report text in Vietnamese.

    Validation error:
    {str(error)}

    Original text:
    {raw_text}
    """
    repaired_text = await generate_gemini_text(repair_prompt)
    return validate_extracted_payload(repaired_text)


async def extract_cv_to_json(cv_text: str, jd_text: str = "") -> dict:
    """
    Use Gemini to extract a structured CV profile and a readable CV-JD report.
    Matching score is calculated later by the standardized evaluation pipeline.
    """
    jd_section = f"\n\nJOB DESCRIPTION (JD):\n{jd_text}" if jd_text.strip() else ""

    prompt = f"""
    You are a senior IT recruiter for the Japanese market.
    Analyze the candidate CV and compare it with the JD when provided.
    Return exactly one valid JSON object. Do not wrap it in markdown. Do not add explanations outside JSON.
    For ai_report.match_score, return your own numeric 0-100 fit score, not a placeholder.
    Write ai_report.ai_summary, ai_report.score_reason, ai_report.gaps, ai_report.strengths, ai_report.weaknesses,
    ai_report.recommendation, and ai_report.ai_questions in Vietnamese.
    The match score must reflect fit for the target JD, not general IT strength. Penalize clear role or ITSS category
    mismatch even when the candidate has strong adjacent technical skills.
    Separate these two tasks clearly:
    1. Predict the candidate's ITSS category and ITSS level from the CV evidence only.
    2. Assess how well that candidate fits the current JD.
    Do not copy the JD category into itss_prediction unless the CV itself supports it.
    If the CV is Software Development but the JD is IT Service Management, keep the candidate prediction as Software
    Development and describe the mismatch in ai_report.score_reason, gaps, weaknesses, and recommendation.
    Valid ITSS categories:
    - Business Application Development
    - System Development
    - Project Management
    - IT Strategy
    - IT Service Management
    - Network / Infrastructure

    Output schema:
    {{
      "personal_info": {{
        "full_name": "Candidate full name",
        "email": "Email",
        "phone": "Phone number"
      }},
      "education": [
        {{
          "school": "School name",
          "major": "Major",
          "degree": "Degree"
        }}
      ],
      "experience": [
        {{
          "company": "Company / organization",
          "position": "Position",
          "duration": "Duration",
          "description": "Work description"
        }}
      ],
      "hard_skills": ["Python", "FastAPI", "PostgreSQL"],
      "soft_skills": ["Teamwork", "Communication"],
      "languages": [
        {{
          "language": "Japanese",
          "level": "N4"
        }}
      ],
      "skills": ["Backward-compatible combined skills list"],
      "itss_prediction": {{
        "category": "Business Application Development",
        "level": 2,
        "level_label": "Junior",
        "reason": "Short reason for this ITSS prediction"
      }},
      "ai_report": {{
        "ai_summary": "4-5 câu tiếng Việt nhận xét mức độ phù hợp với JD, thế mạnh, điểm lệch vai trò, rủi ro và tiềm năng tại môi trường Nhật.",
        "match_score": 0,
        "score_reason": "Giải thích ngắn bằng tiếng Việt cho điểm 0-100. Cân nhắc role fit, must-have, seniority, ngôn ngữ, ITSS category/level và gap có thể đào tạo hay không.",
        "radar_data": [
          {{"label": "Chuyên môn", "candidate": 80, "required": 80}},
          {{"label": "Kinh nghiệm", "candidate": 70, "required": 75}},
          {{"label": "Ngoại ngữ", "candidate": 60, "required": 70}},
          {{"label": "Kỹ năng mềm", "candidate": 75, "required": 75}},
          {{"label": "Văn hóa Nhật", "candidate": 65, "required": 80}}
        ],
        "gaps": [
          {{
            "skill": "AWS",
            "required": 4,
            "actual": 2,
            "note": "Giải thích bằng tiếng Việt vì sao gap này quan trọng và HR nên xác minh thế nào"
          }}
        ],
        "strengths": ["Thế mạnh cụ thể từ CV bằng tiếng Việt"],
        "weaknesses": ["Điểm yếu hoặc điểm chưa chắc chắn bằng tiếng Việt"],
        "recommendation": "Khuyến nghị bằng tiếng Việt",
        "ai_questions": [
          {{
            "category": "Kỹ thuật chuyên sâu",
            "question": "Câu hỏi phỏng vấn bằng tiếng Việt dựa trên CV và JD",
            "intent": "Mục đích đánh giá bằng tiếng Việt"
          }}
        ]
      }}
    }}

PROMPT VERSION:
{PROMPT_VERSION}

CV CONTENT:
{cv_text}{jd_section}
"""

    last_error: Exception | None = None
    for attempt in range(len(GEMINI_RETRY_DELAYS) + 1):
        try:
            raw_text = await generate_gemini_text(prompt)
            try:
                return validate_extracted_payload(raw_text)
            except (json.JSONDecodeError, ValidationError, TypeError, ValueError) as validation_error:
                print(f"[Extractor Warning] Gemini JSON validation failed, attempting one repair: {validation_error}")
                return await repair_json_payload(raw_text, validation_error)
        except Exception as exc:
            last_error = exc
            if attempt < len(GEMINI_RETRY_DELAYS):
                delay = GEMINI_RETRY_DELAYS[attempt]
                print(f"[Extractor Warning] Gemini extraction attempt {attempt + 1} failed: {exc}. Retrying in {delay}s...")
                await asyncio.sleep(delay)
            else:
                break

    print(f"[Extractor Error] Gemini extraction failed after retries: {last_error}")
    return {}
