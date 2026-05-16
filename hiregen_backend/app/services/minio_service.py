import json
import io
from minio import Minio
from minio.error import S3Error
from app.core.config import settings

class MinIOService:
    def __init__(self):
        self.client = Minio(
            endpoint=settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE
        )
        self.bucket_name = settings.MINIO_BUCKET_NAME
        # Khởi tạo thử, nhưng không sao nếu thất bại (sẽ gánh lại ở hàm upload)
        self._ensure_bucket_exists()

    def _ensure_bucket_exists(self):
        """Kiểm tra và tạo bucket kèm quyền đọc công khai (Public Read)."""
        try:
            if not self.client.bucket_exists(self.bucket_name):
                print(f"[MinIO] Bucket '{self.bucket_name}' chưa tồn tại. Đang khởi tạo...")
                self.client.make_bucket(self.bucket_name)
                
                # Cấu hình Policy cho phép trình duyệt đọc file công khai
                policy = {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Principal": {"AWS": ["*"]},
                            "Action": ["s3:GetObject"],
                            "Resource": [f"arn:aws:s3:::{self.bucket_name}/*"]
                        }
                    ]
                }
                self.client.set_bucket_policy(self.bucket_name, json.dumps(policy))
                print(f"[MinIO] Đã tạo bucket và gắn policy Public Read thành công!")
        except S3Error as err:
            print(f"[MinIO S3Error] Lỗi khi tạo bucket: {err}")
        except Exception as err:
            print(f"[MinIO Error] Không thể kết nối hoặc khởi tạo: {err}")

    def upload_file(self, object_name: str, file_data: bytes, content_type: str) -> str:
        """Upload file lên Object Storage và trả về đường dẫn truy cập."""
        try:
            self._ensure_bucket_exists()

            data_stream = io.BytesIO(file_data)
            self.client.put_object(
                bucket_name=self.bucket_name,
                object_name=object_name,
                data=data_stream,
                length=len(file_data),
                content_type=content_type
            )
            
            scheme = "https" if settings.MINIO_SECURE else "http"
            return f"{scheme}://{settings.MINIO_ENDPOINT}/{self.bucket_name}/{object_name}"
            
        except Exception as e:
            print(f"[MinIO Upload Exception] Chi tiết lỗi: {str(e)}")
            raise Exception(f"Lỗi upload file lên MinIO: {str(e)}")

    def get_file_data(self, object_name: str) -> bytes:
        """
        Tải dữ liệu file từ MinIO về bộ nhớ RAM dưới dạng bytes.
        Hỗ trợ tự động bóc tách object_name nếu đầu vào là một URL đầy đủ.
        """
        try:
            # Nếu truyền vào full URL, cắt lấy phần object_name chuẩn phía sau bucket
            bucket_prefix = f"/{self.bucket_name}/"
            if bucket_prefix in object_name:
                object_name = object_name.split(bucket_prefix)[-1]

            response = self.client.get_object(self.bucket_name, object_name)
            data = response.read()
            return data
        except Exception as e:
            print(f"[MinIO Download Exception] Không thể tải object '{object_name}': {str(e)}")
            raise Exception(f"Lỗi tải file từ MinIO: {str(e)}")
        finally:
            if 'response' in locals():
                response.close()
                response.release_conn()

minio_service = MinIOService()