"""
text_features.py
Converts PR titles, commit messages, and bug report text into numerical
risk features using keyword matching.
"""

import re

RISK_KEYWORDS: dict[str, float] = {
    "hotfix": 1.0,
    "revert": 1.0,
    "rollback": 1.0,
    "emergency": 1.0,
    "critical": 0.9,
    "security": 0.9,
    "vulnerability": 0.9,
    "cve": 0.9,
    "migration": 0.8,
    "schema": 0.8,
    "database": 0.7,
    "config": 0.6,
    "dependency": 0.6,
    "upgrade": 0.5,
    "regression": 0.8,
    "crash": 0.8,
    "fix": 0.5,
    "bug": 0.5,
    "broken": 0.7,
    "flaky": 0.6,
    "timeout": 0.6,
    "leak": 0.7,
}

_FLAG_KEYWORDS = {
    "text_has_hotfix": ["hotfix", "emergency", "rollback", "revert"],
    "text_has_migration": ["migration", "schema", "migrate"],
    "text_has_revert": ["revert", "undo", "rollback"],
    "text_has_security": ["security", "cve", "vulnerability", "auth", "token"],
    "text_has_regression": ["regression", "broke", "broken", "crashed"],
}


def extract_text_features(text: str) -> dict:
    """
    Given the combined text of a PR title + commit message + bug description,
    return a feature dict with keyword-based risk signals.
    """
    if not text:
        text = ""

    lowered = text.lower()
    words = re.findall(r"[a-z]+", lowered)
    word_set = set(words)

    score = sum(weight for kw, weight in RISK_KEYWORDS.items() if kw in word_set)
    risk_score = round(min(score / 3.0, 1.0), 4)
    keyword_count = sum(1 for kw in RISK_KEYWORDS if kw in word_set)

    features: dict = {
        "text_risk_keyword_count": keyword_count,
        "text_risk_score": risk_score,
        "text_message_length": len(text),
    }

    for flag, kws in _FLAG_KEYWORDS.items():
        features[flag] = int(any(kw in word_set for kw in kws))

    return features

