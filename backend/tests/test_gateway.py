import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_health_check():
    """Verify backend server root endpoint is online."""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"

def test_unauthorized_api_request():
    """Verify microservices reject requests without X-API-Key header."""
    response = client.get("/api/v1/weather")
    assert response.status_code == 401
    assert response.json()["detail"] == "X-API-Key header required"

def test_invalid_api_key():
    """Verify microservices reject fake/invalid API keys."""
    response = client.get("/api/v1/weather", headers={"X-API-Key": "apm_fakekey12345"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or Revoked API Key"

def test_full_user_and_key_lifecycle():
    """Test full cycle: User Registration -> Login -> Key Generation -> Endpoint Execution."""
    test_email = "pytest_dev@test.com"
    test_password = "password123"

    # 1. Register User
    reg_res = client.post("/auth/register", json={"email": test_email, "password": test_password})
    assert reg_res.status_code in [201, 400] # 201 created or 400 if already present

    # 2. Login & Get JWT Token
    login_res = client.post("/auth/login", data={"username": test_email, "password": test_password})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    assert token is not None

    # 3. Generate API Key using JWT Token
    key_res = client.post("/keys/generate", headers={"Authorization": f"Bearer {token}"})
    assert key_res.status_code == 201
    generated_key = key_res.json()["key"]
    assert generated_key.startswith("apm_")

    # 4. Hit Weather API Service using newly generated key
    weather_res = client.get("/api/v1/weather", headers={"X-API-Key": generated_key})
    assert weather_res.status_code == 200
    assert weather_res.json()["service"] == "Weather API"
    assert weather_res.json()["location"] == "Mumbai"