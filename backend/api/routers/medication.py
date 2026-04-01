"""
Drug interaction checking endpoints
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import JSONResponse
from typing import Optional, List
import asyncio
import hashlib

from api.config import settings
from api.dependencies import (
    prescription_extractor, interaction_checker, audit_logger,
    CACHE_AVAILABLE, cache_manager,
    rate_limiter
)
from core.error_handler import ErrorHandler
from medication.interaction_checker import Medication
from medication.prescription_extractor import PrescriptionInfo
from core.logger import get_logger
from core.audit_logger import AuditAction

logger = get_logger("api.routers.medication")
router = APIRouter(prefix="/check-prescription-interactions", tags=["medication"])

@router.post("")
async def check_prescription_interactions(
    request: Request,
    files: List[UploadFile] = File(...),
    allergies: Optional[str] = Form(None)
):
    """
    UNIQUE FEATURE: Multi-prescription drug interaction checker.
    
    Scans multiple prescription images and checks for:
    - Drug-drug interactions
    - Allergy conflicts
    - Dosage concerns
    
    This is HealthScan's unique differentiator!
    
    **Parameters:**
    - `files`: List of prescription image files
    - `allergies`: Comma-separated list of known allergies (optional)
    
    **Returns:**
    - `prescriptions`: Extracted prescription details
    - `interactions`: Categorized by severity (major, moderate, minor)
    - `has_interactions`: Boolean indicating if any interactions found
    """
    # Rate limiting
    client_ip = request.client.host if request.client else "unknown"
    allowed, remaining = rate_limiter.is_allowed(client_ip)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Please try again in a moment. ({remaining} requests remaining)"
        )
    
    # Security: Limit number of files to prevent DoS
    if len(files) > settings.max_file_count:
        raise HTTPException(
            status_code=400,
            detail=f"Too many files. Maximum {settings.max_file_count} files allowed."
        )
    
    try:
        medications = []
        prescription_details = []
        medication_names = []
        
        # Process files in parallel for better performance
        async def process_file(file: UploadFile):
            # Security: Validate file size
            file_size_mb = file.size / (1024 * 1024) if file.size else 0
            if file_size_mb > settings.max_file_size_mb:
                raise HTTPException(
                    status_code=413,
                    detail=f"File '{file.filename}' too large: {file_size_mb:.2f}MB. Maximum allowed: {settings.max_file_size_mb}MB"
                )
            
            # Security: Validate file type
            allowed_content_types = [
                "image/jpeg", "image/jpg", "image/png", "image/webp",
                "application/pdf", "image/heic", "image/heif"
            ]
            if file.content_type and file.content_type not in allowed_content_types:
                raise HTTPException(
                    status_code=415,
                    detail=f"Unsupported file type for '{file.filename}': {file.content_type}. Allowed types: {', '.join(allowed_content_types)}"
                )
            
            image_data = await file.read()
            
            # Security: Validate actual file size after reading
            actual_size_mb = len(image_data) / (1024 * 1024)
            if actual_size_mb > settings.max_file_size_mb:
                raise HTTPException(
                    status_code=413,
                    detail=f"File '{file.filename}' too large after processing: {actual_size_mb:.2f}MB. Maximum allowed: {settings.max_file_size_mb}MB"
                )
            image_hash = hashlib.sha256(image_data).hexdigest()
            
            cached_prescription = None
            if CACHE_AVAILABLE and cache_manager:
                cached_prescription = cache_manager.get_prescription(image_hash)
            
            if cached_prescription:
                prescription = PrescriptionInfo(**cached_prescription)
                logger.info(f"Using cached prescription for {image_hash[:8]}...", context={"cache": "hit", "image_hash": image_hash[:8]})
            else:
                # Security: Redact PII from image before sending to LLM
                try:
                    from vision.ocr_preprocessor import OCRPreprocessor
                    ocr_preprocessor = OCRPreprocessor(enable_pii_redaction=True)
                    ocr_result = ocr_preprocessor.extract_text(image_data, preprocess=True)
                    
                    if ocr_result.get('pii_detected', False):
                        logger.warning(f"PII detected: {ocr_result.get('pii_count', 0)} instances. Redacting before LLM.")
                        redacted_image, redaction_count = pii_redactor.redact_image(
                            image_data, ocr_text=ocr_result.get('original_text'), use_ocr=True
                        )
                        if redaction_count > 0:
                            image_data = redacted_image
                except Exception as e:
                    logger.warning(f"PII redaction failed: {e}. Proceeding (security risk).")
                
                prescription = prescription_extractor.extract_from_image(image_data)
                prescription_dict = prescription.model_dump()
                if CACHE_AVAILABLE and cache_manager:
                    cache_ttl = settings.cache_ttl_hours * 3600
                    cache_manager.set_prescription(image_hash, prescription_dict, ttl=cache_ttl)
            
            return prescription
        
        # Process all files in parallel
        prescriptions = await asyncio.gather(*[process_file(file) for file in files])
        
        for prescription in prescriptions:
            prescription_details.append(prescription.model_dump())
            medication_names.append(prescription.medication_name)
            
            medications.append(Medication(
                name=prescription.medication_name,
                dosage=prescription.dosage,
                frequency=prescription.frequency
            ))
        
        # Parse allergies if provided
        allergy_list = []
        if allergies:
            allergy_list = [a.strip() for a in allergies.split(",")]
        
        # Create hash for interaction check cache key
        medications_str = ",".join(sorted(medication_names))
        allergies_str = ",".join(sorted(allergy_list)) if allergy_list else ""
        medications_hash = hashlib.sha256(medications_str.encode()).hexdigest()
        allergies_hash = hashlib.sha256(allergies_str.encode()).hexdigest() if allergies_str else ""
        
        # Check cache for interaction results
        if CACHE_AVAILABLE and cache_manager:
            cached_interactions = cache_manager.get_interactions(medications_hash, allergies_hash)
            if cached_interactions:
                logger.info(f"Cache hit for interactions {medications_hash[:8]}...", context={"cache": "hit", "medications_hash": medications_hash[:8]})
                return JSONResponse(
                    status_code=200,
                    content={
                        "status": "success",
                        "cached": True,
                        "prescription_details": prescription_details,
                        "warnings": cached_interactions.get("warnings", {}),
                        "message": f"Found interactions (cached). {cached_interactions.get('message', '')}"
                    }
                )
        
        # HIPAA Compliance: Log interaction check
        client_ip = request.client.host if request.client else "unknown"
        audit_logger.log_data_access(
            user_id=None,
            resource_type="prescription_interactions",
            resource_id=",".join(medication_names),
            ip_address=client_ip
        )
        if allergy_list:
            audit_logger.log_phi_access(
                user_id=None,
                action=AuditAction.PROCESS,
                resource_type="allergy_aware_prescribing_check",
                resource_id=allergies_hash[:24],
                ip_address=client_ip,
                additional_info={
                    "medication_count": len(medications),
                    "allergy_token_count": len(allergy_list),
                },
            )
        
        # Check for interactions
        warnings = await interaction_checker.check_interactions(
            medications=medications,
            allergies=allergy_list if allergy_list else None
        )
        
        # Organize warnings by severity
        major_warnings = [w for w in warnings if w.severity == "major"]
        moderate_warnings = [w for w in warnings if w.severity == "moderate"]
        minor_warnings = [w for w in warnings if w.severity == "minor"]
        
        warnings_dict = {
            "major": [w.model_dump() for w in major_warnings],
            "moderate": [w.model_dump() for w in moderate_warnings],
            "minor": [w.model_dump() for w in minor_warnings],
        }
        
        # Cache interaction results
        if CACHE_AVAILABLE and cache_manager:
            cache_ttl = settings.cache_ttl_hours * 3600
            cache_manager.set_interactions(
                medications_hash,
                allergies_hash,
                {
                    "warnings": warnings_dict,
                    "message": f"Found {len(major_warnings)} major, {len(moderate_warnings)} moderate, and {len(minor_warnings)} minor interactions."
                },
                ttl=cache_ttl
            )
        
        # Organize interactions for response
        interactions_dict = {
            "total": len(warnings),
            "major": [w.model_dump() for w in major_warnings],
            "moderate": [w.model_dump() for w in moderate_warnings],
            "minor": [w.model_dump() for w in minor_warnings]
        }
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "prescriptions": prescription_details,
                "prescription_details": prescription_details,  # Alias for frontend compatibility
                "medications_found": len(medications),
                "interactions": interactions_dict,
                "warnings": interactions_dict,  # Alias for frontend compatibility
                "has_interactions": len(warnings) > 0,
                "message": f"Found {len(warnings)} potential interaction(s)" if warnings else "No interactions detected"
            }
        )
        
    except Exception as e:
        ErrorHandler.log_error(e, {"endpoint": "check-prescription-interactions"})
        user_friendly_msg = ErrorHandler.get_user_friendly_error(e)
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": user_friendly_msg
            }
        )


