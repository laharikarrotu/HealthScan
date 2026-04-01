"""
Patient-safety: structured allergy record + audit trail.
Extensible for step-up / multimodal verification (X-Step-Up-Verified).
"""
import re
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from api.dependencies import audit_logger, rate_limiter
from core.audit_logger import AuditAction
from core.logger import get_logger
from memory.database import get_db, AllergyProfile

logger = get_logger("api.routers.allergy_profile")

router = APIRouter(prefix="/patient-safety", tags=["patient-safety"])

SESSION_HEADER = "X-Client-Session-Id"
STEP_UP_HEADER = "X-Step-Up-Verified"

_SESSION_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{8,64}$")


def _parse_session_id(raw: Optional[str]) -> str:
    if not raw or not raw.strip():
        raise HTTPException(
            status_code=400,
            detail=f"Missing or empty {SESSION_HEADER}. Generate a UUID in the client and send it on each request.",
        )
    sid = raw.strip()
    if not _SESSION_ID_RE.match(sid):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {SESSION_HEADER}: use 8–64 URL-safe characters (e.g. UUID).",
        )
    return sid


class AllergyProfilePayload(BaseModel):
    allergens: List[str] = Field(default_factory=list, max_length=40)

    @field_validator("allergens")
    @classmethod
    def normalize_allergens(cls, v: List[str]) -> List[str]:
        out: List[str] = []
        seen = set()
        for item in v:
            s = (item or "").strip()
            if not s:
                continue
            if len(s) > 120:
                raise HTTPException(status_code=400, detail="Each allergen must be 120 characters or fewer.")
            key = s.lower()
            if key in seen:
                continue
            seen.add(key)
            out.append(s)
        return out


@router.get("/allergy-profile")
async def get_allergy_profile(
    request: Request,
    db: Session = Depends(get_db),
    x_client_session_id: Optional[str] = Header(None, alias=SESSION_HEADER),
    x_step_up_verified: Optional[str] = Header(None, alias=STEP_UP_HEADER),
):
    """
    Retrieve the stored allergy list for this client session.
    Future: require X-Step-Up-Verified: true after WebAuthn / biometric step-up.
    """
    client_ip = request.client.host if request.client else "unknown"
    allowed, remaining = rate_limiter.is_allowed(f"allergy_profile_get:{client_ip}")
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Rate limit exceeded. Try again in {remaining}s.")

    session_id = _parse_session_id(x_client_session_id)

    row = db.query(AllergyProfile).filter(AllergyProfile.client_session_id == session_id).first()
    audit_logger.log_phi_access(
        user_id=session_id,
        action=AuditAction.VIEW,
        resource_type="allergy_record",
        resource_id=session_id[:16],
        ip_address=client_ip,
        additional_info={
            "event": "allergy_profile_read",
            "step_up_header_present": bool(x_step_up_verified),
        },
    )

    if not row:
        return {"allergens": [], "updated_at": None}

    return {"allergens": row.allergens or [], "updated_at": row.updated_at.isoformat() if row.updated_at else None}


@router.put("/allergy-profile")
async def put_allergy_profile(
    request: Request,
    body: AllergyProfilePayload,
    db: Session = Depends(get_db),
    x_client_session_id: Optional[str] = Header(None, alias=SESSION_HEADER),
    x_step_up_verified: Optional[str] = Header(None, alias=STEP_UP_HEADER),
):
    """
    Create or replace the allergy list for this client session (allergy-aware access binding).
    """
    client_ip = request.client.host if request.client else "unknown"
    allowed, remaining = rate_limiter.is_allowed(f"allergy_profile_put:{client_ip}")
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Rate limit exceeded. Try again in {remaining}s.")

    session_id = _parse_session_id(x_client_session_id)

    row = db.query(AllergyProfile).filter(AllergyProfile.client_session_id == session_id).first()
    now = datetime.utcnow()
    if row:
        row.allergens = body.allergens
        row.updated_at = now
    else:
        row = AllergyProfile(client_session_id=session_id, allergens=body.allergens, updated_at=now)
        db.add(row)

    try:
        db.commit()
        db.refresh(row)
    except Exception as e:
        db.rollback()
        logger.error(f"allergy_profile upsert failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Could not save allergy profile.")

    audit_logger.log_phi_access(
        user_id=session_id,
        action=AuditAction.MODIFY,
        resource_type="allergy_record",
        resource_id=session_id[:16],
        ip_address=client_ip,
        additional_info={
            "event": "allergy_profile_write",
            "allergen_count": len(body.allergens),
            "step_up_header_present": bool(x_step_up_verified),
        },
    )

    return {
        "status": "ok",
        "allergens": row.allergens or [],
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.get("/session-hint")
async def new_session_hint():
    """Optional: client may call this once to obtain a fresh session id (or use crypto.randomUUID)."""
    return {"client_session_id": str(uuid.uuid4())}
