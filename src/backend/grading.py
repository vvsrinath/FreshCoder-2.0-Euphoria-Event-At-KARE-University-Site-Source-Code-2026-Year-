"""Server-side grading. A score is never accepted from the client."""
import json
import re


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower()).rstrip(";")


def _normalize_code(value: str) -> str:
    return re.sub(r"\s+", "", (value or "").strip().lower())


def grade_answer(question, given: str):
    """Return (correct, awarded). correct is None for manually evaluated types."""
    value = (given or "").strip()
    marks = question["marks"]
    if not value:
        return False, 0

    qtype = question["type"]
    alternatives = []
    if question["alternatives"]:
        try:
            alternatives = json.loads(question["alternatives"])
        except ValueError:
            alternatives = []
    accepted = [question["answer"] or ""] + alternatives

    if qtype in ("MCQ", "TRUE_FALSE"):
        correct = _normalize(value) == _normalize(question["answer"] or "")
    elif qtype in ("FILL_BLANK", "OUTPUT"):
        correct = any(_normalize(a) == _normalize(value) for a in accepted)
    elif qtype in ("CODE_COMPLETION", "DEBUGGING"):
        correct = any(_normalize_code(a) == _normalize_code(value) for a in accepted)
    else:
        # CODING: stored for sandboxed or manual evaluation.
        # Student code is NEVER executed inside this process.
        return None, 0

    return correct, (marks if correct else 0)
