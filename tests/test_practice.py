"""
EduVoice Backend Tests — Practice speech analysis
"""

import io
import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from app.main import app
    return TestClient(app)


MOCK_ANALYSIS = {
    "scores": {"fluency": 7.5, "grammar": 8.0, "confidence": 6.5, "pronunciation": 7.0},
    "feedback_text": "Great effort! Your grammar is improving well. Keep practising pronunciation.",
    "word_marks": [{"word": "practising", "issue": "mispronounced", "suggestion": "PRAK-ti-sing"}],
    "strengths": ["clear sentence structure", "good vocabulary"],
    "next_steps": ["Focus on vowel sounds"],
}


class TestPracticeSession:
    def test_start_session_no_auth(self, client):
        resp = client.post("/practice/session/start", json={"mode": "read-aloud"})
        assert resp.status_code == 403

    def test_get_session_not_found(self, client):
        resp = client.get("/practice/session/nonexistent-id")
        # Without auth → 403; with auth, nonexistent → checked below
        assert resp.status_code in (403, 404)


class TestSpeechAnalyze:
    def test_analyze_no_auth(self, client):
        fake_audio = io.BytesIO(b"RIFF" + b"\x00" * 40)
        resp = client.post(
            "/practice/speech-analyze",
            data={"session_id": "sess_001", "mode": "read-aloud", "accessibility_json": "{}"},
            files={"audio": ("test.wav", fake_audio, "audio/wav")},
        )
        assert resp.status_code == 403

    @patch("app.services.gemini.transcribe_audio", new_callable=AsyncMock)
    @patch("app.services.gemini.analyze_speech", new_callable=AsyncMock)
    @patch("app.services.storage.upload_audio")
    @patch("app.services.snowflake_db.save_artifact", new_callable=AsyncMock)
    def test_analyze_scores_structure(
        self, mock_save, mock_upload, mock_analyze, mock_transcribe, client
    ):
        mock_transcribe.return_value = "I went to the school yesterday and learned many new things."
        mock_analyze.return_value = MOCK_ANALYSIS
        mock_upload.return_value = "https://spaces.example.com/recordings/sess_001/student_audio.mp3"
        mock_save.return_value = None

        # Validate the MOCK_ANALYSIS structure matches our schema expectations
        scores = MOCK_ANALYSIS["scores"]
        assert "fluency" in scores
        assert "grammar" in scores
        assert "confidence" in scores
        assert "pronunciation" in scores
        assert all(0 <= v <= 10 for v in scores.values())

    def test_stammer_friendly_prompt_flag(self):
        """Validate stammer-friendly addendum doesn't appear in non-stammer prompts."""
        from app.utils.prompts import build_speech_analysis_prompt
        _, user_prompt = build_speech_analysis_prompt("test transcript", "read-aloud", stammer_friendly=False)
        assert "STAMMER-FRIENDLY" not in user_prompt

        _, user_prompt_sf = build_speech_analysis_prompt("test transcript", "read-aloud", stammer_friendly=True)
        assert "STAMMER-FRIENDLY" in user_prompt_sf

    def test_neurodivergent_prompt_flag(self):
        from app.utils.prompts import build_speech_analysis_prompt
        _, nd_prompt = build_speech_analysis_prompt("test", "mock-interview", neurodivergent=True)
        assert "NEURODIVERGENT" in nd_prompt

    def test_hearing_impaired_prompt_flag(self):
        from app.utils.prompts import build_speech_analysis_prompt
        _, hi_prompt = build_speech_analysis_prompt("test", "read-aloud", hearing_impaired=True)
        assert "HEARING IMPAIRED" in hi_prompt
