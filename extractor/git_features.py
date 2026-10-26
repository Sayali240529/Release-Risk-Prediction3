"""
git_features.py
Extracts per-commit risk features from a Git repository using PyDriller.
"""

import math
from collections import Counter
from pydriller import Repository


def _directory_entropy(modified_files):
    """Shannon entropy over directories touched - high entropy = scattered change."""
    dirs = [
        f.filename.split("/")[0] if "/" in f.filename else "root"
        for f in modified_files
    ]
    total = len(dirs)
    if total == 0:
        return 0.0
    counts = Counter(dirs)
    return -sum((c / total) * math.log2(c / total) for c in counts.values())


def extract_git_features(repo_path: str, since=None, to=None) -> list[dict]:
    """
    Mine commits from a local or remote Git repo and return a list of feature dicts.
    """
    kwargs = {}
    if since:
        kwargs["since"] = since
    if to:
        kwargs["to"] = to

    records = []
    author_commit_counts: Counter = Counter()

    for commit in Repository(repo_path, **kwargs).traverse_commits():
        author = commit.author.email or "unknown"
        author_commit_counts[author] += 1

        lines_added = sum(f.added_lines for f in commit.modified_files)
        lines_deleted = sum(f.deleted_lines for f in commit.modified_files)
        files_modified = len(commit.modified_files)
        entropy = _directory_entropy(commit.modified_files)

        records.append({
            "commit_hash": commit.hash[:8],
            "commit_date": commit.author_date,
            "author_email": author,
            "lines_added": lines_added,
            "lines_deleted": lines_deleted,
            "commit_churn": lines_added + lines_deleted,
            "files_modified": files_modified,
            "directory_entropy": round(entropy, 4),
            "is_merge_commit": int(commit.merge),
            "commit_message_length": len(commit.msg.strip()),
        })

    total = max(len(records), 1)
    for rec in records:
        rec["author_commit_frequency"] = round(
            author_commit_counts[rec["author_email"]] / total, 4
        )

    return records

