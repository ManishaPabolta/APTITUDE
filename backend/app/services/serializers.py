from datetime import datetime, timezone


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def public_user(user: dict) -> dict:
    return {
        "id": user["_id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "batch": user.get("batch"),
        "course": user.get("course"),
        "active": user.get("active", True),
        "created_at": user.get("created_at"),
    }


def public_test(test: dict) -> dict:
    pool_marks = sum(q["marks"] for q in test.get("questions", []))
    count = test.get("questions_per_attempt")
    attempt_marks = round(pool_marks * count / len(test["questions"]), 2) if count and test.get("questions") else pool_marks
    return {
        "id": test["_id"],
        "title": test["title"],
        "description": test.get("description", ""),
        "instructions": test.get("instructions", ""),
        "duration_minutes": test["duration_minutes"],
        "section_time_limits": test.get("section_time_limits", {}),
        "questions_per_attempt": test.get("questions_per_attempt"),
        "randomize_questions": test.get("randomize_questions", True),
        "randomize_options": test.get("randomize_options", True),
        "negative_marks": test["negative_marks"],
        "passing_percentage": test["passing_percentage"],
        "allowed_attempts": test.get("allowed_attempts", 1),
        "result_visibility": test.get("result_visibility", "immediate"),
        "show_explanations": test.get("show_explanations", True),
        "violation_limit": test.get("violation_limit", 1),
        "immediate_submit_events": test.get(
            "immediate_submit_events",
            ["tab_switch", "visibility_change", "fullscreen_exit", "window_blur"],
        ),
        "has_access_code": bool(test.get("access_code_hash")),
        "scheduled_at": test.get("scheduled_at"),
        "closes_at": test.get("closes_at"),
        "student_ids": test.get("student_ids", []),
        "batch": test.get("batch"),
        "published": test.get("published", False),
        "question_count": len(test.get("questions", [])),
        "total_marks": pool_marks,
        "total_marks_per_attempt": attempt_marks,
        "created_at": test.get("created_at"),
    }


def public_question(question: dict, index: int) -> dict:
    return {
        "id": question["id"],
        "index": index,
        "text": question["text"],
        "type": question["type"],
        "category": question.get("category", "Quantitative Aptitude"),
        "section": question.get("section", "General"),
        "topic": question.get("topic", ""),
        "tags": question.get("tags", []),
        "difficulty": question.get("difficulty", "intermediate"),
        "image_url": question.get("image_url"),
        "math_expression": question.get("math_expression", ""),
        "options": question.get("options", []),
        "marks": question["marks"],
    }
