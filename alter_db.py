import asyncio
from app.services.snowflake_db import execute

async def main():
    try:
        await execute("ALTER TABLE assignments ADD COLUMN student_response TEXT")
        print("Added student_response")
    except Exception as e:
        print(f"Already added or error: {e}")
        
    try:
        await execute("ALTER TABLE assignments ADD COLUMN raw_score FLOAT")
        print("Added raw_score")
    except Exception as e:
        print(f"Already added or error: {e}")

asyncio.run(main())
