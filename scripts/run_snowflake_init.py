#!/usr/bin/env python3
"""
Run the Snowflake init SQL script using credentials from .env
"""
import os, sys
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path, override=False)

import snowflake.connector

account   = os.environ["SNOWFLAKE_ACCOUNT"]
user      = os.environ["SNOWFLAKE_USER"]
password  = os.environ["SNOWFLAKE_PASSWORD"]
database  = os.environ["SNOWFLAKE_DATABASE"]
schema    = os.environ["SNOWFLAKE_SCHEMA"]
warehouse = os.environ["SNOWFLAKE_WAREHOUSE"]
role      = "SYSADMIN"

print(f"Connecting: {user}@{account}  role={role}")
conn = snowflake.connector.connect(
    account=account,
    user=user,
    password=password,
    warehouse=warehouse,
    role=role,
)
print(f"✅ Connected (role={conn.role})")

cur = conn.cursor()

setup = [
    f"USE ROLE {role}",
    f"USE WAREHOUSE {warehouse}",
    f"USE DATABASE {database}",
    f"CREATE SCHEMA IF NOT EXISTS {database}.{schema}",
    f"USE SCHEMA {database}.{schema}",
]
for stmt in setup:
    try:
        cur.execute(stmt)
        print(f"  ✅  {stmt}")
    except Exception as e:
        msg = str(e)
        if "already exists" in msg.lower():
            print(f"  ⏩  (already exists) {stmt}")
        else:
            print(f"  ❌  {stmt}\n      {msg}")
            sys.exit(1) # We must stop if schema setup fails

# Run the init SQL
sql_path = Path(__file__).parent.parent / "scripts" / "snowflake_init.sql"
raw_sql  = sql_path.read_text()

# Remove comments line by line first, then split on semicolon
cleaned_lines = []
for line in raw_sql.splitlines():
    if not line.strip().startswith("--"):
        cleaned_lines.append(line)

statements = []
for s in "\n".join(cleaned_lines).split(";"):
    s = s.strip()
    if not s:
        continue
    if s.upper().startswith("USE "):
        continue
    statements.append(s)

ok, errors = 0, []
for stmt in statements:
    first = stmt.splitlines()[0][:90]
    try:
        cur.execute(stmt)
        print(f"  ✅  {first}")
        ok += 1
    except Exception as e:
        msg = str(e)
        if "already exists" in msg.lower():
            print(f"  ⏩  (already exists) {first}")
            ok += 1
        else:
            print(f"  ❌  {first}\n      {msg}")
            errors.append(first)

cur.close()
conn.close()

print(f"\n{'─'*60}")
print(f"Result: {ok} OK, {len(errors)} errors")
if errors:
    sys.exit(1)
else:
    print("🎉 Snowflake schema is ready!")
