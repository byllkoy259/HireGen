from typing import List
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.models.models import User, Company
from app.schemas.company import CompanyCreate, CompanyResponse, CompanyUpdate
from app.api.deps import get_current_hr

router = APIRouter(
    prefix="/api/companies",
    tags=["Companies"]
)

# 1. API tạo công ty khách hàng
@router.post("/", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
async def create_company(
    company_in: CompanyCreate,
    db: AsyncSession = Depends(get_db),
    current_hr: User = Depends(get_current_hr)
):
    new_company = Company(
        name=company_in.name,
        website=company_in.website,
        description=company_in.description,
        industry=company_in.industry,
        logo_url=company_in.logo_url,
        hr_representatives=[current_hr]  # Cập nhật chuẩn theo models.py
    )

    db.add(new_company)
    await db.commit()
    await db.refresh(new_company)

    return new_company

# 2. API lấy danh sách công ty do bản thân phụ trách
@router.get("/me", response_model=List[CompanyResponse])
async def get_my_companies(
    db: AsyncSession = Depends(get_db),
    current_hr: User = Depends(get_current_hr)
):
    # Sử dụng toán tử .any() để truy vấn qua bảng trung gian (An toàn tuyệt đối trong AsyncSession)
    query = select(Company).where(
        Company.hr_representatives.any(User.id == current_hr.id)
    )
    result = await db.execute(query)
    companies = result.scalars().all()
    return companies

# 3. API lấy danh sách tất cả công ty
@router.get("/public", response_model=List[CompanyResponse])
async def get_public_companies(db: AsyncSession = Depends(get_db)):
    query = select(Company)
    result = await db.execute(query)
    companies = result.scalars().all()
    return companies

# 4. API cập nhật thông tin công ty
@router.put("/{company_id}", response_model=CompanyResponse)
async def update_company(
    company_id: uuid.UUID,
    company_in: CompanyUpdate,
    db: AsyncSession = Depends(get_db),
    current_hr: User = Depends(get_current_hr) 
):
    # Bổ sung kiểm tra IDOR: HR phải nằm trong danh sách phụ trách mới được quyền sửa thông tin
    query = select(Company).where(
        Company.id == company_id,
        Company.hr_representatives.any(User.id == current_hr.id)
    )
    result = await db.execute(query)
    company = result.scalars().first()
    
    if not company:
        raise HTTPException(
            status_code=404, 
            detail="Không tìm thấy công ty hoặc bạn không có quyền chỉnh sửa đối tác này."
        )

    # Cập nhật các trường có dữ liệu gửi lên
    update_data = company_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(company, field, value)

    await db.commit()
    await db.refresh(company)

    return company