import asyncio
from app.services.snowflake_db import execute

async def main():
    res = await execute("DESC TABLE assignments", fetch=True)
    for r in res:
        print(r[0])

asyncio.run(main())
