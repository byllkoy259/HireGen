from google import genai
from sentence_transformers import SentenceTransformer
from app.core.config import settings

# Gemini Client
client = genai.Client(
    api_key=settings.GEMINI_API_KEY
)

# Local Embedding Model (Sentence-Transformers)
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

print("Đã tải thành công Gemini Client và Local Embedding Model!")