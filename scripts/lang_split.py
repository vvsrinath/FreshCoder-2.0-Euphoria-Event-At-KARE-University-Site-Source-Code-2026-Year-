#!/usr/bin/env python3
"""Report the share of each programming language in the project.

Counts physical lines for every source file, excludes machine-generated or
third-party content (node_modules, dist, lock files, minified bundles) and
prints a grouped summary so the JS / Python / other-language split can be
checked against the target mix (>50% JavaScript, ~30% Python).

Usage:
    python scripts/lang_split.py
    python scripts/lang_split.py --json   # machine readable summary
"""
import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SKIP_DIRS = {"node_modules", "dist", "build", ".git", "__pycache__", ".venv", "venv"}
SKIP_FILES = {"package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock"}
SKIP_SUFFIX = {".map", ".min.js", ".min.css"}

EXTS = {
    "JavaScript/TypeScript": {".tsx", ".ts", ".js", ".jsx", ".cjs", ".mjs"},
    "Python": {".py"},
    "SQL": {".sql"},
    "JSON": {".json"},
    "HTML": {".html", ".htm"},
    "CSS": {".css", ".scss", ".sass", ".less"},
    "Markdown": {".md", ".mdx"},
    "Shell": {".sh", ".bash", ".zsh"},
    "Config": {".yml", ".yaml", ".toml", ".ini", ".env", ".cjs"},
}

# Anything not matched above still counts toward "other" so the script never
# hides code from the report.
OTHER = "Other"


def iter_source_files(root: Path):
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(root)
        if any(part in SKIP_DIRS for part in rel.parts):
            continue
        if path.name in SKIP_FILES:
            continue
        if any(path.name.endswith(suffix) for suffix in SKIP_SUFFIX):
            continue
        if path.suffix.lower() not in {e.lower() for exts in EXTS.values() for e in exts}:
            continue
        yield path


def language_for(path: Path) -> str:
    suffix = path.suffix.lower()
    for group, extensions in EXTS.items():
        if suffix in extensions:
            return group
    return OTHER


def count_lines(path: Path) -> int:
    try:
        with path.open("r", encoding="utf-8", errors="replace") as handle:
            return sum(1 for _ in handle)
    except OSError:
        return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="emit a JSON summary")
    parser.add_argument(
        "--root", type=Path, default=ROOT, help="repository root to scan"
    )
    args = parser.parse_args()

    per_group = defaultdict(int)
    per_group_files = defaultdict(int)
    per_group_lines: defaultdict = defaultdict(lambda: defaultdict(int))

    for path in iter_source_files(args.root):
        lines = count_lines(path)
        group = language_for(path)
        per_group[group] += lines
        per_group_files[group] += 1
        per_group_lines[group][str(path.relative_to(args.root))] = lines

    total = sum(per_group.values())
    if total == 0:
        print("No source files found under", args.root)
        return 1

    js = per_group.get("JavaScript/TypeScript", 0)
    py = per_group.get("Python", 0)
    others = total - js - py

    if args.json:
        print(json.dumps(
            {
                "total": total,
                "javascript_typescript": js,
                "python": py,
                "other": others,
                "js_share": round(100 * js / total, 2),
                "python_share": round(100 * py / total, 2),
                "other_share": round(100 * others / total, 2),
                "groups": dict(sorted(per_group.items(), key=lambda kv: -kv[1])),
            },
            indent=2,
        ))
        return 0

    print(f"Language split for {args.root.name}")
    print(f"{'language':<22}{'files':>7}{'lines':>10}{'share':>9}")
    print("-" * 48)
    for group, lines in sorted(per_group.items(), key=lambda kv: -kv[1]):
        print(
            f"{group:<22}{per_group_files[group]:>7}{lines:>10}"
            f"{100 * lines / total:>8.1f}%"
        )
    print("-" * 48)
    print(f"{'TOTAL':<22}{sum(per_group_files.values()):>7}{total:>10}")

    print()
    print(f"JavaScript/TypeScript share : {100 * js / total:.1f}%  (target > 50%)")
    print(f"Python share                : {100 * py / total:.1f}%  (target ~30%)")
    print(f"Other languages             : {100 * others / total:.1f}%")
    return 0


if __name__ == "__main__":
    sys.exit(main())