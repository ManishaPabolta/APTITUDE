import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.schemas.examination import AIQuestionRequest, AIDraftApproval, QuestionInput, TestInput as ExaminationSchema
from app.schemas.auth import UserCreate
from app.middleware.role_guard import ensure_user_management_access, role_has_access


def test_ai_question_request_constrains_generation_settings():
    request = AIQuestionRequest(
        category="Number Series",
        difficulty="advanced",
        count=149,
        marks=2,
    )
    assert request.count == 149
    with pytest.raises(ValidationError):
        AIQuestionRequest(category="Number Series", difficulty="advanced", count=150)


def test_ai_approval_requires_four_option_single_answer_mcqs_with_explanations():
    payload = {
        "text": "Which number is prime?",
        "type": "single",
        "category": "Quantitative Aptitude",
        "difficulty": "beginner",
        "options": ["2", "4", "6", "8"],
        "correct_answer": "2",
        "marks": 1,
        "explanation": "2 has exactly two positive divisors, while the other listed numbers are composite.",
    }
    approved = AIDraftApproval(questions=[payload])
    assert len(approved.questions[0].options) == 4
    with pytest.raises(ValidationError):
        AIDraftApproval(questions=[{**payload, "type": "multiple", "correct_answer": ["2", "4"]}])
    with pytest.raises(ValidationError, match="at least four options"):
        AIDraftApproval(questions=[{**payload, "options": ["2", "4", "6"]}])
    with pytest.raises(ValidationError, match="explanation"):
        AIDraftApproval(questions=[{**payload, "explanation": ""}])
    with pytest.raises(ValidationError):
        AIQuestionRequest(
            category="Number Series",
            difficulty="advanced",
            count=5,
            question_format="numerical",
        )


def test_exam_question_count_must_fit_question_pool():
    question = QuestionInput(text="A question", correct_answer="2.5", type="numerical")
    with pytest.raises(ValidationError):
        ExaminationSchema(
            title="Practice test",
            duration_minutes=10,
            questions_per_attempt=2,
            questions=[question],
        )


def test_exam_question_limit_is_149():
    questions = [
        QuestionInput(text=f"Question {index}", type="numerical", correct_answer=str(index))
        for index in range(149)
    ]
    base = {"title": "Practice test", "duration_minutes": 10}
    assert len(ExaminationSchema(**base, questions=questions).questions) == 149
    with pytest.raises(ValidationError, match="149 questions"):
        ExaminationSchema(**base, questions=[*questions, QuestionInput(
            text="Question 149", type="numerical", correct_answer="149"
        )])


def test_exam_question_text_must_be_unique_after_normalization():
    with pytest.raises(ValidationError, match="duplicate question text"):
        ExaminationSchema(
            title="Practice test",
            duration_minutes=10,
            questions=[
                QuestionInput(text="What is 2 + 2?", type="numerical", correct_answer="4"),
                QuestionInput(text="  WHAT   IS 2 + 2? ", type="numerical", correct_answer="4"),
            ],
        )


def test_timed_exam_sections_match_question_sections_and_fit_duration():
    questions = [
        QuestionInput(text="Quant question", section="Quant", type="numerical", correct_answer="5"),
        QuestionInput(text="Reasoning question", section="Reasoning", type="numerical", correct_answer="7"),
    ]
    exam = ExaminationSchema(
        title="Sectioned exam",
        duration_minutes=30,
        section_time_limits={" Quant ": 10, "Reasoning": 15},
        questions=questions,
    )
    assert exam.section_time_limits == {"Quant": 10, "Reasoning": 15}
    with pytest.raises(ValidationError, match="match every section"):
        ExaminationSchema(
            title="Sectioned exam",
            duration_minutes=30,
            section_time_limits={"Quant": 10},
            questions=questions,
        )
    with pytest.raises(ValidationError, match="sum of section"):
        ExaminationSchema(
            title="Sectioned exam",
            duration_minutes=20,
            section_time_limits={"Quant": 10, "Reasoning": 15},
            questions=questions,
        )


def test_question_image_url_must_be_secure_or_platform_media():
    question = QuestionInput(
        text="Question with diagram",
        type="numerical",
        correct_answer="4",
        image_url="/api/media/12345678-1234-1234-1234-123456789abc",
    )
    assert question.image_url.startswith("/api/media/")
    with pytest.raises(ValidationError, match="HTTPS"):
        QuestionInput(
            text="Insecure image",
            type="numerical",
            correct_answer="4",
            image_url="http://example.com/image.png",
        )


def test_only_superadmin_can_manage_non_student_accounts():
    ensure_user_management_access("admin", "student")
    ensure_user_management_access("superadmin", "student")
    ensure_user_management_access("superadmin", "teacher")
    with pytest.raises(HTTPException) as error:
        ensure_user_management_access("admin", "teacher")
    assert error.value.status_code == 403
    with pytest.raises(HTTPException) as error:
        ensure_user_management_access("admin", "admin")
    assert error.value.status_code == 403


def test_superadmin_has_admin_permissions_but_admin_cannot_manage_superadmin():
    assert role_has_access("superadmin", ("admin",))
    assert role_has_access("superadmin", ("admin", "teacher"))
    assert role_has_access("admin", ("admin",))
    assert not role_has_access("admin", ("superadmin",))
    assert not role_has_access("student", ("admin",))
    assert role_has_access("question_manager", ("question_manager",))
    assert not role_has_access("question_manager", ("exam_manager",))
    assert role_has_access("exam_manager", ("exam_manager",))
    assert not role_has_access("exam_manager", ("question_manager",))
    with pytest.raises(ValidationError):
        UserCreate(name="Owner Account", email="owner@example.com", password="StrongPass123!", role="superadmin")
