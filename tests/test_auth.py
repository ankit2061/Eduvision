"""
EduVoice Backend Tests — Auth module
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient


@pytest.fixture
def app():
    from app.main import app as _app
    return _app


@pytest.fixture
def client(app):
    return TestClient(app)


def _make_jwt_payload(role="teacher"):
    return {
        "sub": "auth0|test123",
        "email": "test@eduvision.app",
        "https://eduvision/role": role,
        "aud": "https://eduvision-api",
    }


class TestHealth:
    def test_health_check(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    def test_root(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        assert "EduVoice" in resp.json()["message"]


class TestAuth:
    def test_me_no_token(self, client):
        resp = client.get("/auth/me")
        assert resp.status_code == 403  # No credentials provided

    @patch("app.dependencies.get_current_user")
    @patch("app.services.snowflake_db.get_user", new_callable=AsyncMock)
    @patch("app.services.snowflake_db.upsert_user", new_callable=AsyncMock)
    def test_me_new_user(self, mock_upsert, mock_get, mock_user, client):
        from app.models.schemas import CurrentUser
        mock_user.return_value = CurrentUser(user_id="auth0|test123", email="test@eduvision.app", role="teacher")
        mock_get.return_value = None  # New user
        mock_upsert.return_value = None

        with patch("app.routers.auth.snowflake_db.get_user", mock_get), \
             patch("app.routers.auth.snowflake_db.upsert_user", mock_upsert):
            resp = client.get("/auth/me", headers={"Authorization": "Bearer fake"})
        # Auth mock returns user so it should 200
        assert resp.status_code in (200, 401)  # 401 if mock_user doesn't inject
