"""
Database setup for Supabase/Postgres
"""
from sqlalchemy import create_engine, Column, String, Integer, DateTime, JSON, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from datetime import datetime
import os
from pydantic_settings import BaseSettings

class DatabaseSettings(BaseSettings):
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./memory/scanx.db")
    
    class Config:
        env_file = ".env"
        extra = "ignore"  # Ignore extra fields in .env

db_settings = DatabaseSettings()

# Create engine with connection pooling for scalability
if db_settings.database_url.startswith("postgresql"):
    # Postgres/Supabase with connection pooling
    engine = create_engine(
        db_settings.database_url,
        pool_pre_ping=True,  # Verify connections before using
        pool_size=10,  # Number of connections to maintain
        max_overflow=20,  # Additional connections beyond pool_size
        pool_recycle=3600,  # Recycle connections after 1 hour
        pool_timeout=30,  # Timeout for getting connection from pool
        echo=os.getenv("SQL_ECHO", "false").lower() == "true"  # Enable query logging via SQL_ECHO env var
    )
else:
    # SQLite fallback (not recommended for production)
    _sqlite_kw = {"connect_args": {"check_same_thread": False}, "pool_pre_ping": True}
    if ":memory:" in db_settings.database_url:
        # Single shared connection so create_all and API requests see the same DB
        _sqlite_kw["poolclass"] = StaticPool
    engine = create_engine(db_settings.database_url, **_sqlite_kw)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Database Models
class ScanRequest(Base):
    __tablename__ = "scan_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True, nullable=True)
    image_hash = Column(String, index=True)
    intent = Column(Text)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    user_id = Column(String, index=True, nullable=True)
    action = Column(String, index=True)  # view, upload, download, delete, modify, extract, process
    resource_type = Column(String, index=True)  # prescription, image, medical_record
    resource_id = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    additional_info = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class UISchema(Base):
    __tablename__ = "ui_schemas"
    
    id = Column(Integer, primary_key=True, index=True)
    scan_request_id = Column(Integer, index=True, nullable=True)
    session_id = Column(String, index=True, nullable=True)
    page_type = Column(String)
    url_hint = Column(String, nullable=True)
    elements = Column(JSON)  # Store UI elements as JSON
    created_at = Column(DateTime, default=datetime.utcnow)

class ActionPlan(Base):
    __tablename__ = "action_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    scan_request_id = Column(Integer, index=True, nullable=True)
    session_id = Column(String, index=True, nullable=True)
    task = Column(String)
    steps = Column(JSON)  # Store action steps as JSON
    estimated_time = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class ExecutionResult(Base):
    __tablename__ = "execution_results"
    
    id = Column(Integer, primary_key=True, index=True)
    action_plan_id = Column(Integer, index=True, nullable=True)
    session_id = Column(String, index=True, nullable=True)
    status = Column(String)
    message = Column(Text)
    final_url = Column(String, nullable=True)
    screenshot_path = Column(String, nullable=True)
    error = Column(Text, nullable=True)
    logs = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AllergyProfile(Base):
    """
    Client-scoped allergy list for patient-safety workflows.
    Tied to X-Client-Session-Id until full account auth is used.
    """
    __tablename__ = "allergy_profiles"

    id = Column(Integer, primary_key=True, index=True)
    client_session_id = Column(String(64), unique=True, index=True, nullable=False)
    allergens = Column(JSON, nullable=False)  # list[str]
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Create tables
def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

