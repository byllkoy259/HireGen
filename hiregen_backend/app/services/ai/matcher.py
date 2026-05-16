import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from app.services.ai.embedding import get_text_embedding

def calculate_cosine_similarity_score(vector_a: list, vector_b: list) -> float:
    """
    Tính toán độ tương đồng Cosine giữa 2 vector.
    Trả về điểm số Matching dạng phần trăm (%).
    """
    # Reshape về dạng 2D array (1, n) theo yêu cầu của scikit-learn
    arr_a = np.array(vector_a).reshape(1, -1)
    arr_b = np.array(vector_b).reshape(1, -1)
    
    # Kết quả nằm trong khoảng [-1, 1], với text thường là [0, 1]
    similarity = cosine_similarity(arr_a, arr_b)[0][0]
    
    # Đưa về thang điểm % (tránh trường hợp số âm do nhiễu)
    matching_percentage = max(0.0, float(similarity) * 100)
    return round(matching_percentage, 2)

def baseline_match_cv_with_jd(cv_skills_text: str, jd_requirements_text: str) -> float:
    """
    Hàm gộp luồng Baseline: Nhúng 2 chuỗi text và tính điểm so khớp.
    """
    cv_vector = get_text_embedding(cv_skills_text)
    jd_vector = get_text_embedding(jd_requirements_text)
    
    return calculate_cosine_similarity_score(cv_vector, jd_vector)