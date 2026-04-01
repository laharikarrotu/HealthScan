"""Patient-safety allergy profile API."""
import os
import uuid

# Use local SQLite so tests do not require Supabase/network (import order matters).
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import pytest
from fastapi.testclient import TestClient

from memory.database import init_db

from api.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _init_tables():
    init_db()

HDR = "X-Client-Session-Id"


@pytest.fixture
def session_id():
    return str(uuid.uuid4())


def test_allergy_profile_requires_session_header():
    r = client.get("/patient-safety/allergy-profile")
    assert r.status_code == 400


def test_allergy_profile_roundtrip(session_id):
    r = client.get("/patient-safety/allergy-profile", headers={HDR: session_id})
    assert r.status_code == 200
    assert r.json()["allergens"] == []

    r2 = client.put(
        "/patient-safety/allergy-profile",
        headers={HDR: session_id},
        json={"allergens": ["Penicillin", "  latex  ", "Penicillin"]},
    )
    assert r2.status_code == 200
    data = r2.json()
    assert data["allergens"] == ["Penicillin", "latex"]

    r3 = client.get("/patient-safety/allergy-profile", headers={HDR: session_id})
    assert r3.json()["allergens"] == ["Penicillin", "latex"]


def test_session_hint():
    r = client.get("/patient-safety/session-hint")
    assert r.status_code == 200
    assert "client_session_id" in r.json()
