from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.future import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.models import User
from app.core.security import get_password_hash
from app.api import auth, job, company, admin, candidate, interview, notification, application, skill, hr, upload, ai

async def create_init_admin():
    async with AsyncSessionLocal() as db:
        admin_email = settings.ADMIN_EMAIL
        admin_password = settings.ADMIN_PASSWORD

        # 1. Kiểm tra xem Admin đã tồn tại chưa
        result = await db.execute(select(User).where(User.email == admin_email))
        admin_user = result.scalars().first()
        
        # 2. Nếu chưa có thì mới tạo mới
        if not admin_user:
            hashed_pw = get_password_hash(admin_password)
            new_admin = User(
                email=admin_email,
                password_hash=hashed_pw,
                role="Admin",
                is_verified=True
            )
            db.add(new_admin)
            await db.commit()
            print(f"Đã khởi tạo tài khoản Admin ({admin_email})!")
        else:
            print("Tài khoản Admin đã tồn tại, bỏ qua.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_init_admin()
    yield
    print("Hệ thống đang tắt...")

app = FastAPI(
    title="HireGen API",
    description="AI-Powered IT Recruitment Support and Candidate Assessment System for the Japanese Market",
    version="1.0.0",
    lifespan=lifespan
)

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(job.router)
app.include_router(company.router)
app.include_router(admin.router)
app.include_router(candidate.router)
app.include_router(interview.router)
app.include_router(notification.router)
app.include_router(application.router)
app.include_router(skill.router)
app.include_router(hr.router)
app.include_router(upload.router)
app.include_router(ai.router)

@app.get("/")
async def root():
    return {
        "message": "Welcome to HireGen API",
        "status": "Running",
        "database_status": "Configured" if settings.DATABASE_URL else "Error"
    }

@app.get("/health-check")
async def health_check():
    return {"status": "healthy"}