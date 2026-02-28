import asyncio
from app.services.snowflake_db import execute, get_user

async def main():
    rows = await execute("SELECT user_id, name, email FROM users", fetch=True)
    print("ROWS:", rows)

if __name__ == "__main__":
    asyncio.run(main())
