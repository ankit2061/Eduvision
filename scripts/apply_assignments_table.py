"""
One-off script to create the assignments table in Snowflake without re-running the full init.
"""

import asyncio
import logging
from app.services.snowflake_db import execute

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def main():
    logger.info("Connecting to Snowflake to create assignments table...")
    sql = """
    CREATE TABLE IF NOT EXISTS assignments (
        assignment_id VARCHAR(128)  NOT NULL PRIMARY KEY,
        lesson_id     VARCHAR(128)  NOT NULL,
        teacher_id    VARCHAR(128)  NOT NULL,
        assigned_to   VARCHAR(128)  NOT NULL,
        due_date      VARCHAR(64),
        status        VARCHAR(32)   NOT NULL DEFAULT 'pending',
        created_at    TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lesson_id) REFERENCES lessons(lesson_id),
        FOREIGN KEY (teacher_id) REFERENCES users(user_id)
    );
    """
    await execute(sql)
    logger.info("Successfully created assignments table.")

if __name__ == "__main__":
    asyncio.run(main())
