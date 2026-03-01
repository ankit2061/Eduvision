import asyncio
from app.services.snowflake_db import execute

async def main():
    sql = """
    CREATE TABLE IF NOT EXISTS tests (
        test_id VARCHAR PRIMARY KEY,
        teacher_id VARCHAR,
        title VARCHAR,
        topic VARCHAR,
        grade VARCHAR,
        time_limit INT,
        questions VARIANT,
        created_at TIMESTAMP_TZ DEFAULT CURRENT_TIMESTAMP
    );
    """
    await execute(sql)
    print("Tests table created.")

if __name__ == "__main__":
    asyncio.run(main())
