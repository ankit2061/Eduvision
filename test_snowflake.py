import asyncio
from app.services.snowflake_db import execute

async def main():
    rows = await execute("SELECT user_id, name, email FROM users", fetch=True)
    print(rows)

if __name__ == "__main__":
    asyncio.run(main())
