import io
from pypdf import PdfReader
from app.services.minio_service import minio_service

def parse_pdf_bytes_to_text(pdf_bytes: bytes) -> str:
    """
    Đọc dữ liệu bytes của file PDF trên RAM và trích xuất ra chuỗi text thô.
    """
    try:
        pdf_file = io.BytesIO(pdf_bytes)
        reader = PdfReader(pdf_file)
        
        extracted_text = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                extracted_text.append(text)
                
        # Gộp nội dung các trang và làm sạch khoảng trắng dư thừa
        full_text = "\n".join(extracted_text)
        return full_text.strip()
    except Exception as e:
        print(f"[PDF Parser Error] Lỗi khi trích xuất text từ PDF bytes: {str(e)}")
        return ""

def get_and_parse_pdf_from_minio(object_name_or_url: str) -> str:
    """
    Hàm gộp luồng: Tải file PDF từ MinIO về RAM và trích xuất toàn bộ nội dung text.
    """
    try:
        print(f"Đang tải file từ MinIO: {object_name_or_url}")
        pdf_bytes = minio_service.get_file_data(object_name_or_url)
        
        print("Đang bóc tách text từ PDF...")
        text = parse_pdf_bytes_to_text(pdf_bytes)
        
        print(f"Bóc tách thành công ({len(text)} ký tự).")
        return text
    except Exception as e:
        print(f"[PDF Integration Error] Lỗi luồng tải và đọc PDF: {str(e)}")
        return ""