import asyncio
import json
from types import SimpleNamespace

from app.ai import groq_client
from app.schemas.examination import AIQuestionRequest


def test_ai_question_prompt_preserves_admin_topic_and_custom_scope():
    request = AIQuestionRequest(
        category="Quantitative Aptitude",
        difficulty="advanced",
        count=3,
        topic="Compound interest",
        subtopic="Changing rates",
        company_exam="Campus aptitude screening",
        custom_prompt="Use annual compounding and avoid logarithms.",
    )

    prompt = groq_client.question_prompt(request)

    assert 'Topic (content constraint, JSON string): "Compound interest"' in prompt
    assert 'Subtopic (content constraint, JSON string): "Changing rates"' in prompt
    assert "Campus aptitude screening" in prompt
    assert json.dumps(request.custom_prompt) in prompt
    assert "exactly four distinct plausible options" in prompt
    assert '"correct_answer":"Option A"' in prompt
    assert "must be non-empty" in prompt


def test_ai_generation_batches_large_requests_and_returns_unique_mcqs(monkeypatch):
    calls = []

    class FakeGroq:
        def __init__(self, **_kwargs):
            self.chat = SimpleNamespace(completions=SimpleNamespace(create=self.create))

        async def create(self, **kwargs):
            prompt = kwargs["messages"][1]["content"]
            count = int(prompt.split("Create exactly ", 1)[1].split(" ", 1)[0])
            calls.append(count)
            questions = []
            start = sum(calls[:-1])
            for index in range(start, start + count):
                options = [f"Answer {index}", f"Wrong {index} B", f"Wrong {index} C", f"Wrong {index} D"]
                questions.append({
                    "text": f"Prompt-specific question {index}",
                    "type": "single",
                    "options": options,
                    "correct_answer": options[0],
                    "explanation": f"Answer {index} follows from the stated calculation.",
                })
            response = SimpleNamespace(
                choices=[SimpleNamespace(
                    message=SimpleNamespace(content=json.dumps({"questions": questions})),
                    finish_reason="stop",
                )],
            )
            return response

        async def close(self):
            return None

    monkeypatch.setattr(groq_client.settings, "groq_api_key", "test-key")
    monkeypatch.setattr(groq_client, "AsyncGroq", FakeGroq)
    request = AIQuestionRequest(
        category="Quantitative Aptitude",
        difficulty="intermediate",
        count=11,
        topic="Ratios",
        custom_prompt="Keep each question focused on ratios.",
    )

    questions = asyncio.run(groq_client.generate_questions(request))

    assert calls == [5, 5, 1]
    assert len(questions) == 11
    assert len({question.text for question in questions}) == 11
    assert all(len(question.options) == 4 for question in questions)
    assert all(isinstance(question.correct_answer, str) for question in questions)
    assert all(question.correct_answer in question.options for question in questions)
    assert all(question.explanation for question in questions)


def test_ai_generation_splits_and_recovers_incomplete_batch(monkeypatch):
    calls = []
    next_question = 0

    class FakeGroq:
        def __init__(self, **_kwargs):
            self.chat = SimpleNamespace(completions=SimpleNamespace(create=self.create))

        async def create(self, **kwargs):
            nonlocal next_question
            prompt = kwargs["messages"][1]["content"]
            count = int(prompt.split("Create exactly ", 1)[1].split(" ", 1)[0])
            calls.append(count)
            questions = []
            for _ in range(count):
                index = next_question
                next_question += 1
                options = [f"Answer {index}", f"Wrong {index} B", f"Wrong {index} C", f"Wrong {index} D"]
                questions.append({
                    "text": f"Unique question {index}",
                    "type": "single",
                    "options": options,
                    "correct_answer": options[0],
                    "explanation": f"Explanation for answer {index}.",
                })
            if len(calls) == 1:
                questions = questions[:2]
            return SimpleNamespace(
                choices=[SimpleNamespace(
                    message=SimpleNamespace(content=json.dumps({"questions": questions})),
                    finish_reason="stop",
                )],
            )

        async def close(self):
            return None

    monkeypatch.setattr(groq_client.settings, "groq_api_key", "test-key")
    monkeypatch.setattr(groq_client, "AsyncGroq", FakeGroq)
    request = AIQuestionRequest(
        category="Logical Reasoning",
        difficulty="beginner",
        count=9,
        topic="Number patterns",
    )

    questions = asyncio.run(groq_client.generate_questions(request))

    assert calls == [5, 2, 3, 4]
    assert len(questions) == 9
    assert len({question.text for question in questions}) == 9
    assert all(question.explanation for question in questions)


def test_ai_generation_retries_duplicate_across_batches(monkeypatch):
    calls = []

    class FakeGroq:
        def __init__(self, **_kwargs):
            self.chat = SimpleNamespace(completions=SimpleNamespace(create=self.create))

        async def create(self, **kwargs):
            prompt = kwargs["messages"][1]["content"]
            count = int(prompt.split("Create exactly ", 1)[1].split(" ", 1)[0])
            calls.append(count)
            if len(calls) == 1:
                indexes = range(5)
            elif len(calls) == 2:
                indexes = [0]
            else:
                assert "Question 0" in prompt
                indexes = [5]
            questions = []
            for index in indexes:
                options = [f"Answer {index}", f"Wrong {index} B", f"Wrong {index} C", f"Wrong {index} D"]
                questions.append({
                    "text": f"Question {index}",
                    "type": "single",
                    "options": options,
                    "correct_answer": options[0],
                    "explanation": f"Explanation for question {index}.",
                })
            assert len(questions) == count
            return SimpleNamespace(
                choices=[SimpleNamespace(
                    message=SimpleNamespace(content=json.dumps({"questions": questions})),
                    finish_reason="stop",
                )],
            )

        async def close(self):
            return None

    monkeypatch.setattr(groq_client.settings, "groq_api_key", "test-key")
    monkeypatch.setattr(groq_client, "AsyncGroq", FakeGroq)
    request = AIQuestionRequest(
        category="Logical Reasoning",
        difficulty="intermediate",
        count=6,
        topic="Number patterns",
    )

    questions = asyncio.run(groq_client.generate_questions(request))

    assert calls == [5, 1, 1]
    assert len(questions) == 6
    assert len({question.text for question in questions}) == 6
