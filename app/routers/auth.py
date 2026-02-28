"""Auth router — /auth/register, /auth/login, /auth/me"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from app.dependencies import get_current_user
from app.models.schemas import CurrentUser, UserProfileResponse, AccessibilityProfile, OnboardingRequest, SubRole
from app.services import snowflake_db
from app.services.local_auth import register_user, login_user, create_access_token

router = APIRouter(prefix="/auth", tags=["Auth"])


# ─── Request / Response Models ─────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str  # "teacher" | "student"


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


# ─── Public Routes (no auth required) ─────────────────────────────────────────

@router.post("/register", response_model=TokenResponse)
async def register(payload: RegisterRequest):
    """Register a new teacher or student. Returns JWT token."""
    if payload.role not in ("teacher", "student"):
        raise HTTPException(status_code=400, detail="Role must be 'teacher' or 'student'")
    
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    try:
        user = register_user(payload.name, payload.email, payload.password, payload.role)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    
    # Also upsert into Snowflake so teacher dashboard can find students
    try:
        await snowflake_db.upsert_user(user["user_id"], user["role"], name=user["name"], email=user["email"])
    except Exception:
        pass  # Snowflake may not be available during dev, that's fine
    
    token = create_access_token(user["user_id"], user["name"], user["email"], user["role"])
    return TokenResponse(access_token=token, user=user)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest):
    """Login with email and password. Returns JWT token."""
    user = login_user(payload.email, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    
    token = create_access_token(user["user_id"], user["name"], user["email"], user["role"])
    return TokenResponse(access_token=token, user=user)


# ─── Protected Routes ─────────────────────────────────────────────────────────

@router.get("/me", response_model=UserProfileResponse)
async def get_me(user: CurrentUser = Depends(get_current_user)):
    """Return current user's profile + accessibility settings from Snowflake."""
    db_user = await snowflake_db.get_user(user.user_id)

    if not db_user:
        # Auto-provision user on first login
        await snowflake_db.upsert_user(user.user_id, user.role, name=user.name, email=user.email)
        db_user = {
            "user_id": user.user_id, "role": user.role, "school_id": None, 
            "name": user.name, "email": user.email,
            "accessibility_profile_json": {}, "sub_role": None, 
            "disability_type": None, "learning_style": None, 
            "onboarding_complete": False
        }

    profile_raw = db_user.get("accessibility_profile_json") or {}
    accessibility = AccessibilityProfile(**profile_raw) if isinstance(profile_raw, dict) else AccessibilityProfile()

    return UserProfileResponse(
        user_id=user.user_id,
        name=db_user.get("name") or user.name,
        email=db_user.get("email") or user.email,
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
