from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.core.config import settings

# 1. Khởi tạo Async Engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=True,
    pool_pre_ping=True
)

# 2. Khởi tạo Async SessionLocal
AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# 3. Base class (Chuẩn SQLAlchemy 2.0)
class Base(DeclarativeBase):
    pass

# 4. Dependency function cung cấp session bất đồng bộ cho API
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session