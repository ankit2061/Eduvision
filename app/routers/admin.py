"""Admin router — /admin"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from app.dependencies import require_role
from app.models.schemas import CurrentUser, SubRole, DisabilityType, LearningStyle
from app.services import snowflake_db

router = APIRouter(prefix="/admin", tags=["Admin"])


class StudentUpload(BaseModel):
    user_id: str
    email: str
    disability_type: Optional[DisabilityType]
    learning_style: Optional[LearningStyle]


class UploadProfilesRequest(BaseModel):
    students: List[StudentUpload]


class AssignClassRequest(BaseModel):
    student_id: str
    class_id: str


@router.get("/students")
async def get_students(user: CurrentUser = Depends(require_role("admin"))):
    """List all students for the admin's institution."""
    # Assuming school_id is mapped to the admin's school_id
    admin_profile = await snowflake_db.get_user(user.user_id)
    school_id = admin_profile.get("school_id")
    if not school_id:
        return []
    
    students = await snowflake_db.list_students_by_school(school_id)
    return {"students": students}


@router.post("/students/upload-profiles")
async def upload_profiles(payload: UploadProfilesRequest, user: CurrentUser = Depends(require_role("admin"))):
    """Bulk upload/update student disability profiles."""
    admin_profile = await snowflake_db.get_user(user.user_id)
    school_id = admin_profile.get("school_id")
    
    # In a real app, this would be a batch UPSERT. For now we loop.
    for student in payload.students:
        sub_role = SubRole.STUDENT_DIVYANGJAN if student.disability_type and student.disability_type != DisabilityType.NONE else SubRole.STUDENT_NORMAL
        
        # Merge/update the user record in Snowflake
        await snowflake_db.upsert_user(
            user_id=student.user_id,
            role="student",
            school_id=school_id,
            sub_role=sub_role.value if sub_role else None,
            disability_type=student.disability_type.value if student.disability_type else None,
            learning_style=student.learning_style.value if student.learning_style else None,
            onboarding_complete=False # Reset or keep onboarding state? Usually leave false so they confirm
        )
        
    return {"status": "success", "uploaded_count": len(payload.students)}


@router.post("/students/assign-class")
async def assign_class(payload: AssignClassRequest, user: CurrentUser = Depends(require_role("admin"))):
    """Assign a student to a specific class (dummy implementation for now)."""
    # In a real app, you would have a `class_enrollments` table.
    return {"status": "success", "message": f"Assigned {payload.student_id} to {payload.class_id}"}


@router.get("/analytics")
async def get_analytics(user: CurrentUser = Depends(require_role("admin"))):
    """Institution-wide inclusivity analytics."""
    admin_profile = await snowflake_db.get_user(user.user_id)
    school_id = admin_profile.get("school_id")
    
    if not school_id:
        return {"total_students": 0, "disability_breakdown": {}}
        
    students = await snowflake_db.list_students_by_school(school_id)
    
    total = len(students)
    breakdown = {}
    for s in students:
        dt = s.get("disability_type") or "none"
        breakdown[dt] = breakdown.get(dt, 0) + 1
        
    return {
        "total_students": total,
        "disability_breakdown": breakdown,
        "active_classes": 12, # mock
        "total_teachers": 5   # mock
    }
