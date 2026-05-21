import asyncio
import json

from app.services.ai.config import client


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

CV CONTENT:
{cv_text}{jd_section}
"""

    try:
        response = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-2.5-flash",
            contents=prompt,
        )

        raw_text = response.text.strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:-3].strip()
        elif raw_text.startswith("```"):
            raw_text = raw_text[3:-3].strip()

        data = json.loads(raw_text)
        if "skills" not in data:
            combined_skills = []
            for key in ("hard_skills", "soft_skills"):
                if isinstance(data.get(key), list):
                    combined_skills.extend(data[key])
            data["skills"] = list(dict.fromkeys(str(skill).strip() for skill in combined_skills if str(skill).strip()))
        return data
    except Exception as exc:
        print(f"[Extractor Error] Gemini extraction failed: {exc}")
        return {}
