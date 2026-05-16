from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "hiregen_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.services.ai.tasks"]
)

# Cấu hình chuẩn hóa định dạng dữ liệu truyền tải (JSON) và múi giờ Việt Nam
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Ho_Chi_Minh",
    enable_utc=True,
)

print("Đã khởi tạo Celery App kết nối với Redis thành công!")