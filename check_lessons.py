import asyncio
from app.services.snowflake_db import execute

async def main():
    res = await execute("DESCRIBE TABLE lessons", fetch=True)
    for r in res: print(r[0])

if __name__ == "__main__":
    asyncio.run(main())
