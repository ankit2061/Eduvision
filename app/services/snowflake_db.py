"""
Snowflake connector and CRUD helpers.
Uses snowflake-connector-python with async-safe thread executor pattern.
"""

import uuid
import json
import asyncio
from typing import Optional, Any
from datetime import datetime, timezone
from functools import partial

import snowflake.connector
from loguru import logger
from app.config import get_settings

settings = get_settings()

# ─── Connection ───────────────────────────────────────────────────────────────

def _get_connection():
    return snowflake.connector.connect(
        account=settings.snowflake_account,
        user=settings.snowflake_user,
        password=settings.snowflake_password,
        database=settings.snowflake_database,
        schema=settings.snowflake_schema,
        warehouse=settings.snowflake_warehouse,
        role=settings.snowflake_role,
        session_parameters={"QUERY_TAG": "eduvision-backend"},
    )


def _run_sync(fn, *args, **kwargs):
    """Run a sync Snowflake operation (blocking) in threadpool."""
    return asyncio.get_event_loop().run_in_executor(None, partial(fn, *args, **kwargs))


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Generic helpers ──────────────────────────────────────────────────────────

def _execute(sql: str, params: tuple = (), fetch: bool = False) -> Optional[list]:
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            if fetch:
                return cur.fetchall()
    return None


async def execute(sql: str, params: tuple = (), fetch: bool = False):
    return await _run_sync(_execute, sql, params, fetch)


# ─── Users ────────────────────────────────────────────────────────────────────

async def upsert_user(
    user_id: str,
    role: str,
    school_id: Optional[str] = None,
    accessibility_profile: Optional[dict] = None,
):
    profile_json = json.dumps(accessibility_profile or {})
    sql = """
        MERGE INTO users AS target
        USING (SELECT %s AS user_id, %s AS role, %s AS school_id, PARSE_JSON(%s) AS accessibility_profile_json) AS src
        ON target.user_id = src.user_id
        WHEN MATCHED THEN UPDATE SET
            role = src.role,
            school_id = src.school_id,
            accessibility_profile_json = src.accessibility_profile_json
        WHEN NOT MATCHED THEN INSERT (user_id, role, school_id, accessibility_profile_json, created_at)
            VALUES (src.user_id, src.role, src.school_id, src.accessibility_profile_json, CURRENT_TIMESTAMP)
    """
    await execute(sql, (user_id, role, school_id, profile_json))
    logger.info(f"[Snowflake] upsert_user: {user_id}")


async def get_user(user_id: str) -> Optional[dict]:
    rows = await execute(
        "SELECT user_id, role, school_id, accessibility_profile_json FROM users WHERE user_id = %s",
        (user_id,),
        fetch=True,
    )
    if not rows:
        return None
    r = rows[0]
    return {"user_id": r[0], "role": r[1], "school_id": r[2], "accessibility_profile_json": r[3]}


# ─── Lessons ──────────────────────────────────────────────────────────────────

async def insert_lesson(
    lesson_id: str,
    teacher_id: str,
    topic: str,
    grade: str,
    tiers: int,
    content_json: dict,
) -> str:
    sql = """
        INSERT INTO lessons (lesson_id, teacher_id, topic, grade, tiers, content_json, created_at)
        VALUES (%s, %s, %s, %s, %s, PARSE_JSON(%s), CURRENT_TIMESTAMP)
    """
    await execute(sql, (lesson_id, teacher_id, topic, grade, tiers, json.dumps(content_json)))
    logger.info(f"[Snowflake] insert_lesson: {lesson_id}")
    return lesson_id


async def get_lesson(lesson_id: str) -> Optional[dict]:
    rows = await execute(
        "SELECT lesson_id, teacher_id, topic, grade, tiers, content_json, created_at FROM lessons WHERE lesson_id = %s",
        (lesson_id,),
        fetch=True,
    )
    if not rows:
        return None
    r = rows[0]
    return {
        "lesson_id": r[0], "teacher_id": r[1], "topic": r[2],
        "grade": r[3], "tiers": r[4], "content_json": r[5], "created_at": str(r[6]),
    }


async def list_lessons_by_teacher(teacher_id: str) -> list:
    rows = await execute(
        "SELECT lesson_id, topic, grade, tiers, created_at FROM lessons WHERE teacher_id = %s ORDER BY created_at DESC",
        (teacher_id,),
        fetch=True,
    )
    return [
        {"lesson_id": r[0], "topic": r[1], "grade": r[2], "tiers": r[3], "created_at": str(r[4])}
        for r in (rows or [])
    ]


# ─── Lesson Assets ────────────────────────────────────────────────────────────

async def insert_lesson_asset(lesson_id: str, level: int, audio_url: str, pdf_url: str = "", checksum: str = ""):
    sql = """
        INSERT INTO lesson_assets (lesson_id, level, audio_url, pdf_url, checksum, created_at)
        VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
    """
    await execute(sql, (lesson_id, level, audio_url, pdf_url, checksum))


async def get_lesson_audio(lesson_id: str, level: int) -> Optional[str]:
    rows = await execute(
        "SELECT audio_url FROM lesson_assets WHERE lesson_id = %s AND level = %s",
        (lesson_id, level),
        fetch=True,
    )
    return rows[0][0] if rows else None


# ─── Practice Sessions ────────────────────────────────────────────────────────

async def create_session(
    session_id: str,
    student_id: str,
    lesson_id: Optional[str],
    mode: str,
    accessibility_json: dict,
):
    sql = """
        INSERT INTO practice_sessions (session_id, student_id, lesson_id, mode, accessibility_mode_json, started_at)
        VALUES (%s, %s, %s, %s, PARSE_JSON(%s), CURRENT_TIMESTAMP)
    """
    await execute(sql, (session_id, student_id, lesson_id, mode, json.dumps(accessibility_json)))
    logger.info(f"[Snowflake] create_session: {session_id}")


async def end_session(session_id: str):
    await execute(
        "UPDATE practice_sessions SET ended_at = CURRENT_TIMESTAMP WHERE session_id = %s",
        (session_id,),
    )


async def get_session(session_id: str) -> Optional[dict]:
    rows = await execute(
        "SELECT session_id, student_id, lesson_id, mode, accessibility_mode_json, started_at, ended_at FROM practice_sessions WHERE session_id = %s",
        (session_id,),
        fetch=True,
    )
    if not rows:
        return None
    r = rows[0]
    return {
        "session_id": r[0], "student_id": r[1], "lesson_id": r[2],
        "mode": r[3], "accessibility_mode_json": r[4],
        "started_at": str(r[5]), "ended_at": str(r[6]) if r[6] else None,
    }


# ─── Practice Artifacts ───────────────────────────────────────────────────────

async def save_artifact(
    session_id: str,
    audio_url: str,
    transcript_text: str,
    feedback_json: dict,
    scores_json: dict,
):
    sql = """
        INSERT INTO practice_artifacts (session_id, audio_url, transcript_text, feedback_json, scores_json)
        VALUES (%s, %s, %s, PARSE_JSON(%s), PARSE_JSON(%s))
    """
    await execute(sql, (session_id, audio_url, transcript_text, json.dumps(feedback_json), json.dumps(scores_json)))
    logger.info(f"[Snowflake] save_artifact: session={session_id}")


# ─── Analytics ────────────────────────────────────────────────────────────────

async def get_class_insights(teacher_id: str, class_id: Optional[str] = None) -> dict:
    """Returns aggregate metrics for a teacher's class from Snowflake."""
    rows = await execute(
        """
        SELECT
            COUNT(ps.session_id) AS total_sessions,
            AVG(pa.scores_json:fluency::FLOAT) AS avg_fluency,
            AVG(pa.scores_json:grammar::FLOAT) AS avg_grammar,
            AVG(pa.scores_json:confidence::FLOAT) AS avg_confidence
        FROM practice_sessions ps
        JOIN practice_artifacts pa ON ps.session_id = pa.session_id
        JOIN lessons l ON ps.lesson_id = l.lesson_id
        WHERE l.teacher_id = %s
        """,
        (teacher_id,),
        fetch=True,
    )
    if not rows or not rows[0][0]:
        return {
            "class_id": class_id,
            "total_sessions": 0,
            "avg_fluency": None,
            "avg_grammar": None,
            "avg_confidence": None,
            "common_errors": [],
            "improvement_trend": "stable",
            "accessibility_usage": {},
        }

    r = rows[0]
    return {
        "class_id": class_id,
        "total_sessions": int(r[0] or 0),
        "avg_fluency": round(float(r[1]), 2) if r[1] else None,
        "avg_grammar": round(float(r[2]), 2) if r[2] else None,
        "avg_confidence": round(float(r[3]), 2) if r[3] else None,
        "common_errors": [],
        "improvement_trend": "stable",
        "accessibility_usage": {},
    }


async def get_student_progress(teacher_id: str, class_id: Optional[str] = None) -> list:
    rows = await execute(
        """
        SELECT
            ps.student_id,
            COUNT(ps.session_id) AS session_count,
            AVG(pa.scores_json:fluency::FLOAT) AS avg_fluency,
            AVG(pa.scores_json:grammar::FLOAT) AS avg_grammar,
            AVG(pa.scores_json:confidence::FLOAT) AS avg_confidence,
            MAX(ps.started_at) AS last_active
        FROM practice_sessions ps
        JOIN practice_artifacts pa ON ps.session_id = pa.session_id
        JOIN lessons l ON ps.lesson_id = l.lesson_id
        WHERE l.teacher_id = %s
        GROUP BY ps.student_id
        ORDER BY last_active DESC
        """,
        (teacher_id,),
        fetch=True,
    )
    return [
        {
            "student_id": r[0],
            "name": None,
            "session_count": int(r[1] or 0),
            "avg_fluency": round(float(r[2]), 2) if r[2] else None,
            "avg_grammar": round(float(r[3]), 2) if r[3] else None,
            "avg_confidence": round(float(r[4]), 2) if r[4] else None,
            "last_active": str(r[5]) if r[5] else None,
            "accessibility_modes_used": [],
        }
        for r in (rows or [])
    ]


# ─── Events ───────────────────────────────────────────────────────────────────

async def log_event(user_id: str, event_type: str, payload: dict):
    event_id = str(uuid.uuid4())
    sql = """
        INSERT INTO events (event_id, user_id, event_type, payload_json, ts)
        VALUES (%s, %s, %s, PARSE_JSON(%s), CURRENT_TIMESTAMP)
    """
    await execute(sql, (event_id, user_id, event_type, json.dumps(payload or {})))
    logger.debug(f"[Snowflake] log_event: {event_type} for user={user_id}")
