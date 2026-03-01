"""
Student router — dashboard-specific statistics and progress.
"""

from fastapi import APIRouter, Depends
from app.dependencies import get_current_user, require_role
from app.models.schemas import CurrentUser, StudentStatsResponse
from app.services import snowflake_db

router = APIRouter(prefix="/student", tags=["Student"])


@router.get("/stats", response_model=StudentStatsResponse)
async def get_student_stats(user: CurrentUser = Depends(require_role("student", "admin"))):
    """Fetch current student's statistics and gamification data from Snowflake."""
    return await snowflake_db.get_student_stats(user.user_id)
