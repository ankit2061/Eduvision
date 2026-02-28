"""Events router — UI interaction logging for accessibility analytics."""

from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.models.schemas import CurrentUser, EventLogRequest
from app.services import snowflake_db

router = APIRouter(prefix="/events", tags=["Events"])


@router.post("/")
async def log_event(
    req: EventLogRequest,
    user: CurrentUser = Depends(get_current_user),
):
    """
    Log a UI interaction event to Snowflake events table.
    Used to track accessibility feature usage (caption_toggle_on, dyslexia_font_on, etc.).
    """
    await snowflake_db.log_event(
        user_id=user.user_id,
        event_type=req.event_type,
        payload=req.payload or {},
    )
    return {"status": "logged", "event_type": req.event_type}
