"""
EduVoice FastAPI Application Entry Point
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger

from app.config import get_settings
from app.routers import auth, lesson, practice, teacher, sign, events, admin, test

settings = get_settings()

app = FastAPI(
    title="EduVoice API",
    description=(
        "Two-pillar EdTech platform: AI-powered differentiated lesson generation "
        "for teachers + voice coaching with accessibility support for students."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(lesson.router)
app.include_router(practice.router)
app.include_router(teacher.router)
app.include_router(sign.router)
app.include_router(events.router)
app.include_router(admin.router)
app.include_router(test.router, prefix="/test", tags=["Tests"])

# ─── Global Error Handler ─────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.url}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again."},
    )

# ─── Health ───────────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health():
    """Health check for DigitalOcean and load balancer probes."""
    return {"status": "ok", "service": "eduvision-backend", "version": "1.0.0"}


@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Welcome to EduVoice API",
        "docs": "/docs",
        "health": "/health",
    }
