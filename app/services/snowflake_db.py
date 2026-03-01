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
    sub_role: Optional[str] = None,
    disability_type: Optional[str] = None,
    learning_style: Optional[str] = None,
    onboarding_complete: bool = False,
    name: Optional[str] = None,
    email: Optional[str] = None,
):
    profile_json = json.dumps(accessibility_profile or {})
    sql = """
        MERGE INTO users AS target
        USING (SELECT %s AS user_id, %s AS role, %s AS school_id, PARSE_JSON(%s) AS accessibility_profile_json, %s AS sub_role, %s AS disability_type, %s AS learning_style, %s AS onboarding_complete, %s AS name, %s AS email) AS src
        ON target.user_id = src.user_id
        WHEN MATCHED THEN UPDATE SET
            role = src.role,
            school_id = src.school_id,
            accessibility_profile_json = src.accessibility_profile_json,
            sub_role = src.sub_role,
            disability_type = src.disability_type,
            learning_style = src.learning_style,
            onboarding_complete = src.onboarding_complete,
            name = src.name,
            email = src.email
        WHEN NOT MATCHED THEN INSERT (user_id, role, school_id, accessibility_profile_json, sub_role, disability_type, learning_style, onboarding_complete, name, email, created_at)
            VALUES (src.user_id, src.role, src.school_id, src.accessibility_profile_json, src.sub_role, src.disability_type, src.learning_style, src.onboarding_complete, src.name, src.email, CURRENT_TIMESTAMP)
    """
    await execute(sql, (user_id, role, school_id, profile_json, sub_role, disability_type, learning_style, onboarding_complete, name, email))
    logger.info(f"[Snowflake] upsert_user: {user_id}")


async def get_user(user_id: str) -> Optional[dict]:
    rows = await execute(
        "SELECT user_id, role, school_id, accessibility_profile_json, sub_role, disability_type, learning_style, onboarding_complete, name, email FROM users WHERE user_id = %s",
        (user_id,),
        fetch=True,
    )
    if not rows:
        return None
    r = rows[0]
    return {
        "user_id": r[0], "role": r[1], "school_id": r[2], 
        "accessibility_profile_json": r[3], "sub_role": r[4], 
        "disability_type": r[5], "learning_style": r[6], 
        "onboarding_complete": bool(r[7]) if r[7] is not None else False,
        "name": r[8], "email": r[9]
    }
async def delete_user(user_id: str):
    await execute("DELETE FROM users WHERE user_id = %s", (user_id,))
    logger.info(f"[Snowflake] delete_user: {user_id}")

async def complete_onboarding(user_id: str, sub_role: str, disability_type: Optional[str], learning_style: Optional[str], accessibility_profile: Optional[dict]):
    profile_json = json.dumps(accessibility_profile or {})
    sql = """
        UPDATE users SET
            sub_role = %s,
            disability_type = %s,
            learning_style = %s,
            accessibility_profile_json = PARSE_JSON(%s),
            onboarding_complete = TRUE
        WHERE user_id = %s
    """
    await execute(sql, (sub_role, disability_type, learning_style, profile_json, user_id))
    logger.info(f"[Snowflake] complete_onboarding for {user_id}")

async def list_students_by_school(school_id: str) -> list:
    rows = await execute(
        "SELECT user_id, role, sub_role, disability_type, learning_style, onboarding_complete, accessibility_profile_json, name, email FROM users WHERE school_id = %s",
        (school_id,),
        fetch=True,
    )
    return [
       {
           "user_id": r[0], "role": r[1], "sub_role": r[2],
           "disability_type": r[3], "learning_style": r[4],
           "onboarding_complete": bool(r[5]) if r[5] is not None else False,
           "accessibility_profile_json": r[6], "name": r[7], "email": r[8]
       } for r in (rows or [])
    ]


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
        SELECT %s, %s, %s, %s, %s, PARSE_JSON(%s), CURRENT_TIMESTAMP
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


async def update_lesson(lesson_id: str, content_json: dict):
    sql = """
        UPDATE lessons
        SET content_json = PARSE_JSON(%s)
        WHERE lesson_id = %s
    """
    await execute(sql, (json.dumps(content_json), lesson_id))
    logger.info(f"[Snowflake] update_lesson: {lesson_id}")


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

# ─── Tests ────────────────────────────────────────────────────────────

async def create_test(
    test_id: str,
    teacher_id: str,
    title: str,
    topic: str,
    grade: str,
    time_limit: int,
    questions: list
):
    sql = """
        INSERT INTO tests (test_id, teacher_id, title, topic, grade, time_limit, questions, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, PARSE_JSON(%s), CURRENT_TIMESTAMP)
    """
    await execute(sql, (test_id, teacher_id, title, topic, grade, time_limit, json.dumps(questions)))
    logger.info(f"[Snowflake] create_test: {test_id}")
    return test_id


async def get_test(test_id: str) -> Optional[dict]:
    rows = await execute(
        "SELECT test_id, teacher_id, title, topic, grade, time_limit, questions, created_at FROM tests WHERE test_id = %s",
        (test_id,),
        fetch=True,
    )
    if not rows:
        return None
    r = rows[0]
    
    q_data = r[6]
    if isinstance(q_data, str):
        try:
            q_data = json.loads(q_data)
        except json.JSONDecodeError:
            pass
            
    return {
        "test_id": r[0],
        "teacher_id": r[1],
        "title": r[2],
        "topic": r[3],
        "grade": r[4],
        "time_limit": r[5],
        "questions": q_data,
        "created_at": str(r[7]) if r[7] else None
    }


# ─── Assignments ────────────────────────────────────────────────────────────

async def create_assignment(
    assignment_id: str,
    teacher_id: str,
    assigned_to: str,
    lesson_id: Optional[str] = None,
    test_id: Optional[str] = None,
    due_date: Optional[str] = None,
    assignment_type: str = 'lesson'
) -> str:
    sql = """
        INSERT INTO assignments (assignment_id, lesson_id, test_id, type, teacher_id, assigned_to, due_date, status, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending', CURRENT_TIMESTAMP)
    """
    await execute(sql, (assignment_id, lesson_id, test_id, assignment_type, teacher_id, assigned_to, due_date))
    logger.info(f"[Snowflake] create_assignment: {assignment_id} (type: {assignment_type})")
    return assignment_id


async def get_student_assignments(assigned_to: str) -> list:
    # We use LEFT JOINs to fetch either lesson or test info depending on the type
    sql = """
        SELECT a.assignment_id, a.lesson_id, a.test_id, a.type, a.teacher_id, a.assigned_to, a.due_date, a.status, a.created_at, l.topic, l.grade, t.topic as test_topic, t.grade as test_grade, t.title as test_title
        FROM assignments a
        LEFT JOIN lessons l ON a.lesson_id = l.lesson_id
        LEFT JOIN tests t ON a.test_id = t.test_id
        WHERE a.assigned_to = %s OR a.assigned_to = 'class'
        ORDER BY a.created_at DESC
    """
    rows = await execute(sql, (assigned_to,), fetch=True)
    return [
        {
            "assignment_id": r[0],
            "lesson_id": r[1],
            "test_id": r[2],
            "type": r[3] or 'lesson',
            "teacher_id": r[4],
            "assigned_to": r[5],
            "due_date": r[6],
            "status": r[7],
            "created_at": str(r[8]),
            "topic": r[9] if r[3] == 'lesson' else r[11],
            "grade": r[10] if r[3] == 'lesson' else r[12],
            "title": r[13] if r[3] == 'test' else None
        }
        for r in (rows or [])
    ]


async def submit_assignment(assignment_id: str, student_response: Optional[str] = None, raw_score: Optional[float] = None):
    sql = """
        UPDATE assignments
        SET status = 'submitted',
            student_response = COALESCE(%s, student_response),
            raw_score = COALESCE(%s, raw_score)
        WHERE assignment_id = %s
    """
    await execute(sql, (student_response, raw_score, assignment_id))
    logger.info(f"[Snowflake] submit_assignment: {assignment_id} (score={raw_score})")


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
        SELECT %s, %s, %s, %s, PARSE_JSON(%s), CURRENT_TIMESTAMP
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
        SELECT %s, %s, %s, PARSE_JSON(%s), PARSE_JSON(%s)
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
            u.user_id AS student_id,
            COUNT(ps.session_id) AS session_count,
            AVG(pa.scores_json:fluency::FLOAT) AS avg_fluency,
            AVG(pa.scores_json:grammar::FLOAT) AS avg_grammar,
            AVG(pa.scores_json:confidence::FLOAT) AS avg_confidence,
            MAX(ps.started_at) AS last_active,
            u.disability_type,
            u.learning_style,
            u.name
        FROM users u
        LEFT JOIN practice_sessions ps ON u.user_id = ps.student_id
        LEFT JOIN practice_artifacts pa ON ps.session_id = pa.session_id
        LEFT JOIN lessons l ON ps.lesson_id = l.lesson_id AND l.teacher_id = %s
        WHERE u.role = 'student'
        GROUP BY u.user_id, u.disability_type, u.learning_style, u.name
        ORDER BY last_active DESC NULLS LAST
        """,
        (teacher_id,),
        fetch=True,
    )
    return [
        {
            "student_id": r[0],
            "name": r[8],
            "session_count": int(r[1] or 0),
            "avg_fluency": round(float(r[2]), 2) if r[2] else None,
            "avg_grammar": round(float(r[3]), 2) if r[3] else None,
            "avg_confidence": round(float(r[4]), 2) if r[4] else None,
            "last_active": str(r[5]) if r[5] else None,
            "accessibility_modes_used": [r[6] or r[7] or "general"],
        }
        for r in (rows or [])
    ]


# ─── Events ───────────────────────────────────────────────────────────────────

async def log_event(user_id: str, event_type: str, payload: dict):
    event_id = str(uuid.uuid4())
    sql = """
        INSERT INTO events (event_id, user_id, event_type, payload_json, ts)
        SELECT %s, %s, %s, PARSE_JSON(%s), CURRENT_TIMESTAMP
    """
    await execute(sql, (event_id, user_id, event_type, json.dumps(payload or {})))
    logger.debug(f"[Snowflake] log_event: {event_type} for user={user_id}")


async def get_student_stats(user_id: str) -> dict:
    """Calculate realistic student stats and gamification progress."""
    try:
        # 1. Total Sessions & Trend (+X in last 7 days)
        sql_sessions = """
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN started_at >= DATEADD(day, -7, CURRENT_TIMESTAMP()) THEN 1 END) as recent
            FROM practice_sessions 
            WHERE student_id = %s
        """
        session_rows = await execute(sql_sessions, (user_id,), fetch=True)
        total_sessions = session_rows[0][0] or 0
        recent_sessions = session_rows[0][1] or 0
        
        # 2. Avg Fluency & Trend
        sql_fluency = """
            SELECT 
                AVG(pa.scores_json:fluency::FLOAT) as avg_f,
                AVG(CASE WHEN ps.started_at >= DATEADD(day, -7, CURRENT_TIMESTAMP()) THEN pa.scores_json:fluency::FLOAT END) as recent_f
            FROM practice_artifacts pa
            JOIN practice_sessions ps ON pa.session_id = ps.session_id
            WHERE ps.student_id = %s
        """
        fluency_rows = await execute(sql_fluency, (user_id,), fetch=True)
        avg_fluency = round(float(fluency_rows[0][0]), 2) if fluency_rows[0][0] is not None else 0.0
        recent_fluency = round(float(fluency_rows[0][1]), 2) if fluency_rows[0][1] is not None else 0.0
        
        f_diff = avg_fluency - recent_fluency # Simplistic trend
        f_trend = f"{'+' if f_diff >= 0 else ''}{round(f_diff, 1)}%" if recent_fluency > 0 else "New!"

        # 3. Streak (consecutive days)
        sql_streak = """
            WITH RECURSIVE Dates AS (
                SELECT DISTINCT CAST(started_at AS DATE) as d
                FROM practice_sessions 
                WHERE student_id = %s
            ),
            Consecutive AS (
                SELECT d, 1 as streak
                FROM Dates
                WHERE d >= DATEADD(day, -1, CURRENT_DATE())
                
                UNION ALL
                
                SELECT d1.d, c.streak + 1
                FROM Dates d1
                JOIN Consecutive c ON d1.d = DATEADD(day, -1, c.d)
            )
            SELECT MAX(streak) FROM Consecutive
        """
        streak_rows = await execute(sql_streak, (user_id,), fetch=True)
        streak_days = streak_rows[0][0] or 0

        # 4. Badges (Rules-based)
        badges = []
        if total_sessions >= 1: badges.append("First Step")
        if total_sessions >= 10: badges.append("Consistent")
        if avg_fluency >= 8.0 and total_sessions >= 5: badges.append("Fluency Ace")
        if streak_days >= 7: badges.append("Week Warrior")
        
        # Check for submitted tests/assignments for more badges
        sql_submitted = "SELECT COUNT(*) FROM assignments WHERE assigned_to = %s AND status = 'submitted'"
        submit_rows = await execute(sql_submitted, (user_id,), fetch=True)
        if (submit_rows[0][0] or 0) >= 5: badges.append("Quiz Master")

        # 5. XP & Level
        xp = (total_sessions * 100) + (submit_rows[0][0] or 0) * 200
        level = (xp // 1000) + 1
        xp_progress = (xp % 1000) / 10 # 0-100 percentage for the current level

        # 6. Activity Map (Last 90 days of engagement)
        sql_activity = """
            SELECT 
                TO_CHAR(CAST(day AS DATE), 'YYYY-MM-DD') as activity_date,
                COUNT(*) as activity_count
            FROM (
                SELECT started_at as day FROM practice_sessions WHERE student_id = %s
                UNION ALL
                SELECT ts as day FROM events WHERE user_id = %s AND event_type = 'assignment_submitted'
            )
            WHERE day >= DATEADD(day, -90, CURRENT_DATE())
            GROUP BY 1
            ORDER BY 1 ASC
        """
        # Note: events table might be empty if logging is disabled, UNION ALL stays safe
        activity_rows = await execute(sql_activity, (user_id, user_id), fetch=True)
        activity_data = [{"date": r[0], "count": r[1]} for r in (activity_rows or [])]

        return {
            "total_sessions": total_sessions,
            "avg_fluency": avg_fluency,
            "streak_days": streak_days,
            "badges_earned": len(badges),
            "total_badges": 10,
            "fluency_trend": f_trend,
            "sessions_trend": f"+{recent_sessions}",
            "streak_trend": "Best!" if streak_days > 5 else "Keep going!",
            "badges_trend": f"+{len(badges)}" if len(badges) > 0 else "0",
            "xp": xp,
            "level": level,
            "xp_progress": xp_progress,
            "activity_data": activity_data
        }
    except Exception as e:
        logger.error(f"[Snowflake] get_student_stats error: {e}")
        # Return realistic defaults instead of crashing
        return {
            "total_sessions": 0, "avg_fluency": 0.0, "streak_days": 0,
            "badges_earned": 0, "total_badges": 10,
            "fluency_trend": "0%", "sessions_trend": "+0",
            "streak_trend": "New!", "badges_trend": "+0",
            "xp": 0, "level": 1, "xp_progress": 0.0,
            "activity_data": []
        }
