import asyncio
from loguru import logger
from app.services.snowflake_db import execute

async def migrate_users():
    logger.info("Starting schema migration for users table...")
    
    queries = [
        "ALTER TABLE users ADD COLUMN sub_role VARCHAR;",
        "ALTER TABLE users ADD COLUMN disability_type VARCHAR;",
        "ALTER TABLE users ADD COLUMN learning_style VARCHAR;",
        "ALTER TABLE users ADD COLUMN onboarding_complete BOOLEAN DEFAULT FALSE;"
    ]
    
    for q in queries:
        try:
            await execute(q)
            logger.info(f"Executed: {q}")
        except Exception as e:
            logger.warning(f"Failed to execute ({q}): {e}")
            
    logger.info("Migration complete.")

if __name__ == "__main__":
    asyncio.run(migrate_users())
