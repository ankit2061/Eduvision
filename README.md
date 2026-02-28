# EduVoice Backend API

> FastAPI backend for the EduVoice two-pillar EdTech platform — AI-powered differentiated lesson generation for teachers, and an accessibility-first voice coaching system for students.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | FastAPI + Uvicorn |
| AI/LLM | Gemini 2.0 Flash via OpenRouter |
| TTS / Voice | ElevenLabs Multilingual v2 |
| Data | Snowflake (structured + unstructured) |
| Auth | Auth0 (JWT RS256) |
| Storage | DigitalOcean Spaces (S3-compatible audio) |
| Deployment | Dockerised — DigitalOcean App Platform |

---

## Project Structure

```
app/
├── main.py              # FastAPI app, CORS, router mounts
├── config.py            # Pydantic Settings from .env
├── dependencies.py      # Auth0 JWT → CurrentUser dependency
├── models/schemas.py    # All Pydantic request/response models
├── routers/
│   ├── auth.py          # GET /auth/me
│   ├── lesson.py        # /lesson/* (generate, library, assign)
│   ├── practice.py      # /practice/* (session, speech-analyze)
│   ├── teacher.py       # /teacher/* (insights, students)
│   ├── sign.py          # /sign/* + /aac/speak
│   └── events.py        # POST /events
├── services/
│   ├── gemini.py        # OpenRouter → Gemini client
│   ├── elevenlabs.py    # ElevenLabs TTS client
│   ├── snowflake_db.py  # Snowflake CRUD helpers
│   └── storage.py       # DO Spaces uploader
├── utils/
│   ├── prompts.py       # Prompt templates + accessibility addendums
│   └── audio.py         # Audio MIME detection + temp file utils
└── data/
    └── sign_assets.json # Starter ISL/ASL vocab → GIF URL mapping
scripts/
└── snowflake_init.sql   # DDL for all 6 tables + 2 analytics views
tests/
├── test_auth.py
├── test_lesson.py
└── test_practice.py
```

---

## Quick Start

### 1. Clone and set up environment

```bash
git clone <your-repo>
cd Eduvision
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your real API keys
```

### 3. Initialize Snowflake schema

Run `scripts/snowflake_init.sql` against your Snowflake EDUVISION database:

```bash
snowsql -a <account> -u <user> -f scripts/snowflake_init.sql
```

### 4. Run locally

```bash
uvicorn app.main:app --reload --port 8000
```

Visit **http://localhost:8000/docs** for the interactive Swagger UI.

---

## API Overview

### Auth
| Method | Path | Auth | Role |
|--------|------|------|------|
| GET | `/auth/me` | ✅ | Any |

### Lesson (Teacher Tool)
| Method | Path | Auth | Role |
|--------|------|------|------|
| POST | `/lesson/generate` | ✅ | teacher/admin |
| GET | `/lesson/library` | ✅ | teacher/admin |
| GET | `/lesson/{id}` | ✅ | Any |
| GET | `/lesson/{id}/audio/{level}` | ✅ | Any |
| POST | `/lesson/{id}/assign` | ✅ | teacher/admin |

### Practice (Student Voice Coach)
| Method | Path | Auth | Role |
|--------|------|------|------|
| POST | `/practice/session/start` | ✅ | student/admin |
| POST | `/practice/speech-analyze` | ✅ | student/admin |
| GET | `/practice/session/{id}` | ✅ | Any |
| POST | `/practice/session/{id}/end` | ✅ | student/admin |

### Teacher Analytics
| Method | Path | Auth | Role |
|--------|------|------|------|
| GET | `/teacher/class/insights` | ✅ | teacher/admin |
| GET | `/teacher/class/{id}/students` | ✅ | teacher/admin |

### Sign Language & AAC
| Method | Path | Auth | Role |
|--------|------|------|------|
| POST | `/sign/vocab-assets` | ✅ | Any |
| POST | `/sign/to-text` | ✅ | Any (stretch) |
| POST | `/aac/speak` | ✅ | Any |

### Events
| Method | Path | Auth | Role |
|--------|------|------|------|
| POST | `/events/` | ✅ | Any |

---

## Accessibility Features

The backend instruments **all AI prompts** with accessibility context from the student's profile:

| Mode | Behavior |
|------|----------|
| `stammer_friendly` | Ignores pauses/repetitions in fluency scoring; avoids mentioning stutter in feedback |
| `captions_always_on` | Returns extra-detailed visual rubric; skips spoken feedback audio generation |
| `sensory_friendly` | Calm voice settings for TTS; short, supportive feedback text |
| `aac_mode` | `/aac/speak` endpoint provides classroom voice output from phrase grids |

All accessibility toggle events are logged to the `events` Snowflake table for **impact tracking** (e.g., "captions_on improved comprehension score by X%").

---

## Auth0 Setup

1. Create an API in Auth0 with audience `https://eduvision-api`
2. Add a **Login Action** to inject user role into the token:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const role = event.user.app_metadata?.role || 'student';
  api.idToken.setCustomClaim('https://eduvision/role', role);
  api.accessToken.setCustomClaim('https://eduvision/role', role);
};
```

---

## Tests

```bash
pytest tests/ -v
```

---

## Docker / DigitalOcean Deployment

```bash
docker build -t eduvision-backend .
docker run -p 8000:8000 --env-file .env eduvision-backend
```

For DigitalOcean App Platform:
1. Push to GitHub
2. Create App → select repo → set env vars
3. Deploy — health check at `/health`
