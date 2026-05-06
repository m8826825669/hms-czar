"""Phase 0 smoke tests: seed → login → access protected → list patients."""
import pytest
from django.core.management import call_command
from rest_framework.test import APIClient


@pytest.fixture
def seeded(db):
    call_command(
        "seed_initial",
        admin_username="admin",
        admin_password="ChangeMe@123",
        admin_email="admin@hospital.local",
    )


@pytest.fixture
def client(seeded):
    return APIClient()


def test_health_check(client):
    res = client.get("/api/v1/core/health/")
    assert res.status_code in (200, 503)


def test_login_success(client):
    res = client.post("/api/v1/auth/login/",
                      {"username": "admin", "password": "ChangeMe@123"}, format="json")
    assert res.status_code == 200, res.content
    body = res.json()
    assert "access" in body and "refresh" in body
    assert body["user"]["username"] == "admin"
    assert "SUPER_ADMIN" in body["user"]["roles"]


def test_login_failure(client):
    res = client.post("/api/v1/auth/login/",
                      {"username": "admin", "password": "wrong"}, format="json")
    assert res.status_code == 401


def test_protected_endpoint_requires_auth(client):
    res = client.get("/api/v1/auth/me/")
    assert res.status_code == 401


def test_me_endpoint_after_login(client):
    res = client.post("/api/v1/auth/login/",
                      {"username": "admin", "password": "ChangeMe@123"}, format="json")
    token = res.json()["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    res = client.get("/api/v1/auth/me/")
    assert res.status_code == 200
    assert res.json()["username"] == "admin"


def test_create_patient_generates_mrn(client):
    res = client.post("/api/v1/auth/login/",
                      {"username": "admin", "password": "ChangeMe@123"}, format="json")
    token = res.json()["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    res = client.post("/api/v1/core/patients/", {
        "first_name": "Test", "last_name": "Patient",
        "dob": "1990-01-01", "gender": "M", "phone": "+919999999999",
    }, format="json")
    assert res.status_code == 201, res.content
    body = res.json()
    assert body["mrn"].startswith("MRN")
    assert body["full_name"] == "Test Patient"
