import json
import asyncio
from app.services.ai.config import client

async def extract_cv_to_json(cv_text: str, jd_text: str = "") -> dict:
    """
    Sử dụng Gemini Flash để đọc CV text, đối chiếu ngữ cảnh trực tiếp với JD (nếu có),
    trích xuất thông tin định danh và thực hiện tư duy đánh giá AI chuyên sâu.
    """
    jd_section = f"\n\nJOB DESCRIPTION (JD):\n{jd_text}" if jd_text.strip() else ""

    prompt = f"""
    Bạn là một chuyên gia tuyển dụng IT cấp cao tại thị trường Nhật Bản (AI Headhunter).
    Nhiệm vụ của bạn là phân tích sâu file CV của ứng viên, đối chiếu với Job Description (nếu có)
    để bóc tách thông tin cá nhân và đưa ra đánh giá toàn diện theo chuẩn kỹ năng ITSS.

    Hãy trả về duy nhất một chuỗi JSON hợp lệ theo đúng cấu trúc dưới đây.
    KHÔNG sử dụng định dạng markdown (như ```json).
    KHÔNG thêm bất kỳ lời giải thích nào khác.

    Schema đầu ra bắt buộc:
    {{
        "personal_info": {{
            "full_name": "Họ và tên ứng viên",
            "email": "Email",
            "phone": "Số điện thoại"
        }},
        "education": [
            {{
                "school": "Tên trường",
                "major": "Chuyên ngành",
                "degree": "Bằng cấp"
            }}
        ],
        "experience": [
            {{
                "company": "Tên công ty / Tổ chức",
                "position": "Vị trí",
                "duration": "Thời gian",
                "description": "Mô tả công việc"
            }}
        ],
        "skills": ["Kỹ năng 1", "Kỹ năng 2", "Kỹ năng 3"],
        "itss_prediction": {{
            "category": "Cấp độ ITSS dự đoán (VD: Entry, Junior, Independent, Professional, Lead)",
            "level": 3
        }},
        "ai_report": {{
            "ai_summary": "Đoạn văn phân tích ngắn gọn (khoảng 4-5 câu) nhận xét sâu về mức độ phù hợp của ứng viên với JD, thế mạnh cốt lõi và tiềm năng phát triển tại môi trường làm việc Nhật Bản.",
            "radar_data": [
                {{"label": "Chuyên môn", "candidate": 85, "required": 80}},
                {{"label": "Kinh nghiệm", "candidate": 80, "required": 75}},
                {{"label": "Ngoại ngữ", "candidate": 75, "required": 70}},
                {{"label": "Kỹ năng mềm", "candidate": 80, "required": 75}},
                {{"label": "Văn hóa Nhật", "candidate": 75, "required": 80}}
            ],
            "gaps": [
                {{
                    "skill": "Tên kỹ năng thiếu hụt hoặc cần cải thiện",
                    "required": 4,
                    "actual": 3,
                    "note": "Nhận xét chi tiết lý do và định hướng khắc phục"
                }}
            ],
            "ai_questions": [
                {{
                    "category": "Kỹ thuật chuyên sâu",
                    "question": "Câu hỏi phỏng vấn khai thác sâu vào một dự án/kỹ năng cụ thể trong CV",
                    "intent": "Mục đích đánh giá của câu hỏi"
                }},
                {{
                    "category": "Văn hóa & Quy trình",
                    "question": "Câu hỏi tình huống ứng xử, quy tắc Horenso hoặc làm việc nhóm",
                    "intent": "Mục đích đánh giá"
                }},
                {{
                    "category": "Định hướng phát triển",
                    "question": "Câu hỏi về mục tiêu nghề nghiệp theo thang đo ITSS",
                    "intent": "Mục đích đánh giá"
                }}
            ]
        }}
    }}

    NỘI DUNG CV:
    {cv_text}{jd_section}
    """
    
    try:
        response = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-2.5-flash",
            contents=prompt
        )
        
        raw_text = response.text.strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:-3].strip()
        elif raw_text.startswith("```"):
            raw_text = raw_text[3:-3].strip()
            
        return json.loads(raw_text)
    except Exception as e:
        print(f"[Extractor Error] Lỗi khi trích xuất và phân tích CV bằng Gemini: {e}")
        return {}