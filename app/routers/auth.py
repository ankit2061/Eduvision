"""Auth router — /auth/me"""

from fastapi import APIRouter, Depends, HTTPException, status
from app.dependencies import get_current_user
from app.models.schemas import CurrentUser, UserProfileResponse, AccessibilityProfile, OnboardingRequest, SubRole
from app.services import snowflake_db

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.get("/me", response_model=UserProfileResponse)
async def get_me(user: CurrentUser = Depends(get_current_user)):
    """Return current user's profile + accessibility settings from Snowflake."""
    db_user = await snowflake_db.get_user(user.user_id)

    if not db_user:
        # Auto-provision user on first login
        await snowflake_db.upsert_user(user.user_id, user.role)
        db_user = {
            "user_id": user.user_id, "role": user.role, "school_id": None, 
            "accessibility_profile_json": {}, "sub_role": None, 
            "disability_type": None, "learning_style": None, 
            "onboarding_complete": False
        }

    profile_raw = db_user.get("accessibility_profile_json") or {}
    accessibility = AccessibilityProfile(**profile_raw) if isinstance(profile_raw, dict) else AccessibilityProfile()

    return UserProfileResponse(
        user_id=user.user_id,
        email=user.email,
        role=user.role,
        sub_role=db_user.get("sub_role"),
        school_id=db_user.get("school_id"),
        disability_type=db_user.get("disability_type"),
        learning_style=db_user.get("learning_style"),
        onboarding_complete=db_user.get("onboarding_complete", False),
        accessibility_profile=accessibility,
    )

@router.post("/onboarding")
async def complete_onboarding(payload: OnboardingRequest, user: CurrentUser = Depends(get_current_user)):
    """Complete onboarding by setting sub-role and accessibility preferences."""
    
    # Validate sub_role against Auth0 role
    valid_sub_roles = {
        "teacher": {SubRole.TEACHER_NORMAL, SubRole.TEACHER_SPECIAL},
        "student": {SubRole.STUDENT_NORMAL, SubRole.STUDENT_DIVYANGJAN},
        "admin": {SubRole.ADMIN}
    }
    
    if payload.sub_role not in valid_sub_roles.get(user.role, set()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid sub-role '{payload.sub_role}' for base role '{user.role}'"
        )
        
    prefs_dict = payload.accessibility_preferences.model_dump() if payload.accessibility_preferences else {}
    
    await snowflake_db.complete_onboarding(
        user_id=user.user_id,
        sub_role=payload.sub_role.value if payload.sub_role else None,
        disability_type=payload.disability_type.value if payload.disability_type else None,
        learning_style=payload.learning_style.value if payload.learning_style else None,
        accessibility_profile=prefs_dict
    )
    
    return {"status": "onboarding_complete"}
