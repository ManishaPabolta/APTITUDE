from app.routes.reports import _student_can_access_leaderboard


def test_student_leaderboard_scope_matches_exam_assignment():
    student = {"_id": "student-1", "batch": "batch-a"}
    assert _student_can_access_leaderboard({"student_ids": [], "batch": None}, student)
    assert _student_can_access_leaderboard({"student_ids": ["student-1"]}, student)
    assert _student_can_access_leaderboard({"student_ids": [], "batch": "batch-a"}, student)
    assert not _student_can_access_leaderboard({"student_ids": ["student-2"]}, student)
    assert not _student_can_access_leaderboard({"student_ids": [], "batch": "batch-b"}, student)
