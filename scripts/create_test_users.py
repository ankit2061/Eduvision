import requests

BASE_URL = "http://localhost:8000"

def register_user(name, email, role):
    response = requests.post(f"{BASE_URL}/auth/register", json={
        "name": name,
        "email": email,
        "password": "password",
        "role": role
    })
    print(f"[{role.upper()}] Register {email}: {response.status_code} - {response.text}")

# Register a completely fresh teacher and student
register_user("Test Teacher", "testteacher@example.com", "teacher")
register_user("Test Student", "teststudent@example.com", "student")
