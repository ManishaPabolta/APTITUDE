import numpy as np


def answer_is_correct(question: dict, answer) -> bool:
    expected = question["correct_answer"]
    if question["type"] == "multiple":
        return isinstance(answer, list) and set(answer) == set(expected)
    if question["type"] == "numerical":
        try:
            return bool(np.isclose(float(answer), float(expected), rtol=0, atol=0.01))
        except (TypeError, ValueError):
            return False
    return isinstance(answer, str) and answer.strip().casefold() == str(expected).strip().casefold()


def evaluate_exam(questions: list[dict], answer_map: dict, negative_marks: float) -> dict:
    score = 0.0
    correct_count = 0
    attempted_count = 0
    details = []
    for question in questions:
        response = answer_map.get(question["id"], {}).get("answer")
        attempted = response is not None and response != "" and response != []
        is_correct = attempted and answer_is_correct(question, response)
        if attempted:
            attempted_count += 1
        if is_correct:
            correct_count += 1
            earned = float(question["marks"])
            score += earned
        elif attempted:
            earned = -float(negative_marks)
            score += earned
        else:
            earned = 0.0
        details.append({
            "question_id": question["id"],
            "question_text": question["text"],
            "question_type": question["type"],
            "answer": response,
            "correct_answer": question["correct_answer"],
            "is_correct": bool(is_correct),
            "marks": earned,
            "explanation": question.get("explanation", ""),
        })
    total_marks = sum(float(question["marks"]) for question in questions)
    score = max(0.0, score)
    return {
        "score": round(score, 2),
        "total_marks": round(total_marks, 2),
        "percentage": round((score / total_marks * 100) if total_marks else 0, 2),
        "correct_count": correct_count,
        "attempted_count": attempted_count,
        "answers": details,
    }
