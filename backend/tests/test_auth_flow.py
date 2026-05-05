from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_register_login_refresh_flow() -> None:
    email = "ci_auth_user@example.com"
    password = "password123"

    register_response = client.post("/auth/register", json={"email": email, "password": password})
    assert register_response.status_code in (200, 409)

    login_response = client.post("/auth/login", json={"email": email, "password": password})
    assert login_response.status_code == 200
    tokens = login_response.json()
    assert "token" in tokens
    assert "refresh_token" in tokens

    refresh_response = client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert refresh_response.status_code == 200
    assert "token" in refresh_response.json()

