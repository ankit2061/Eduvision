"""
Practice router — voice sessions, speech analysis, AAC support.
"""

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from loguru import logger

from app.dependencies import get_current_user, require_role
from app.models.schemas import (
    CurrentUser,
    SessionStartRequest,
    SessionStartResponse,
    SpeechAnalyzeResponse,
    SpeechScores,
    WordMark,
    SessionEndRequest,
    AccessibilityProfile,
)
from app.services import gemini, elevenlabs, snowflake_db, storage
from app.utils.audio import detect_mime_type

router = APIRouter(prefix="/practice", tags=["Practice"])


@router.post("/session/start", response_model=SessionStartResponse)
async def start_session(
    req: SessionStartRequest,
    user: CurrentUser = Depends(require_role("student", "admin")),
):
    """Create a new practice session and persist to Snowflake."""
    session_id = str(uuid.uuid4())
    acc_json = req.accessibility_json.model_dump() if req.accessibility_json else {}

    await snowflake_db.create_session(
        session_id=session_id,
        student_id=user.user_id,
        lesson_id=req.lesson_id,
        mode=req.mode,
        accessibility_json=acc_json,
    )

    # Log accessibility mode activation events
    for key, val in acc_json.items():
        if val and key not in ("font_scale",):
            await snowflake_db.log_event(user.user_id, f"{key}_on", {"session_id": session_id})

    return SessionStartResponse(
        session_id=session_id,
        started_at=datetime.now(timezone.utc).isoformat(),
    )


@router.post("/speech-analyze", response_model=SpeechAnalyzeResponse)
async def analyze_speech(
    session_id: str = Form(...),
    mode: str = Form("read-aloud"),
    accessibility_json: str = Form("{}"),
    generate_spoken_feedback: bool = Form(False),
    audio: UploadFile = File(...),
    user: CurrentUser = Depends(require_role("student", "admin")),
):
    """
    Full speech analysis pipeline:
    1. Upload audio → storage
    2. Transcribe via Gemini multimodal
    3. Analyze with accessibility-aware scoring
    4. Optionally generate ElevenLabs spoken feedback
    5. Save artifact to Snowflake
    """
    import json as _json

    # Parse accessibility profile
    try:
        acc_data = _json.loads(accessibility_json)
        acc = AccessibilityProfile(**acc_data)
    except Exception:
        acc = AccessibilityProfile()

    # Read uploaded audio
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    mime_type = detect_mime_type(audio.filename or "audio.wav", audio_bytes)

    # Upload student recording to DO Spaces
    try:
        audio_url = storage.upload_audio(
            audio_bytes,
            prefix=f"recordings/{session_id}",
            content_type=mime_type,
            filename="student_audio",
        )
    except Exception as e:
        logger.warning(f"[Practice] Audio upload failed: {e}")
        audio_url = ""

    # Transcribe audio via ElevenLabs
    try:
        transcript = await elevenlabs.stt(audio_bytes, mime_type)
    except Exception as e:
        logger.error(f"[Practice] Transcription failed: {e}")
        raise HTTPException(status_code=502, detail=f"Transcription failed: {e}")

    # Analyze speech with accessibility-aware prompt
    try:
        analysis = await gemini.analyze_speech(
            transcript=transcript,
            mode=mode,
            stammer_friendly=acc.stammer_friendly,
            hearing_impaired=acc.captions_always_on,
            neurodivergent=acc.sensory_friendly,
        )
    except Exception as e:
        logger.error(f"[Practice] Analysis failed: {e}")
        raise HTTPException(status_code=502, detail=f"Speech analysis failed: {e}")

    raw_scores = analysis.get("scores", {})
    scores = SpeechScores(
        fluency=float(raw_scores.get("fluency", 5.0)),
        grammar=float(raw_scores.get("grammar", 5.0)),
        confidence=float(raw_scores.get("confidence", 5.0)),
        pronunciation=float(raw_scores.get("pronunciation", 5.0)),
    )

    word_marks = [
        WordMark(word=w.get("word", ""), issue=w.get("issue"), suggestion=w.get("suggestion"))
        for w in analysis.get("word_marks", [])
    ]

    feedback_text = analysis.get("feedback_text", "Great effort! Keep practising.")

    # Optionally generate spoken feedback audio
    spoken_feedback_url: str | None = None
    if generate_spoken_feedback and not acc.captions_always_on:
        try:
            feedback_bytes = await elevenlabs.spoken_feedback(
                feedback_text, neurodivergent=acc.sensory_friendly
            )
            spoken_feedback_url = storage.upload_audio(
                feedback_bytes,
                prefix=f"feedback/{session_id}",
                filename="spoken_feedback",
            )
        except Exception as e:
            logger.warning(f"[Practice] Spoken feedback generation failed: {e}")

    # Save to Snowflake
    await snowflake_db.save_artifact(
        session_id=session_id,
        audio_url=audio_url,
        transcript_text=transcript,
        feedback_json={"feedback_text": feedback_text, "word_marks": [w.model_dump() for w in word_marks]},
        scores_json=scores.model_dump(),
    )

    return SpeechAnalyzeResponse(
        session_id=session_id,
        transcript=transcript,
        scores=scores,
        feedback_text=feedback_text,
        word_marks=word_marks,
        spoken_feedback_url=spoken_feedback_url,
    )


@router.get("/session/{session_id}")
async def get_session(
    session_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Fetch session state from Snowflake."""
    session = await snowflake_db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/session/{session_id}/end")
async def end_session(
    session_id: str,
    user: CurrentUser = Depends(require_role("student", "admin")),
):
    """Mark session as complete."""
    await snowflake_db.end_session(session_id)
    return {"status": "ended", "session_id": session_id}
