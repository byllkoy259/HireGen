import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, Text, Integer, ForeignKey, DateTime, Date, Float, Numeric, Table, Column
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

# Quản lý người dùng và doanh nghiệp

hr_company_association = Table(
    "hr_company_assignments",
    Base.metadata,
    Column("hr_id", UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("company_id", UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), primary_key=True)
)

class User(Base):
    __tablename__ = "users"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False) # 'HR', 'Candidate', 'Admin'
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Quan hệ
    companies: Mapped[list["Company"]] = relationship(
        secondary=hr_company_association,
        back_populates="hr_representatives"
    )
    jobs: Mapped[list["JobDescription"]] = relationship(back_populates="hr")
    candidate_profile: Mapped["Candidate"] = relationship(back_populates="user", uselist=False)
    notifications: Mapped[list["Notification"]] = relationship(back_populates="user")
    hr_profile: Mapped["HRProfile"] = relationship(back_populates="user", uselist=False)
    admin_profile: Mapped["AdminProfile"] = relationship(back_populates="user", uselist=False)

class Company(Base):
    __tablename__ = "companies"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    website: Mapped[str] = mapped_column(String(255), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    industry: Mapped[str] = mapped_column(String(255), nullable=True)
    logo_url: Mapped[str] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Quan hệ
    hr_representatives: Mapped[list["User"]] = relationship(
        secondary=hr_company_association,
        back_populates="companies"
    )
    jobs: Mapped[list["JobDescription"]] = relationship(back_populates="company")   

class Candidate(Base):
    __tablename__ = "candidates"
    
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Các trường thông tin cơ bản
    avatar_url: Mapped[str] = mapped_column(String(255), nullable=True)
    about_me: Mapped[str] = mapped_column(Text, nullable=True)
    phone: Mapped[str] = mapped_column(String(50), nullable=True)
    date_of_birth: Mapped[datetime.date] = mapped_column(Date, nullable=True)
    address: Mapped[str] = mapped_column(String(255), nullable=True)
    years_of_experience: Mapped[float] = mapped_column(Float, nullable=True)
    desired_position: Mapped[str] = mapped_column(String(255), nullable=True)
    github_url: Mapped[str] = mapped_column(String(255), nullable=True)
    linkedin_url: Mapped[str] = mapped_column(String(255), nullable=True)
    portfolio_url: Mapped[str] = mapped_column(String(255), nullable=True)

    # Các trường thông tin chi tiết hơn (Lưu dưới dạng JSON để linh hoạt)
    tech_skills: Mapped[list] = mapped_column(JSONB, nullable=True)
    soft_skills: Mapped[list] = mapped_column(JSONB, nullable=True)
    education: Mapped[list] = mapped_column(JSONB, nullable=True)
    work_experience: Mapped[list] = mapped_column(JSONB, nullable=True)
    projects: Mapped[list] = mapped_column(JSONB, nullable=True)
    certifications: Mapped[list] = mapped_column(JSONB, nullable=True)

    # Quan hệ
    user: Mapped["User"] = relationship(back_populates="candidate_profile")
    resumes: Mapped[list["Resume"]] = relationship(back_populates="candidate")
    applications: Mapped[list["Application"]] = relationship(back_populates="candidate")

class HRProfile(Base):
    __tablename__ = "hr_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)

    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone_number: Mapped[str] = mapped_column(String(50), nullable=True)
    department: Mapped[str] = mapped_column(String(255), nullable=True)
    position: Mapped[str] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Quan hệ
    user: Mapped["User"] = relationship(back_populates="hr_profile")


class AdminProfile(Base):
    __tablename__ = "admin_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str] = mapped_column(String(255), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Quan hệ
    user: Mapped["User"] = relationship(back_populates="admin_profile")


# Dữ liệu tuyển dụng

class JobDescription(Base):
    __tablename__ = "job_descriptions"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hr_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description_text: Mapped[str] = mapped_column(Text, nullable=False)
    visibility: Mapped[str] = mapped_column(String(20), default="public")

    location: Mapped[str] = mapped_column(String(255), nullable=True)
    salary_range: Mapped[str] = mapped_column(String(100), nullable=True)
    deadline: Mapped[datetime] = mapped_column(Date, nullable=True)
    requirements_text: Mapped[str] = mapped_column(Text, nullable=True)
    benefits_text: Mapped[str] = mapped_column(Text, nullable=True)
    
    # Chuẩn ITSS
    itss_category: Mapped[str] = mapped_column(String(100), nullable=True)
    itss_level: Mapped[int] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Quan hệ
    hr: Mapped["User"] = relationship(back_populates="jobs")
    company: Mapped["Company"] = relationship(back_populates="jobs")
    applications: Mapped[list["Application"]] = relationship(back_populates="job")
    skills: Mapped[list["JDSkill"]] = relationship(back_populates="job")


# Hồ sơ ứng viên & Đơn ứng tuyển

class Resume(Base):
    __tablename__ = "resumes"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("candidates.user_id", ondelete="CASCADE"), nullable=False)
    cv_url: Mapped[str] = mapped_column(String(255), nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True)
    
    extracted_text: Mapped[str] = mapped_column(Text, nullable=True)
    itss_category_predicted: Mapped[str] = mapped_column(String(100), nullable=True)
    itss_level_predicted: Mapped[int] = mapped_column(Integer, nullable=True)
    
    status: Mapped[str] = mapped_column(String(50), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Quan hệ
    candidate: Mapped["Candidate"] = relationship(back_populates="resumes")
    applications: Mapped[list["Application"]] = relationship(back_populates="resume", passive_deletes=True)
    skills: Mapped[list["ResumeSkill"]] = relationship(back_populates="resume", passive_deletes=True)

class Application(Base):
    __tablename__ = "applications"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("candidates.user_id", ondelete="CASCADE"), nullable=False)
    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False)
    resume_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False)
    
    # Phân biệt luồng: Ứng viên tự apply hay HR chủ động invite
    application_type: Mapped[str] = mapped_column(String(20), nullable=False)
    cover_letter: Mapped[str] = mapped_column(Text, nullable=True)
    
    # Điểm do thuật toán AI (Cosine Similarity) tính toán
    match_score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=True)
    embedding_match_score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=True)
    llm_match_score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=True)
    final_match_score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=True)
    scoring_method: Mapped[str] = mapped_column(String(100), nullable=True)
    
    reviewed_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    ai_status: Mapped[str] = mapped_column(String(50), default="queued")
    ai_error: Mapped[str] = mapped_column(Text, nullable=True)
    ai_processed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    report_source: Mapped[str] = mapped_column(String(50), default="none")
    extracted_data: Mapped[dict] = mapped_column(JSONB, nullable=True)
    evaluation_result: Mapped[dict] = mapped_column(JSONB, nullable=True)
    applied_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Quan hệ
    candidate: Mapped["Candidate"] = relationship(back_populates="applications")
    job: Mapped["JobDescription"] = relationship(back_populates="applications")
    resume: Mapped["Resume"] = relationship(back_populates="applications")
    interviews: Mapped[list["Interview"]] = relationship(back_populates="application")


# Từ điển kỹ năng ITSS và Matching

class ItssSkill(Base):
    __tablename__ = "itss_skills"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    skill_name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False) # Ví dụ: 'Programming', 'Soft Skill'
    description: Mapped[str] = mapped_column(Text, nullable=True)

    # Quan hệ
    jd_skills: Mapped[list["JDSkill"]] = relationship(back_populates="skill")
    resume_skills: Mapped[list["ResumeSkill"]] = relationship(back_populates="skill")

class JDSkill(Base):
    __tablename__ = "jd_skills"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False)
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("itss_skills.id", ondelete="CASCADE"), nullable=False)
    importance_level: Mapped[int] = mapped_column(Integer, nullable=False)

    # Quan hệ
    job: Mapped["JobDescription"] = relationship(back_populates="skills")
    skill: Mapped["ItssSkill"] = relationship(back_populates="jd_skills")

class ResumeSkill(Base):
    __tablename__ = "resume_skills"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resume_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False)
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("itss_skills.id", ondelete="CASCADE"), nullable=False)
    
    # AI phân tích CV và đánh giá ứng viên đang ở mức độ mấy (1-5)
    level: Mapped[int] = mapped_column(Integer, nullable=False)

    # Quan hệ
    resume: Mapped["Resume"] = relationship(back_populates="skills")
    skill: Mapped["ItssSkill"] = relationship(back_populates="resume_skills")


# Phỏng vấn và Thông báo

class Interview(Base):
    __tablename__ = "interviews"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), nullable=False)
    hr_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    scheduled_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    meeting_link: Mapped[str] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="scheduled") # scheduled, completed, canceled
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Quan hệ
    application: Mapped["Application"] = relationship(back_populates="interviews")


class Notification(Base):
    __tablename__ = "notifications"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Quan hệ
    user: Mapped["User"] = relationship(back_populates="notifications")
