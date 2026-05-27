import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.models import User, HRProfile, Company
from app.schemas.user import UserResponse
from app.schemas.admin import HRUpdateByAdmin, RoleUpdate, HRCreateByAdmin, HRAccountResponse
from app.schemas.company import CompanyCreate, CompanyResponse, CompanyUpdate
from sqlalchemy.orm import selectinload
from app.api.deps import get_current_admin

router = APIRouter(
    prefix="/api/admin",
    tags=["Admin"]
)

# API lấy danh sách người dùng
@router.get("/users", response_model=List[UserResponse])
async def get_all_users(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    result = await db.execute(select(User))
    return result.scalars().all()

# API cấp quyền/đổi role người dùng
@router.put("/users/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: uuid.UUID,
    role_update: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    # Kiểm tra tính hợp lệ của Role
    if role_update.role not in ["HR", "Candidate", "Admin"]:
        raise HTTPException(status_code=400, detail="Role không hợp lệ. Chỉ chấp nhận 'HR', 'Candidate', 'Admin'.")
    
    # Tìm user trong DB
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng này trong hệ thống.")
    
    # Cập nhật Role và tự động verify nếu cấp quyền HR
    user.role = role_update.role
    if user.role == "HR":
        user.is_verified = True
        
    await db.commit()
    await db.refresh(user)
    
    return user

# API xóa người dùng
@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    # Bước 1: Bảo vệ Admin khỏi tự xóa
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Bạn không thể tự xóa tài khoản Admin của chính mình đang đăng nhập."
        )

    # Bước 2: Tìm user trong hệ thống
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng này trong hệ thống.")

    # Bước 3: Xóa user khỏi Database
    await db.delete(user)
    await db.commit()
    
    return None

# API GET list HR
@router.get("/hr-accounts", response_model=List[HRAccountResponse])
async def get_hr_accounts(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    result = await db.execute(
        select(User)
        .where(User.role == "HR")
        .options(selectinload(User.companies), selectinload(User.hr_profile))
    )
    users = result.scalars().all()
    
    response = []
    for user in users:
        response.append(HRAccountResponse(
            id=user.id,
            email=user.email,
            full_name=user.hr_profile.full_name if hasattr(user, 'hr_profile') and user.hr_profile else user.email.split('@')[0],
            avatar_url=user.hr_profile.avatar_url if user.hr_profile else None,
            is_verified=user.is_verified,
            created_at=user.created_at,
            companies=user.companies
        ))
    return response

# API GET list Companies
@router.get("/companies", response_model=List[CompanyResponse])
async def get_all_companies(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    result = await db.execute(select(Company).options(selectinload(Company.hr_representatives)))
    companies = result.scalars().all()
    return [
        CompanyResponse(
            id=c.id,
            name=c.name,
            website=c.website,
            description=c.description,
            industry=c.industry,
            logo_url=c.logo_url,
            created_at=c.created_at,
            hr_count=len(c.hr_representatives)
        ) for c in companies
    ]

# API CREATE Company
@router.post("/companies", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
async def create_company(
    company_in: CompanyCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    new_company = Company(**company_in.model_dump())
    db.add(new_company)
    await db.commit()
    await db.refresh(new_company)
    return new_company

# API UPDATE Company
@router.put("/companies/{company_id}", response_model=CompanyResponse)
async def update_company(
    company_id: uuid.UUID,
    company_update: CompanyUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    result = await db.execute(
        select(Company).where(Company.id == company_id).options(selectinload(Company.hr_representatives))
    )
    company = result.scalars().first()
    if not company:
        raise HTTPException(status_code=404, detail="Không tìm thấy đối tác này.")
    
    update_data = company_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(company, key, value)
        
    res_hr_count = len(company.hr_representatives)
    res_id = company.id
    res_name = company.name
    res_website = company.website
    res_desc = company.description
    res_industry = company.industry
    res_logo = company.logo_url
    res_created = company.created_at

    await db.commit()
    
    return CompanyResponse(
        id=res_id,
        name=res_name,
        website=res_website,
        description=res_desc,
        industry=res_industry,
        logo_url=res_logo,
        created_at=res_created,
        hr_count=res_hr_count
    )

# API DELETE Company
@router.delete("/companies/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_company(
    company_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalars().first()
    if not company:
        raise HTTPException(status_code=404, detail="Không tìm thấy đối tác này.")
        
    await db.delete(company)
    await db.commit()
    return None

# API Tạo nhanh tài khoản HR kèm Công ty phụ trách
@router.post("/hr-accounts", response_model=HRAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_hr_account(
    hr_in: HRCreateByAdmin,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    result = await db.execute(select(User).where(User.email == hr_in.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email này đã tồn tại trong hệ thống.")

    valid_uuids = []
    for cid in hr_in.company_ids:
        try:
            valid_uuids.append(uuid.UUID(cid))
        except ValueError:
            pass
            
    companies = []
    if valid_uuids:
        companies_res = await db.execute(select(Company).where(Company.id.in_(valid_uuids)))
        companies = list(companies_res.scalars().all())

    hashed_password = get_password_hash(hr_in.password)

    new_user = User(
        email=hr_in.email,
        password_hash=hashed_password,
        role="HR",
        is_verified=True,
        companies=companies
    )
    db.add(new_user)
    await db.flush()

    new_hr_profile = HRProfile(
        user_id=new_user.id,
        full_name=hr_in.full_name
    )
    db.add(new_hr_profile)

    await db.commit()
    await db.refresh(new_user)

    return HRAccountResponse(
        id=new_user.id,
        email=new_user.email,
        full_name=hr_in.full_name,
        avatar_url=new_hr_profile.avatar_url,
        is_verified=new_user.is_verified,
        created_at=new_user.created_at,
        companies=companies
    )

# API cập nhật thông tin HR
@router.patch("/hr-accounts/{user_id}", response_model=HRAccountResponse)
async def update_hr_account(
    user_id: uuid.UUID,
    hr_update: HRUpdateByAdmin,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    # Tìm user
    result = await db.execute(
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.companies), selectinload(User.hr_profile))
    )
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng này.")

    # Cập nhật trạng thái (ví dụ khóa/mở khóa)
    if hr_update.is_verified is not None:
        user.is_verified = hr_update.is_verified
        
    # Cập nhật email
    if hr_update.email is not None and hr_update.email != user.email:
        existing = await db.execute(select(User).where(User.email == hr_update.email))
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail="Email này đã tồn tại trong hệ thống.")
        user.email = hr_update.email
        
    # Cập nhật mật khẩu
    if hr_update.password is not None and hr_update.password.strip():
        user.password_hash = get_password_hash(hr_update.password)
        
    # Nếu có sửa tên HR Profile
    if hr_update.full_name is not None:
        if user.hr_profile:
            user.hr_profile.full_name = hr_update.full_name

    # Cập nhật companies
    if hr_update.company_ids is not None:
        valid_uuids = []
        for cid in hr_update.company_ids:
            try:
                valid_uuids.append(uuid.UUID(cid))
            except ValueError:
                pass
                
        if valid_uuids:
            companies_res = await db.execute(select(Company).where(Company.id.in_(valid_uuids)))
            user.companies = list(companies_res.scalars().all())
        else:
            user.companies = []

    # Lấy dữ liệu trước khi commit để tránh MissingGreenlet do db.refresh()
    res_companies = user.companies
    res_full_name = user.hr_profile.full_name if user.hr_profile else user.email.split('@')[0]
    res_email = user.email
    res_avatar_url = user.hr_profile.avatar_url if user.hr_profile else None
    res_is_verified = user.is_verified
    res_created_at = user.created_at
    res_id = user.id

    await db.commit()
    
    return HRAccountResponse(
        id=res_id,
        email=res_email,
        full_name=res_full_name,
        avatar_url=res_avatar_url,
        is_verified=res_is_verified,
        created_at=res_created_at,
        companies=res_companies
    )
