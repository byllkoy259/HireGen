import asyncio
import chromadb
from sqlalchemy import update
from sqlalchemy.future import select

from app.core.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.models.models import Application, JobDescription
from app.services.ai.pdf_parser import get_and_parse_pdf_from_minio
from app.services.ai.extractor import extract_cv_to_json
from app.services.ai.embedding import get_text_embedding
from app.services.ai.matcher import baseline_match_cv_with_jd

# Kết nối tới ChromaDB đang chạy trên localhost:8000
chroma_client = chromadb.HttpClient(host="localhost", port=8001)
cv_collection = chroma_client.get_or_create_collection(name="baseline_candidate_cvs")

async def update_application_status_in_db(application_id: str, extracted_data: dict, match_score: float = None):
    """Mở session DB độc lập trong Celery Worker để cập nhật PostgreSQL."""
    async with AsyncSessionLocal() as session:
        try:
            update_values = {
                "status": "processed",
                "extracted_data": extracted_data
            }

            if match_score is not None:
                update_values["match_score"] = match_score
            
            stmt = (
                update(Application)
                .where(Application.id == application_id)
                .values(**update_values)
            )
            await session.execute(stmt)
            await session.commit()
            print(f"[PostgreSQL] Đã lưu JSON phân tích AI sâu, match_score={match_score}% và cập nhật status='processed' cho ID: {application_id}")
        except Exception as e:
            await session.rollback()
            print(f"[PostgreSQL Error] Lỗi cập nhật đơn ứng tuyển: {str(e)}")

async def async_process_cv_pipeline(application_id: str, file_url: str):
    """Luồng xử lý ngầm tích hợp Pure Generative AI Assessment."""
    print(f"\n[Pipeline] Bắt đầu xử lý ngầm cho hồ sơ ID: {application_id}")
    
    # 1. Đọc PDF sang Text thô từ MinIO
    cv_text = get_and_parse_pdf_from_minio(file_url)
    if not cv_text:
        print(f"[Pipeline Error] Không thể đọc text từ file: {file_url}")
        return

    # 2. Truy vấn DB lấy thông tin Job Description để nạp bối cảnh cho Gemini chấm điểm
    jd_text = ""
    async with AsyncSessionLocal() as session:
        try:
            app_result = await session.execute(select(Application).where(Application.id == application_id))
            app_obj = app_result.scalars().first()
            if app_obj and app_obj.job_id:
                job_result = await session.execute(select(JobDescription).where(JobDescription.id == app_obj.job_id))
                job_obj = job_result.scalars().first()
                if job_obj:
                    jd_parts = [
                        f"Vị trí tuyển dụng: {job_obj.title}",
                        f"Mô tả công việc: {job_obj.description_text}",
                        f"Yêu cầu kỹ năng: {job_obj.requirements_text}"
                    ]
                    jd_text = "\n\n".join(jd_parts)
        except Exception as e:
            print(f"[DB Error] Lỗi khi truy vấn bối cảnh JD: {e}")

    # 3. Bóc tách thông tin và yêu cầu Gemini phân tích AI Report chuyên sâu
    extracted_data = await extract_cv_to_json(cv_text, jd_text)
    full_name = extracted_data.get('personal_info', {}).get('full_name', 'Unknown')
    print(f"[Pipeline] Đã bóc tách và phân tích AI Report thành công cho ứng viên: {full_name}")

    # 4. Nhúng Vector (Embedding) cụm kỹ năng bằng mô hình cục bộ
    skills_list = extracted_data.get("skills", [])
    skills_text = ", ".join(skills_list) if skills_list else cv_text[:500] 
    cv_vector = get_text_embedding(skills_text)
    print(f"[Pipeline] Đã băm và nhúng thành vector {len(cv_vector)} chiều.")

    # 5. Lưu vào CSDL Vector (ChromaDB)
    try:
        cv_collection.add(
            embeddings=[cv_vector],
            documents=[skills_text],
            metadatas=[{
                "application_id": str(application_id), 
                "full_name": full_name,
                "itss_category": extracted_data.get("itss_prediction", {}).get("category", ""),
                "itss_level": extracted_data.get("itss_prediction", {}).get("level", 1)
            }],
            ids=[str(application_id)]
        )
        print("[ChromaDB] Đã lưu trữ thành công chunk và vector nhúng.")
    except Exception as e:
        print(f"[ChromaDB Error] Không thể lưu vector: {str(e)}")
    
    # 6. Tính điểm Matching Baseline (Cosine Similarity cục bộ)
    match_score = None
    async with AsyncSessionLocal() as session:
        try:
            app_result = await session.execute(select(Application).where(Application.id == application_id))
            app_obj = app_result.scalars().first()
            if app_obj and app_obj.job_id:
                job_result = await session.execute(select(JobDescription).where(JobDescription.id == app_obj.job_id))
                job_obj = job_result.scalars().first()
                if job_obj and job_obj.requirements_text:
                    match_score = baseline_match_cv_with_jd(skills_text, job_obj.requirements_text)
                    print(f"[Matching] Đã tính toán điểm so khớp CV và JD: {match_score}%")
        except Exception as e:
            print(f"[Matching Error] Lỗi khi tính điểm so khớp: {str(e)}")
    
    # 7. Cập nhật dữ liệu vào PostgreSQL
    await update_application_status_in_db(application_id, extracted_data, match_score)

    print(f"[End-to-End Pipeline] Hoàn tất toàn bộ dây chuyền cho hồ sơ {application_id}!\n")

@celery_app.task(name="process_candidate_cv_task")
def process_candidate_cv_task(application_id: str, file_url: str):
    """
    Celery Task bọc ngoài để nhận job từ Redis Broker.
    """
    asyncio.run(async_process_cv_pipeline(application_id, file_url))