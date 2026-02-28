"""
Local SQLite authentication service.
Handles user registration, login, password hashing, and JWT token generation.
Replaces Auth0 entirely — zero external dependencies.
"""

import sqlite3
import os
import uuid
from datetime import datetime, timedelta
from typing import Optional
import bcrypt
from jose import jwt, JWTError
from loguru import logger

# ─── Config ───────────────────────────────────────────────────────────────────

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "eduvision_auth.db")
SECRET_KEY = os.getenv("APP_SECRET_KEY", "eduvision-dev-secret-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# ─── DB Init ──────────────────────────────────────────────────────────────────

def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create users table if it doesn't exist."""
    conn = _get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS local_users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('teacher', 'student', 'admin')),
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    conn.commit()
    conn.close()
    logger.info(f"[LocalAuth] SQLite DB initialized at {os.path.abspath(DB_PATH)}")


# Run on import
init_db()

# ─── Password Helpers ─────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password=pwd_bytes, salt=salt)
    return hashed_password.decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    pwd_bytes = plain.encode('utf-8')
    hashed_bytes = hashed.encode('utf-8')
    try:
        return bcrypt.checkpw(password=pwd_bytes, hashed_password=hashed_bytes)
    except ValueError:
        return False


# ─── JWT Helpers ──────────────────────────────────────────────────────────────

def create_access_token(user_id: str, name: str, email: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": user_id,
        "name": name,
        "email": email,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """Decode and verify a JWT. Returns the payload dict or None."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        logger.warning(f"[LocalAuth] JWT decode failed: {e}")
        return None


# ─── User CRUD ────────────────────────────────────────────────────────────────

def register_user(name: str, email: str, password: str, role: str) -> dict:
    """Register a new user. Returns user dict or raises ValueError."""
    conn = _get_conn()
    
    # Check if email already exists
    existing = conn.execute("SELECT id FROM local_users WHERE email = ?", (email.lower(),)).fetchone()
    if existing:
        conn.close()
        raise ValueError("Email already registered")
    
    user_id = str(uuid.uuid4())
    hashed = hash_password(password)
    
    conn.execute(
        "INSERT INTO local_users (id, name, email, hashed_password, role) VALUES (?, ?, ?, ?, ?)",
        (user_id, name.strip(), email.lower().strip(), hashed, role),
    )
    conn.commit()
    conn.close()
    
    logger.info(f"[LocalAuth] Registered {role}: {name} ({email})")
    return {"user_id": user_id, "name": name.strip(), "email": email.lower().strip(), "role": role}


def login_user(email: str, password: str) -> Optional[dict]:
    """Authenticate a user. Returns user dict or None."""
    conn = _get_conn()
    row = conn.execute(
        "SELECT id, name, email, hashed_password, role FROM local_users WHERE email = ?",
        (email.lower().strip(),),
    ).fetchone()
    conn.close()
    
    if not row:
        return None
    
    if not verify_password(password, row["hashed_password"]):
        return None
    
    return {
        "user_id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "role": row["role"],
    }


def get_user_by_id(user_id: str) -> Optional[dict]:
    conn = _get_conn()
    row = conn.execute(
        "SELECT id, name, email, role FROM local_users WHERE id = ?", (user_id,)
    ).fetchone()
    conn.close()
    if not row:
        return None
    return {"user_id": row["id"], "name": row["name"], "email": row["email"], "role": row["role"]}
