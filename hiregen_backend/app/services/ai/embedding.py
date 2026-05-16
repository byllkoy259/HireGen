from typing import List
from app.services.ai.config import embedding_model

def get_text_embedding(text: str) -> List[float]:
    """
    Băm (chunk) hoặc chuyển đổi một đoạn văn bản (kỹ năng/kinh nghiệm)
    thành vector số thực (384 chiều) bằng mô hình cục bộ.
    """
    # encode() trả về numpy array, chuyển sang list float để lưu DB
    vector = embedding_model.encode(text)
    return vector.tolist()

def get_batch_embeddings(texts: List[str]) -> List[List[float]]:
    """
    Nhúng nhiều đoạn văn bản cùng lúc để tối ưu tốc độ.
    """
    vectors = embedding_model.encode(texts)
    return [v.tolist() for v in vectors]