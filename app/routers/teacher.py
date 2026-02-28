"""Teacher analytics router."""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from app.dependencies import require_role
from app.models.schemas import CurrentUser, ClassInsights, StudentProgress
from app.services import snowflake_db

router = APIRouter(prefix="/teacher", tags=["Teacher Analytics"])


@router.get("/class/insights", response_model=ClassInsights)
async def class_insights(
    class_id: Optional[str] = Query(None),
    user: CurrentUser = Depends(require_role("teacher", "admin")),
):
    """Aggregated practice analytics for this teacher's class."""
    data = await snowflake_db.get_class_insights(user.user_id, class_id)
    return ClassInsights(**data)


@router.get("/class/{class_id}/students", response_model=list[StudentProgress])
async def class_students(
    class_id: str,
    user: CurrentUser = Depends(require_role("teacher", "admin")),
):
    """Per-student progress summary for a class."""
    students = await snowflake_db.get_student_progress(user.user_id, class_id)
    return [StudentProgress(**s) for s in students]
