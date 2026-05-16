from fastapi import APIRouter, HTTPException
from app.services.ai.extractor import extract_cv_to_json
from app.services.ai.matcher import baseline_match_cv_with_jd

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
    
    data = await extract_cv_to_json(request.cv_text)
    
    if not data:
        raise HTTPException(status_code=500, detail="Không thể trích xuất dữ liệu từ Gemini")
        
    return {
        "status": "success",
        "extracted_data": data
    }

@router.post("/test-match", response_model=AIMatchResponse)
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
            "algorithm": "Baseline (Sentence-Transformers + Cosine Similarity)"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi tính toán so khớp: {str(e)}")