from __future__ import annotations

from typing import Optional, Any, Dict, List
from pydantic import BaseModel, Field
import uuid
from enum import Enum


# ─── Enums ────────────────────────────────────────────────────────────────────

class SubRole(str, Enum):
    TEACHER_NORMAL = "teacher_normal"
    TEACHER_SPECIAL = "teacher_special"
    STUDENT_NORMAL = "student_normal"
    STUDENT_DIVYANGJAN = "student_divyangjan"
    ADMIN = "admin"

class DisabilityType(str, Enum):
    SPEECH = "speech"
    DYSLEXIA = "dyslexia"
    HEARING = "hearing"
    VISUAL = "visual"
    MOTOR = "motor"
    AUTISM = "autism"
    ADHD = "adhd"
    INTELLECTUAL = "intellectual"
    AAC = "aac"
    NONE = "none"

class LearningStyle(str, Enum):
    VISUAL = "visual"
    AUDITORY = "auditory"
    READING_WRITING = "reading_writing"
    KINESTHETIC = "kinesthetic"
    NONE = "none"



# ─── Shared ───────────────────────────────────────────────────────────────────

class AccessibilityProfile(BaseModel):
    high_contrast: bool = False
    font_scale: float = 1.0
    dyslexia_font: bool = False
    focus_line: bool = False
    captions_always_on: bool = False
    visual_rubric: bool = False
    stammer_friendly: bool = False
    longer_response_window: bool = False
    sensory_friendly: bool = False
    gamification_off: bool = False
    aac_mode: bool = False


class CurrentUser(BaseModel):
    user_id: str
    name: Optional[str] = None
    email: Optional[str] = None
    role: str  # "teacher" | "student" | "admin" from Auth0 token
    sub_role: Optional[SubRole] = None  # Loaded from DB if available


# ─── Auth ─────────────────────────────────────────────────────────────────────

class UserProfileResponse(BaseModel):
    user_id: str
    name: Optional[str] = None
    email: Optional[str] = None
    role: str
    sub_role: Optional[SubRole]
    school_id: Optional[str]
    disability_type: Optional[DisabilityType]
    learning_style: Optional[LearningStyle]
    onboarding_complete: bool
    accessibility_profile: Optional[AccessibilityProfile]

class OnboardingRequest(BaseModel):
    sub_role: SubRole
    is_specially_abled: bool = False
    disability_type: Optional[DisabilityType] = None
    learning_style: Optional[LearningStyle] = None
    accessibility_preferences: Optional[AccessibilityProfile] = None


# ─── Lesson ───────────────────────────────────────────────────────────────────

class LessonGenerateRequest(BaseModel):
    topic: str = Field(..., min_length=3, max_length=300)
    grade: str = Field(..., description="E.g. '5', '8', 'K'")
    tiers: int = Field(3, ge=1, le=5)
    language: str = Field("en", description="ISO 639-1 language code")
    base_text: Optional[str] = Field(None, description="Optional seed text for differentiation")
    learning_style: Optional[LearningStyle] = Field(None, description="Target learning style for the content")
    generate_audio: bool = True


class LessonTier(BaseModel):
    level: int
    label: str          # e.g. "Foundational", "Grade-Level", "Advanced"
    passage: str
    questions: List[str]
    audio_url: Optional[str] = None


class LessonGenerateResponse(BaseModel):
    lesson_id: str
    topic: str
    grade: str
    tiers: List[LessonTier]
    created_at: str


class LessonAssignRequest(BaseModel):
    class_id: str
    due_date: Optional[str] = None  # ISO date string
    mode: str = Field("read-aloud", description="'read-aloud' | 'structured-prompts'")


class LessonSummary(BaseModel):
    lesson_id: str
    topic: str
    grade: str
    tiers: int
    created_at: str


class LessonUpdateRequest(BaseModel):
    content_json: dict


# ─── Practice ─────────────────────────────────────────────────────────────────

class SessionStartRequest(BaseModel):
    lesson_id: Optional[str] = None
    mode: str = Field(..., description="'read-aloud' | 'structured-prompts' | 'mock-interview'")
    accessibility_json: Optional[AccessibilityProfile] = Field(default_factory=AccessibilityProfile)


class SessionStartResponse(BaseModel):
    session_id: str
    started_at: str


class SpeechScores(BaseModel):
    fluency: float = Field(..., ge=0, le=10)
    grammar: float = Field(..., ge=0, le=10)
    confidence: float = Field(..., ge=0, le=10)
    pronunciation: float = Field(..., ge=0, le=10)


class WordMark(BaseModel):
    word: str
    issue: Optional[str] = None  # e.g. "mispronounced", "grammar"
    start_sec: Optional[float] = None
    end_sec: Optional[float] = None


class SpeechAnalyzeResponse(BaseModel):
    session_id: str
    transcript: str
    scores: SpeechScores
    feedback_text: str
    word_marks: List[WordMark] = []
    spoken_feedback_url: Optional[str] = None


class SessionEndRequest(BaseModel):
    session_id: str


# ─── Teacher Analytics ────────────────────────────────────────────────────────

class StudentProgress(BaseModel):
    student_id: str
    name: Optional[str]
    session_count: int
    avg_fluency: Optional[float]
    avg_grammar: Optional[float]
    avg_confidence: Optional[float]
    last_active: Optional[str]
    accessibility_modes_used: List[str] = []


class ClassInsights(BaseModel):
    class_id: Optional[str]
    total_sessions: int
    avg_fluency: Optional[float]
    avg_grammar: Optional[float]
    avg_confidence: Optional[float]
    common_errors: List[str] = []
    improvement_trend: Optional[str]  # "improving" | "stable" | "declining"
    accessibility_usage: Dict[str, int] = {}


# ─── Sign Language & AAC ──────────────────────────────────────────────────────

class VocabAssetsRequest(BaseModel):
    words: List[str]


class VocabAsset(BaseModel):
    word: str
    sign_url: Optional[str] = None
    caption: Optional[str] = None
    language: str = "ISL"  # ISL or ASL


class VocabAssetsResponse(BaseModel):
    assets: List[VocabAsset]


class SignToTextRequest(BaseModel):
    frames_b64: List[str]  # base64-encoded JPEG frames


class SignToTextResponse(BaseModel):
    text: Optional[str]
    confidence: Optional[str]  # "low" | "medium" | "high"
    note: str = "Experimental — validate in production context"


class AacSpeakRequest(BaseModel):
    text: str = Field(..., max_length=500)
    voice_id: Optional[str] = None


# ─── Events ───────────────────────────────────────────────────────────────────

class EventLogRequest(BaseModel):
    event_type: str  # e.g. "caption_toggle_on", "dyslexia_font_on"
    payload: Optional[Dict[str, Any]] = None
