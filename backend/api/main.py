"""
HealthScan API - Main Application
Refactored to use routers for better organization
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import os

from api.config import settings
from api.auth import auth_router
from api.routers import prescription, medication, nutrition, vision, auth, monitoring, chat, allergy_profile
from core.middleware import RequestLoggingMiddleware, PerformanceMiddleware
from core.logger import get_logger

logger = get_logger("api.main")

# Parse allowed origins (comma-separated or single URL)
# Security: Only allow specific origins, never use wildcard in production
is_production = os.getenv("NODE_ENV") == "production" or os.getenv("ENVIRONMENT") == "production"

allowed_origins = []
if settings.frontend_url:
    # Parse comma-separated URLs
    allowed_origins.extend([url.strip() for url in settings.frontend_url.split(",")])

# Only allow localhost in development
if not is_production:
    allowed_origins.append("http://localhost:3000")
    allowed_origins.append("exp://localhost:8081")  # Expo dev server
else:
    # In production, log warning if localhost is in frontend_url
    if any("localhost" in origin.lower() for origin in allowed_origins):
        logger.warning("SECURITY WARNING: localhost is in allowed origins in production. This should be removed.")

# Remove duplicates and empty strings
allowed_origins = list(set([origin for origin in allowed_origins if origin]))

# Security: Fail if no origins configured in production
if is_production and not allowed_origins:
    raise ValueError(
        "CRITICAL: No allowed CORS origins configured for production. "
        "Set FRONTEND_URL in .env with your production frontend URL."
    )

app = FastAPI(
    title="HealthScan API",
    description="""
    AI healthcare assistant backend for medical document processing.
    
    ## Features
    
    * **Prescription Extraction**: Extract medication details from prescription images
    * **Drug Interaction Checking**: Check for drug-drug and drug-allergy interactions
    * **Patient safety**: Structured allergy profile (`/patient-safety/allergy-profile`) with audit logging; optional step-up headers for future biometric/WebAuthn binding
    * **Diet Recommendations**: Get personalized diet recommendations based on medical conditions
    * **Form Automation**: Automate medical form filling using AI vision and browser automation
    
    ## Authentication
    
    Most endpoints require JWT authentication. Get a token via `/login`.
    
    ## HIPAA Compliance
    
    ⚠️ **Important**: This is an MVP and is NOT HIPAA-compliant for production use with real patient data.
    See documentation for compliance roadmap.
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS - supports multiple origins (localhost + Vercel)
# Security: Only allow specific methods and headers, not wildcard
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "X-Client-Session-Id",
        "X-Step-Up-Verified",
    ],
)

# Add compression middleware for better performance
app.add_middleware(GZipMiddleware, minimum_size=1000)  # Compress responses > 1KB

# Add request logging and performance tracking middleware
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(PerformanceMiddleware)

# Security: HTTPS enforcement in production
if is_production:
    @app.middleware("http")
    async def enforce_https(request, call_next):
        """Redirect HTTP to HTTPS in production"""
        if request.url.scheme == "http":
            from fastapi.responses import RedirectResponse
            https_url = request.url.replace(scheme="https")
            return RedirectResponse(url=str(https_url), status_code=301)
        response = await call_next(request)
        # Add HSTS header
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        return response

# Include all routers
app.include_router(auth_router)  # OAuth routes (/auth/*)
app.include_router(auth.router)  # Legacy auth routes (/login, /protected)
app.include_router(prescription.router)  # Prescription extraction
app.include_router(medication.router)  # Drug interactions
app.include_router(nutrition.router)  # Diet recommendations
app.include_router(vision.router)  # Vision analysis and automation
app.include_router(chat.router)  # Conversational AI chat
app.include_router(allergy_profile.router)  # Allergy record + patient-safety audit hooks
app.include_router(monitoring.router)  # Metrics

# Basic health endpoints
@app.get("/")
async def root():
    return {"message": "SCANX API is running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

logger.info("HealthScan API initialized", context={"version": "1.0.0"})

