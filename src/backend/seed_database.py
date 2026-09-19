"""Development / demo seed data.

Run:  python seed_database.py
Passwords come from the environment so production credentials are never
committed. Everything inserted here is DEMO data for development and testing.
"""
import json
import os
from datetime import datetime, timezone

from app import create_app
from auth import hash_password
from database import execute, query_one

NOW = datetime.now(timezone.utc).isoformat()

ADMIN_PASSWORD = os.environ.get("SEED_ADMIN_PASSWORD", "admin@2026")
STAFF_PASSWORD = os.environ.get("SEED_STAFF_PASSWORD", "staff@2026")
STUDENT_PASSWORD = os.environ.get("SEED_STUDENT_PASSWORD", "student@2026")

USERS = [
    ("DEV001", "DEVELOPER", "Platform Developer", "dev@klu.ac.in", os.environ.get("SEED_DEV_PASSWORD", "dev@2026")),
    ("ADMIN001", "SUPER_ADMIN", "Dr. R. Sundaram", "admin001@klu.ac.in", ADMIN_PASSWORD),
    ("STAFF001", "STAFF", "Prof. K. Meenakshi", "staff001@klu.ac.in", STAFF_PASSWORD),
    ("STAFF002", "STAFF", "Prof. A. Vignesh", "staff002@klu.ac.in", STAFF_PASSWORD),
    ("ST2026001", "STUDENT", "Arun Kumar", "st2026001@klu.ac.in", STUDENT_PASSWORD),
    ("ST2026002", "STUDENT", "Divya Lakshmi", "st2026002@klu.ac.in", STUDENT_PASSWORD),
    ("ST2026003", "STUDENT", "Mohammed Irfan", "st2026003@klu.ac.in", STUDENT_PASSWORD),
    ("ST2026004", "STUDENT", "Priya Ranjani", "st2026004@klu.ac.in", STUDENT_PASSWORD),
    ("ST2026005", "STUDENT", "Karthik Raja", "st2026005@klu.ac.in", STUDENT_PASSWORD),
]

EVENT = (
    "EV2026",
    "Euphoria 2026",
    "A Techno Management Meet hosted by the Department of Freshman Engineering.",
    "Department of Freshman Engineering",
    "2026-09-26",
    "2026-09-26",
    "11th Block, Room No. 11506 & 11507",
    "ACTIVE",
    "euphoria.kalasalingam.ac.in",
    "₹200",
    "₹15,000",
)

TESTS = [
    ("T1001", "Python Fundamentals", "Mixed Python assessment.", "MIXED", 30, 60, "DISTRIBUTION",
     {"MCQ": 10, "FILL_BLANK": 5, "OUTPUT": 5, "CODE_COMPLETION": 5, "DEBUGGING": 5},
     "2026-09-26T09:30:00", "SCHEDULED"),
    ("T1002", "Debugging Challenge", "Find and fix defects.", "DEBUGGING", 20, 45, "RANDOM", {}, None, "DRAFT"),
    ("T1003", "Fill in the Blanks", "Rapid-fire syntax completion.", "FILL_BLANK", 25, 30, "RANDOM", {}, None, "DRAFT"),
    ("T1004", "Coding Challenge", "Five programming problems.", "CODING", 5, 90, "RANDOM", {}, None, "DRAFT"),
    ("T1005", "Output Prediction", "Predict program output.", "OUTPUT", 20, 40, "RANDOM", {}, None, "DRAFT"),
]

QUESTIONS = [
    ("Q001", "Python Input Function", "MCQ", "Basics", "EASY", 1,
     "Which built-in function reads a line of text from the user in Python 3?", None,
     ["scan()", "input()", "read()", "gets()"], "1", [], "input() reads from stdin."),
    ("Q002", "Immutable Data Type", "MCQ", "Data Types", "EASY", 1,
     "Which of the following Python data types is immutable?", None,
     ["list", "dict", "set", "tuple"], "3", [], "Tuples cannot be modified."),
    ("Q003", "Integer Division Operator", "MCQ", "Operators", "EASY", 1,
     "Which operator performs floor division?", None, ["/", "//", "%", "**"], "1", [], None),
    ("Q004", "Python Is Case Sensitive", "TRUE_FALSE", "Basics", "EASY", 1,
     "Python identifiers are case sensitive.", None, None, "true", [], None),
    ("Q005", "Read User Input", "FILL_BLANK", "Basics", "EASY", 1,
     "Complete the code to take input and store it in name.",
     'name = __________("Enter your name: ")', None, "input", ["input()"], None),
    ("Q006", "Length of a List", "FILL_BLANK", "Lists", "EASY", 1,
     "Print the number of items in the list.", "items = [4, 8, 15, 16]\nprint(__________(items))",
     None, "len", ["len()"], None),
    ("Q007", "List Slicing Output", "OUTPUT", "Lists", "MEDIUM", 1,
     "What is the exact output?", "nums = [1, 2, 3, 4, 5]\nprint(nums[1:4])", None, "[2, 3, 4]", [], None),
    ("Q008", "String Repetition Output", "OUTPUT", "Strings", "EASY", 1,
     "What is the exact output?", 'print("ab" * 3)', None, "ababab", [], None),
    ("Q009", "Complete the Sum Function", "CODE_COMPLETION", "Functions", "MEDIUM", 2,
     "Complete the missing line so the function returns the sum.",
     "def total(values):\n    result = 0\n    for v in values:\n        # MISSING LINE\n    return result",
     None, "result += v", ["result = result + v"], None),
    ("Q010", "Debug the Loop", "DEBUGGING", "Loops", "MEDIUM", 2,
     "This loop raises IndexError. Write the corrected loop header.",
     "items = [10, 20, 30]\nfor i in range(len(items) + 1):\n    print(items[i])",
     None, "for i in range(len(items)):", [], "The range walks one index too far."),
]


def seed():
    app = create_app()
    with app.app_context():
        for user_id, role, name, email, password in USERS:
            if query_one("SELECT 1 FROM users WHERE id = ?", (user_id,)):
                continue
            execute(
                "INSERT INTO users (id, role, name, email, password_hash, active, created_at)"
                " VALUES (?, ?, ?, ?, ?, 1, ?)",
                (user_id, role, name, email, hash_password(password), NOW),
            )

        if not query_one("SELECT 1 FROM events WHERE id = ?", (EVENT[0],)):
            execute(
                "INSERT INTO events (id, name, description, department, start_date, end_date,"
                " venue, status, registration_site, registration_fee, prize_pool)"
                " VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                EVENT,
            )

        for (test_id, name, description, ttype, count, duration, mode, distribution,
             scheduled, status) in TESTS:
            if query_one("SELECT 1 FROM tests WHERE id = ?", (test_id,)):
                continue
            execute(
                "INSERT INTO tests (id, event_id, name, description, type, question_count,"
                " duration_minutes, selection_mode, distribution, manual_question_ids,"
                " scheduled_start, status, results_published, created_by, created_at)"
                " VALUES (?,?,?,?,?,?,?,?,?,'[]',?,?,0,'STAFF001',?)",
                (test_id, EVENT[0], name, description, ttype, count, duration, mode,
                 json.dumps(distribution), scheduled, status, NOW),
            )

        for (qid, title, qtype, topic, difficulty, marks, prompt, code, options,
             answer, alternatives, explanation) in QUESTIONS:
            if query_one("SELECT 1 FROM questions WHERE id = ?", (qid,)):
                continue
            execute(
                "INSERT INTO questions (id, version, title, type, topic, difficulty, marks, status,"
                " prompt, code, options, answer, alternatives, explanation, created_by, created_at)"
                " VALUES (?,1,?,?,?,?,?,'ACTIVE',?,?,?,?,?,?,'STAFF001',?)",
                (qid, title, qtype, topic, difficulty, marks, prompt, code,
                 json.dumps(options) if options else None, answer,
                 json.dumps(alternatives), explanation, NOW),
            )

        # Enrol every seeded student in the scheduled showcase test. Tests with no
        # assignments at all remain open to all students.
        for test_id in ("T1001",):
            for student in ("ST2026001", "ST2026002", "ST2026003", "ST2026004", "ST2026005"):
                if query_one(
                    "SELECT 1 FROM student_test_assignments WHERE test_id = ? AND student_id = ?",
                    (test_id, student),
                ):
                    continue
                execute(
                    "INSERT INTO student_test_assignments (test_id, student_id) VALUES (?, ?)",
                    (test_id, student),
                )

        print("Seed complete. DEMO accounts created — change all passwords before production.")


if __name__ == "__main__":
    seed()
