"""Auth router — /auth/me"""

from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.models.schemas import CurrentUser, UserProfileResponse, AccessibilityProfile
from app.services import snowflake_db

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.get("/me", response_model=UserProfileResponse)
async def get_me(user: CurrentUser = Depends(get_current_user)):
    """Return current user's profile + accessibility settings from Snowflake."""
    db_user = await snowflake_db.get_user(user.user_id)

    if not db_user:
        # Auto-provision user on first login
        await snowflake_db.upsert_user(user.user_id, user.role)
        db_user = {"user_id": user.user_id, "role": user.role, "school_id": None, "accessibility_profile_json": {}}

    profile_raw = db_user.get("accessibility_profile_json") or {}
    accessibility = AccessibilityProfile(**profile_raw) if isinstance(profile_raw, dict) else AccessibilityProfile()

    return UserProfileResponse(
        user_id=user.user_id,
        email=user.email,
        role=user.role,
        school_id=db_user.get("school_id"),
        accessibility_profile=accessibility,
    )
