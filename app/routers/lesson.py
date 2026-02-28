"""
Lesson router — content generation, assignment, and retrieval.
"""

import uuid
import asyncio
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from loguru import logger

from app.dependencies import get_current_user, require_role
from app.models.schemas import (
    CurrentUser,
    LessonGenerateRequest,
    LessonGenerateResponse,
    LessonTier,
    LessonAssignRequest,
    LessonSummary,
    LessonUpdateRequest,
)
from app.services import gemini, elevenlabs, snowflake_db, storage, huggingface
from app.utils.audio import detect_mime_type

router = APIRouter(prefix="/lesson", tags=["Lesson"])


@router.post("/transcribe")
async def transcribe_audio_endpoint(
    audio: UploadFile = File(...),
    user: CurrentUser = Depends(require_role("teacher", "admin")),
):
    """
    Accepts an audio file upload (e.g. from MediaRecorder),
    transcribes it using Gemini, and returns the transcript text.
    """
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    mime_type = detect_mime_type(audio.filename or "audio.webm", audio_bytes)

    try:
        transcript = await huggingface.transcribe_audio(audio_bytes)
        return {"transcript": transcript}
    except Exception as e:
        logger.error(f"[Lesson] Transcription failed: {e}")
        raise HTTPException(status_code=502, detail=f"Transcription failed: {e}")


@router.post("/generate", response_model=LessonGenerateResponse)
async def generate_lesson(
    req: LessonGenerateRequest,
    user: CurrentUser = Depends(require_role("teacher", "admin")),
):
    """
    Generate a differentiated lesson (tiered passages + questions + audio).
    Persists to Snowflake and uploads audio to DO Spaces.
    """
    lesson_id = str(uuid.uuid4())

    # 1. Generate tiered content via Gemini
    try:
        gemini_response = await gemini.generate_lesson(
            topic=req.topic,
            grade=req.grade,
            tiers=req.tiers,
            language=req.language,
            base_text=req.base_text,
        )
    except Exception as e:
        logger.error(f"[Lesson] Gemini error: {e}")
        raise HTTPException(status_code=502, detail=f"Content generation failed: {e}")

    raw_tiers = gemini_response.get("tiers", [])
    if not raw_tiers:
        raise HTTPException(status_code=502, detail="Gemini returned empty tiers")

    # 2. Generate TTS audio per tier (concurrent)
    tiers_out: list[LessonTier] = []

    async def process_tier(tier_data: dict) -> LessonTier:
        level = tier_data.get("level", 1)
        passage = tier_data.get("passage", "")
        audio_url: Optional[str] = None

        if req.generate_audio and passage:
            try:
                audio_bytes = await elevenlabs.tts(passage)
                audio_url = storage.upload_audio(
                    audio_bytes,
                    prefix=f"lessons/{lesson_id}",
                    filename=f"tier_{level}",
                )
                await snowflake_db.insert_lesson_asset(lesson_id, level, audio_url)
            except Exception as e:
                logger.warning(f"[Lesson] Audio gen failed for tier {level}: {e}")

        return LessonTier(
            level=level,
            label=tier_data.get("label", f"Tier {level}"),
            passage=passage,
            questions=tier_data.get("questions", []),
            audio_url=audio_url,
        )

    tiers_out = await asyncio.gather(*[process_tier(t) for t in raw_tiers])

    # 3. Persist lesson to Snowflake
    content_json = {"tiers": [t.model_dump() for t in tiers_out]}
    created_at = datetime.now(timezone.utc).isoformat()

    await snowflake_db.insert_lesson(
        lesson_id=lesson_id,
        teacher_id=user.user_id,
        topic=req.topic,
        grade=req.grade,
        tiers=req.tiers,
        content_json=content_json,
    )

    return LessonGenerateResponse(
        lesson_id=lesson_id,
        topic=req.topic,
        grade=req.grade,
        tiers=list(tiers_out),
        created_at=created_at,
    )


@router.get("/library", response_model=list[LessonSummary])
async def list_library(user: CurrentUser = Depends(require_role("teacher", "admin"))):
    """Return all lessons created by this teacher."""
    lessons = await snowflake_db.list_lessons_by_teacher(user.user_id)
    return [LessonSummary(**l) for l in lessons]


@router.get("/{lesson_id}")
async def get_lesson(
    lesson_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Fetch full lesson JSON (any authenticated user)."""
    lesson = await snowflake_db.get_lesson(lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson


@router.get("/{lesson_id}/audio/{level}")
async def get_lesson_audio(
    lesson_id: str,
    level: int,
    user: CurrentUser = Depends(get_current_user),
):
    """Return the audio URL for a lesson tier."""
    audio_url = await snowflake_db.get_lesson_audio(lesson_id, level)
    if not audio_url:
        raise HTTPException(status_code=404, detail="Audio not found for this tier")
    return {"lesson_id": lesson_id, "level": level, "audio_url": audio_url}


@router.post("/{lesson_id}/assign")
async def assign_lesson(
    lesson_id: str,
    req: LessonAssignRequest,
    user: CurrentUser = Depends(require_role("teacher", "admin")),
):
    """
    Assign a lesson to a class. Records assignment metadata.
    (Extend with an `assignments` table for full production use.)
    """
    lesson = await snowflake_db.get_lesson(lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Log event for analytics
    await snowflake_db.log_event(
        user_id=user.user_id,
        event_type="lesson_assigned",
        payload={
            "lesson_id": lesson_id,
            "class_id": req.class_id,
            "due_date": req.due_date,
            "mode": req.mode,
        },
    )

    return {
        "status": "assigned",
        "lesson_id": lesson_id,
        "class_id": req.class_id,
        "due_date": req.due_date,
        "mode": req.mode,
    }


@router.put("/{lesson_id}")
async def update_lesson_endpoint(
    lesson_id: str,
    req: LessonUpdateRequest,
    user: CurrentUser = Depends(require_role("teacher", "admin")),
):
    """Update lesson JSON content (e.g., human edits to tiers)."""
    lesson = await snowflake_db.get_lesson(lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    await snowflake_db.update_lesson(lesson_id, req.content_json)
    return {"status": "updated", "lesson_id": lesson_id}
