from app.services.evaluation import evaluate_exam


def test_evaluate_exam_scores_correct_wrong_and_unanswered():
    questions = [
        {"id": "q1", "text": "Single", "type": "single", "correct_answer": "A", "marks": 2},
        {"id": "q2", "text": "Numeric", "type": "numerical", "correct_answer": "3.14", "marks": 3},
        {"id": "q3", "text": "Skipped", "type": "single", "correct_answer": "C", "marks": 1},
    ]
    report = evaluate_exam(
        questions,
        {"q1": {"answer": "wrong"}, "q2": {"answer": "3.145"}},
        negative_marks=0.5,
    )
    assert report["score"] == 2.5
    assert report["total_marks"] == 6
    assert report["correct_count"] == 1
    assert report["attempted_count"] == 2
    assert report["answers"][2]["marks"] == 0


def test_multiple_answers_require_exact_set():
    question = {"id": "q1", "text": "Choose", "type": "multiple", "correct_answer": ["A", "B"], "marks": 2}
    exact = evaluate_exam([question], {"q1": {"answer": ["A", "B"]}}, 0)
    partial = evaluate_exam([question], {"q1": {"answer": ["A"]}}, 0)
    assert exact["score"] == 2
    assert partial["score"] == 0
    assert partial["answers"][0]["is_correct"] is False
