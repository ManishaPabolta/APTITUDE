import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from app.database import close_database, connect_database, get_database
from app.security import hash_password


async def seed() -> None:
    await connect_database()
    db = get_database()
    now = datetime.now(timezone.utc)
    students = [
        ("Aarav Mehta", "aarav@example.com", "Student123!"),
        ("Maya Shah", "maya@example.com", "Student123!"),
        ("Ishaan Rao", "ishaan@example.com", "Student123!"),
    ]
    for name, email, password in students:
        await db.users.update_one(
            {"email": email},
            {"$setOnInsert": {
                "_id": str(uuid.uuid4()), "name": name, "email": email,
                "password_hash": hash_password(password), "role": "student",
                "batch": "Cohort 2026", "course": "Aptitude Foundations",
                "active": True, "created_at": now,
            }},
            upsert=True,
        )
    existing = await db.tests.find_one({"title": "Aptitude Foundations · Practice 01"})
    if not existing:
        questions = [
            {"text": "A train travels 180 km in 3 hours. What is its average speed?", "type": "numerical", "options": [], "correct_answer": "60", "marks": 2, "explanation": "Average speed is distance divided by time: 180 ÷ 3 = 60 km/h."},
            {"text": "Which number completes the sequence: 3, 6, 12, 24, …?", "type": "single", "options": ["36", "42", "48", "54"], "correct_answer": "48", "marks": 2, "explanation": "Each term is twice the previous term, so 24 × 2 = 48."},
            {"text": "Which of these are prime numbers?", "type": "multiple", "options": ["11", "15", "17", "21"], "correct_answer": ["11", "17"], "marks": 3, "explanation": "11 and 17 have no positive divisors other than 1 and themselves."},
            {"text": "If all roses are flowers and some flowers fade quickly, which statement is necessarily true?", "type": "reasoning", "options": ["All roses fade quickly", "Some roses fade quickly", "All roses are flowers", "No flowers are roses"], "correct_answer": "All roses are flowers", "marks": 3, "explanation": "This restates the first premise; the other options cannot be concluded."},
        ]
        await db.tests.insert_one({
            "_id": str(uuid.uuid4()), "title": "Aptitude Foundations · Practice 01",
            "description": "A short mixed-format practice test covering speed, number patterns and reasoning.",
            "duration_minutes": 20, "negative_marks": 0.25, "passing_percentage": 50,
            "scheduled_at": None, "closes_at": None, "student_ids": [],
            "batch": "Cohort 2026", "published": True,
            "questions": [{**question, "id": str(uuid.uuid4())} for question in questions],
            "created_at": now, "updated_at": now,
        })
    print("Sample users and the practice examination are ready.")
    print("Demo student login: aarav@example.com / Student123!")
    await close_database()


if __name__ == "__main__":
    asyncio.run(seed())
