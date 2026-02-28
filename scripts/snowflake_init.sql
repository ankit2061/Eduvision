-- EduVoice Snowflake Schema Initialization
-- Run once against your EDUVISION database / PUBLIC schema

USE DATABASE EDUVISION;
USE SCHEMA PUBLIC;

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    user_id                  VARCHAR(128)  NOT NULL PRIMARY KEY,
    role                     VARCHAR(32)   NOT NULL DEFAULT 'student',
    school_id                VARCHAR(128),
    accessibility_profile_json VARIANT,
    created_at               TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── Lessons ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lessons (
    lesson_id   VARCHAR(128)  NOT NULL PRIMARY KEY,
    teacher_id  VARCHAR(128)  NOT NULL,
    topic       VARCHAR(512)  NOT NULL,
    grade       VARCHAR(16)   NOT NULL,
    tiers       NUMBER(2)     NOT NULL DEFAULT 3,
    content_json VARIANT,
    created_at  TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(user_id)
);

-- ─── Lesson Assets ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lesson_assets (
    lesson_id   VARCHAR(128)  NOT NULL,
    level       NUMBER(2)     NOT NULL,
    audio_url   VARCHAR(2048),
    pdf_url     VARCHAR(2048),
    checksum    VARCHAR(64),
    created_at  TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (lesson_id, level),
    FOREIGN KEY (lesson_id) REFERENCES lessons(lesson_id)
);

-- ─── Practice Sessions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS practice_sessions (
    session_id              VARCHAR(128)  NOT NULL PRIMARY KEY,
    student_id              VARCHAR(128)  NOT NULL,
    lesson_id               VARCHAR(128),
    mode                    VARCHAR(64)   NOT NULL,
    accessibility_mode_json VARIANT,
    started_at              TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP,
    ended_at                TIMESTAMP_NTZ,
    FOREIGN KEY (student_id) REFERENCES users(user_id),
    FOREIGN KEY (lesson_id)  REFERENCES lessons(lesson_id)
);

-- ─── Practice Artifacts ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS practice_artifacts (
    artifact_id     VARCHAR(128)   DEFAULT UUID_STRING() PRIMARY KEY,
    session_id      VARCHAR(128)   NOT NULL,
    audio_url       VARCHAR(2048),
    transcript_text TEXT,
    feedback_json   VARIANT,
    scores_json     VARIANT,
    created_at      TIMESTAMP_NTZ  DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES practice_sessions(session_id)
);

-- ─── Events ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
    event_id    VARCHAR(128)  DEFAULT UUID_STRING() PRIMARY KEY,
    user_id     VARCHAR(128)  NOT NULL,
    event_type  VARCHAR(128)  NOT NULL,
    payload_json VARIANT,
    ts          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ─── Indexes / Clustering ─────────────────────────────────────────────────────
ALTER TABLE lessons           CLUSTER BY (teacher_id, created_at);
ALTER TABLE practice_sessions CLUSTER BY (student_id, started_at);
ALTER TABLE events            CLUSTER BY (user_id, ts, event_type);

-- ─── Analytics Views ──────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_student_progress AS
SELECT
    ps.student_id,
    ps.lesson_id,
    l.topic,
    l.grade,
    ps.mode,
    ps.started_at,
    ps.ended_at,
    pa.scores_json:fluency::FLOAT     AS fluency,
    pa.scores_json:grammar::FLOAT     AS grammar,
    pa.scores_json:confidence::FLOAT  AS confidence,
    pa.scores_json:pronunciation::FLOAT AS pronunciation,
    pa.transcript_text,
    ps.accessibility_mode_json
FROM practice_sessions ps
LEFT JOIN practice_artifacts pa ON ps.session_id = pa.session_id
LEFT JOIN lessons l ON ps.lesson_id = l.lesson_id;

CREATE OR REPLACE VIEW v_accessibility_events AS
SELECT
    e.user_id,
    e.event_type,
    e.ts,
    u.role,
    u.school_id,
    e.payload_json
FROM events e
JOIN users u ON e.user_id = u.user_id
WHERE e.event_type LIKE '%_on' OR e.event_type LIKE '%_off';
