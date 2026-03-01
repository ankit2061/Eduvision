from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import uuid

from app.dependencies import get_current_user, require_role
from app.models.schemas import CurrentUser
from app.services import snowflake_db

router = APIRouter()

class TestQuestion(BaseModel):
    id: str
    type: str  # "multiple_choice", "written", "audio_response", "visual_match"
    question: str
    options: Optional[List[str]] = None
    correctAnswer: Optional[str] = None
    mediaUrl: Optional[str] = None

class CreateTestRequest(BaseModel):
    title: str
    topic: str
    grade: str
    timeLimit: int
    questions: List[TestQuestion]

@router.post("/")
async def create_test_endpoint(
    req: CreateTestRequest,
    user: CurrentUser = Depends(require_role("teacher", "admin")),
):
    """Create a new test in the library."""
    test_id = f"test_{uuid.uuid4().hex[:12]}"
    await snowflake_db.create_test(
        test_id=test_id,
        teacher_id=user.user_id,
        title=req.title,
        topic=req.topic,
        grade=req.grade,
        time_limit=req.timeLimit,
        questions=[q.model_dump() for q in req.questions]
    )
    return {"status": "success", "test_id": test_id}


class TestAssignRequest(BaseModel):
    class_id: str
    due_date: Optional[str] = None


@router.post("/{test_id}/assign")
async def assign_test(
    test_id: str,
    req: TestAssignRequest,
    user: CurrentUser = Depends(require_role("teacher", "admin")),
):
    """Assign a test to a class or specific student."""
    test_data = await snowflake_db.get_test(test_id)
    if not test_data:
        raise HTTPException(status_code=404, detail="Test not found")

    assignment_id = f"asgn_{uuid.uuid4().hex[:12]}"
    await snowflake_db.create_assignment(
        assignment_id=assignment_id,
        teacher_id=user.user_id,
        assigned_to=req.class_id,
        test_id=test_id,
        due_date=req.due_date,
        assignment_type="test",
    )

    await snowflake_db.log_event(
        user_id=user.user_id,
        event_type="test_assigned",
        payload={"test_id": test_id, "class_id": req.class_id, "due_date": req.due_date},
    )

    return {"status": "assigned", "assignment_id": assignment_id, "test_id": test_id}


@router.get("/student/available")
async def get_student_tests(
    user: CurrentUser = Depends(get_current_user),
):
    """
    Fetch tests assigned to the student (either directly or via 'class').
    Since get_student_assignments fetches both lessons and tests, we will filter for tests.
    """
    assigned_to = user.user_id if user.role == 'student' else user.name
    assignments = await snowflake_db.get_student_assignments(assigned_to)
    
    # Filter for tests and hydrate the full test object
    test_assignments = [a for a in assignments if a.get("type") == "test"]
    
    hydrated_tests = []
    for ta in test_assignments:
        test_id = ta.get("test_id")
        if not test_id: continue
        
        test_data = await snowflake_db.get_test(test_id)
        if test_data:
            # Add assignment specific data
            test_data["assignment_id"] = ta["assignment_id"]
            test_data["due_date"] = ta["due_date"]
            test_data["status"] = ta["status"]
            hydrated_tests.append(test_data)
            
    return hydrated_tests

@router.get("/{test_id}")
async def get_test_endpoint(
    test_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Fetch a single test by ID."""
    test_data = await snowflake_db.get_test(test_id)
    if not test_data:
        raise HTTPException(status_code=404, detail="Test not found")
    return test_data
