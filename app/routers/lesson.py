"""
Lesson router — content generation, assignment, and retrieval.
"""

import uuid
import json
import asyncio
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form
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
from app.services import gemini, elevenlabs, snowflake_db, storage, learning_pathway, disability_pathway
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
        transcript = await elevenlabs.stt(audio_bytes, mime_type)
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

    # 1. Generate tiered content via LangGraph (Learning Style Specific)
    try:
        # Use LangGraph workflow if learning_style is provided, fallback to standard Gemini
        if req.learning_style and req.learning_style != "none":
            logger.info(f"[Lesson] Using LangGraph for style: {req.learning_style}")
            gemini_response = await learning_pathway.generate_styled_lesson(
                topic=req.topic,
                grade=req.grade,
                tiers=req.tiers,
                language=req.language,
                learning_style=req.learning_style,
                base_text=req.base_text,
            )
        else:
            logger.info("[Lesson] Using standard Gemini generation")
            gemini_response = await gemini.generate_lesson(
                topic=req.topic,
                grade=req.grade,
                tiers=req.tiers,
                language=req.language,
                base_text=req.base_text,
            )
    except Exception as e:
        logger.error(f"[Lesson] Generation failed: {e}")
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


# ─── ADAPTIVE MATERIAL GENERATION (LangGraph fan-out) ───────────────────────

from pydantic import BaseModel as _BaseModel

class AdaptiveGenerateRequest(_BaseModel):
    topic: str
    grade: str
    description: str
    generate_audio: bool = True


@router.post("/generate-adaptive")
async def generate_adaptive_material(
    req: AdaptiveGenerateRequest,
    user: CurrentUser = Depends(require_role("teacher", "admin")),
):
    """
    Generate adaptive study materials for ALL disability categories simultaneously.
    Uses LangGraph fan-out pipeline → Gemini → ElevenLabs TTS.
    Returns a lesson_id with all 9 adaptive versions stored.
    """
    from app.services import adaptive_material_generator

    lesson_id = str(uuid.uuid4())
    logger.info(f"[Lesson] Adaptive generation started: {lesson_id} | topic={req.topic}")

    # 1. Generate all 9 adaptive versions via LangGraph
    try:
        result = await adaptive_material_generator.generate_all_versions(
            topic=req.topic,
            grade=req.grade,
            description=req.description,
        )
    except Exception as e:
        logger.error(f"[Lesson] Adaptive generation failed: {e}")
        raise HTTPException(status_code=502, detail=f"Adaptive generation failed: {e}")

    adaptive_versions = result.get("adaptive_versions", {})
    if not adaptive_versions:
        raise HTTPException(status_code=502, detail="No adaptive versions generated")

    # 2. Generate TTS audio for each category (except hearing — purely visual)
    SKIP_AUDIO = {"hearing"}

    async def add_tts(category: str, version_data: dict) -> None:
        if category in SKIP_AUDIO:
            return
        passage = version_data.get("passage", "")
        if not passage or len(passage) < 20:
            return
        try:
            # Truncate for TTS (ElevenLabs has limits)
            tts_text = passage[:4500]
            audio_bytes = await elevenlabs.tts(tts_text)
            audio_url = storage.upload_audio(
                audio_bytes,
                prefix=f"lessons/{lesson_id}/adaptive",
                filename=f"{category}_audio",
            )
            version_data["audio_url"] = audio_url
            logger.info(f"[Lesson] TTS generated for {category}")
        except Exception as e:
            logger.warning(f"[Lesson] TTS failed for {category}: {e}")

    if req.generate_audio:
        tts_tasks = [
            add_tts(cat, ver)
            for cat, ver in adaptive_versions.items()
            if isinstance(ver, dict) and "error" not in ver
        ]
        await asyncio.gather(*tts_tasks, return_exceptions=True)

    # 3. Build content_json and persist
    content_json = {
        "adaptive_versions": adaptive_versions,
        "is_adaptive": True,
        "generation_stats": result.get("generation_stats", {}),
    }

    created_at = datetime.now(timezone.utc).isoformat()

    await snowflake_db.insert_lesson(
        lesson_id=lesson_id,
        teacher_id=user.user_id,
        topic=req.topic,
        grade=req.grade,
        tiers=0,  # Not tier-based
        content_json=content_json,
    )

    # Log event
    await snowflake_db.log_event(
        user_id=user.user_id,
        event_type="adaptive_material_generated",
        payload={
            "lesson_id": lesson_id,
            "topic": req.topic,
            "grade": req.grade,
            "categories_generated": list(adaptive_versions.keys()),
        },
    )

    return {
        "status": "success",
        "lesson_id": lesson_id,
        "topic": req.topic,
        "grade": req.grade,
        "created_at": created_at,
        "adaptive_versions": adaptive_versions,
        "generation_stats": result.get("generation_stats", {}),
    }

@router.get("/library", response_model=list[LessonSummary])
async def list_library(user: CurrentUser = Depends(require_role("teacher", "admin"))):
    """Return all lessons created by this teacher."""
    lessons = await snowflake_db.list_lessons_by_teacher(user.user_id)
    return [LessonSummary(**l) for l in lessons]


@router.get("/student-assignments")
async def get_student_assignments(
    user: CurrentUser = Depends(get_current_user),
):
    """Fetch assignments for the current student."""
    assignments = await snowflake_db.get_student_assignments(user.user_id if user.role == 'student' else user.name)
    return assignments


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


@router.get("/{lesson_id}/adapted")
async def get_adapted_lesson(
    lesson_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """
    Fetch a lesson and adapt the Tier 1 passage dynamically for the user's
    specific disability_type and learning_style using LangGraph.
    """
    lesson = await snowflake_db.get_lesson(lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
        
    db_user = await snowflake_db.get_user(user.user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User profile not found")
        
    disability = db_user.get("disability_type", "none")
    learning_style = db_user.get("learning_style", "none")
    
    content_json = lesson.get("content_json", {})
    if isinstance(content_json, str):
        content_json = json.loads(content_json)
    
    # ── Check for pre-generated adaptive material ──
    if content_json.get("is_adaptive") and content_json.get("adaptive_versions"):
        # Map disability_type to our category keys
        cat_map = {
            "adhd": "adhd", "autism": "autism", "dyslexia": "dyslexia",
            "visual": "visual", "hearing": "hearing", "intellectual": "intellectual",
            "speech": "speech", "stammering": "speech", "motor": "motor",
        }
        cat_key = cat_map.get(disability.lower(), "general")
        version = content_json["adaptive_versions"].get(cat_key, content_json["adaptive_versions"].get("general", {}))
        
        return {
            "lesson_id": lesson_id,
            "disability_type": disability,
            "learning_style": learning_style,
            "original_text": version.get("passage", ""),
            "adapted_text": version.get("passage", ""),
            "is_adaptive": True,
            "adaptive_version": version,
        }
    
    # ── Standard on-the-fly adaptation ──
    tiers = content_json.get("tiers", [])
    if not tiers:
        raise HTTPException(status_code=500, detail="Lesson contains no content tiers")
        
    base_text = tiers[0].get("passage", "")
    
    adapted_text = await disability_pathway.adapt_content_for_student(
        base_text=base_text,
        disability_type=disability,
        learning_style=learning_style
    )
    
    return {
        "lesson_id": lesson_id,
        "disability_type": disability,
        "learning_style": learning_style,
        "original_text": base_text,
        "adapted_text": adapted_text
    }


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
    
    # Store directly in Snowflake database
    assignment_id = str(uuid.uuid4())
    await snowflake_db.create_assignment(
        assignment_id=assignment_id,
        lesson_id=lesson_id,
        teacher_id=user.user_id,
        assigned_to=req.class_id,
        due_date=req.due_date,
    )

    return {
        "status": "assigned",
        "assignment_id": assignment_id,
        "lesson_id": lesson_id,
        "class_id": req.class_id,
        "due_date": req.due_date,
        "mode": req.mode,
    }


@router.post("/{assignment_id}/submit")
async def submit_student_assignment(
    assignment_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Mark an assignment as submitted by the student (standard path)."""
    try:
        await snowflake_db.submit_assignment(assignment_id)
        return {"status": "success", "assignment_id": assignment_id}
    except Exception as e:
        logger.error(f"[Lesson] Submit assignment error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{assignment_id}/submit-video")
async def submit_video_assignment(
    assignment_id: str,
    assignment_context: str = Form(...),
    video: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
):
    """Mark an assignment as submitted using a Sign Language Video."""
    try:
        video_bytes = await video.read()
        mime_type = video.content_type or "video/mp4"
        
        # 1. Evaluate sign language using Native Gemini
        eval_result = await gemini.evaluate_sign_language_video(video_bytes, mime_type, assignment_context)
        
        # eval_result format: {"transcript": "...", "score": 85, "feedback": "..."}
        transcript = eval_result.get("transcript", "No transcript")
        raw_score = float(eval_result.get("score", 0))
        
        student_response = json.dumps(eval_result)
        
        # 2. Update DB with transcript and raw score
        await snowflake_db.submit_assignment(assignment_id, student_response, raw_score)
        
        return {
            "status": "success", 
            "assignment_id": assignment_id, 
            "evaluation": eval_result
        }
    except Exception as e:
        logger.error(f"[Lesson] Submit video assignment error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/teacher/assignments/submissions")
async def get_teacher_submissions(
    user: CurrentUser = Depends(require_role("teacher")),
):
    """Fetch all submitted assignments by students for this teacher."""
    try:
        # We need a custom query from snowflake to fetch these.
        # Let's add a quick direct query here or use a new snowflake helper
        sql = """
            SELECT a.assignment_id, a.lesson_id, a.assigned_to, a.due_date, a.status, a.created_at, 
                   a.student_response, a.raw_score,
                   l.topic, l.grade,
                   u.name as student_name, u.disability_type, u.user_id as student_id
            FROM assignments a
            JOIN lessons l ON a.lesson_id = l.lesson_id
            JOIN users u on a.assigned_to = u.user_id
            WHERE l.teacher_id = %s AND a.status IN ('submitted', 'reviewed')
            ORDER BY a.created_at DESC
        """
        rows = await snowflake_db.execute(sql, (user.user_id,), fetch=True)
        submissions = []
        for r in (rows or []):
            submissions.append({
                "assignment_id": r[0],
                "lesson_id": r[1],
                "assigned_to": r[2],
                "due_date": r[3],
                "status": r[4],
                "created_at": str(r[5]),
                "student_response": r[6],
                "raw_score": float(r[7]) if r[7] is not None else None,
                "topic": r[8],
                "grade": r[9],
                "student_name": r[10],
                "disability_type": r[11],
                "student_id": r[12]
            })
        return submissions
    except Exception as e:
        logger.error(f"[Lesson] Fetch teacher submissions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

from pydantic import BaseModel
class NormalizeScoreRequest(BaseModel):
    transcript: str
    raw_score: float
    disability_type: str

@router.post("/{assignment_id}/normalize-score")
async def normalize_student_score(
    assignment_id: str,
    req: NormalizeScoreRequest,
    user: CurrentUser = Depends(require_role("teacher")),
):
    """Normalize an AI score using Gemini based on disability factors."""
    try:
        result = await gemini.normalize_score(req.disability_type, req.transcript, req.raw_score)
        return {"status": "success", "normalization": result}
    except Exception as e:
        logger.error(f"[Lesson] Normalize score error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class ReviewAssignmentRequest(BaseModel):
    final_score: float
    teacher_feedback: str

@router.post("/{assignment_id}/review")
async def review_assignment(
    assignment_id: str,
    req: ReviewAssignmentRequest,
    user: CurrentUser = Depends(require_role("teacher")),
):
    """Teacher submits final review for a student assignment."""
    try:
        # In snowflake_db we just update the status, final score, and feedback.
        sql = """
            UPDATE assignments
            SET status = 'reviewed',
                raw_score = %s,
                student_response = COALESCE(student_response, '') || '\n\n[Teacher]: ' || %s
            WHERE assignment_id = %s AND status = 'submitted'
        """
        await snowflake_db.execute(sql, (req.final_score, req.teacher_feedback, assignment_id))
        return {"status": "success"}
    except Exception as e:
        logger.error(f"[Lesson] Review assignment error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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


@router.post("/s2s")
async def speech_to_speech(
    audio: UploadFile = File(...),
    voice_id: Optional[str] = None,
    user: CurrentUser = Depends(get_current_user),
):
    """Convert input audio to output audio using ElevenLabs Speech-to-Speech API."""
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")
        
    mime_type = detect_mime_type(audio.filename or "audio.webm", audio_bytes)
    
    try:
        output_audio = await elevenlabs.s2s(audio_bytes, mime_type, voice_id)
        from fastapi.responses import Response
        return Response(content=output_audio, media_type="audio/mpeg")
    except Exception as e:
        logger.error(f"[Lesson] Speech-to-Speech failed: {e}")
        raise HTTPException(status_code=502, detail=f"Speech-to-Speech failed: {e}")

