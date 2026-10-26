"""
dataset_builder.py
Orchestrates all three extractors into one unified features.csv.
"""

import argparse
import random
from pathlib import Path
import pandas as pd

from extractor.ci_features import parse_ci_log
from extractor.text_features import extract_text_features

_BUG_PHRASES = [
    "hotfix critical auth bypass",
    "fix regression in payment module",
    "revert schema migration",
    "security patch for CVE-2024-1234",
    "update dependency and fix flaky test",
    "refactor login flow",
    "add unit tests for user service",
    "update README",
    "bump version to 2.1.0",
    "fix typo in config file",
    "database migration for new feature",
    "emergency fix for production crash",
    "minor style changes",
    "optimize query performance",
    "add logging to payment service",
]

_CI_LOG_TEMPLATES = {
    "clean": (
        "Build started...\n"
        "Running tests...\n"
        "Tests run: 142, Failures: 0, Errors: 0\n"
        "Finished in 55.2 s\n"
        "BUILD SUCCESS\n"
    ),
    "warn": (
        "Build started...\n"
        "WARNING: deprecated API usage in AuthService\n"
        "WARNING: unused import in PaymentGateway\n"
        "DeprecationWarning: method will be removed in v3\n"
        "Tests run: 142, Failures: 0, Errors: 0\n"
        "Finished in 67.8 s\n"
        "BUILD SUCCESS\n"
    ),
    "error": (
        "Build started...\n"
        "ERROR: NullPointerException in OrderController\n"
        "Traceback (most recent call last):\n"
        "  File 'order.py', line 42, in process\n"
        "Tests run: 142, Failures: 3, Errors: 2\n"
        "Finished in 112.4 s\n"
        "BUILD FAILURE\n"
    ),
    "flaky": (
        "Build started...\n"
        "WARNING: flaky test detected, retry attempt 1/3\n"
        "Test intermittent: rerun scheduled\n"
        "Tests run: 142, Failures: 1, Errors: 0\n"
        "Finished in 89.0 s\n"
        "BUILD SUCCESS (with warnings)\n"
    ),
    "timeout": (
        "Build started...\n"
        "ERROR: Connection timed out after 30s\n"
        "FATAL: Build timed out - aborting\n"
        "Finished in 30.0 s\n"
        "BUILD FAILURE\n"
    ),
}


def _simulate_row(rng: random.Random, idx: int) -> dict:
    tier = rng.choices(["low", "medium", "high"], weights=[70, 20, 10])[0]

    if tier == "low":
        churn = rng.randint(5, 150)
        files_modified = rng.randint(1, 5)
        entropy = round(rng.uniform(0.0, 0.8), 4)
        is_merge = rng.choice([0, 0, 0, 1])
        msg_len = rng.randint(20, 80)
        author_freq = round(rng.uniform(0.05, 0.30), 4)
    elif tier == "medium":
        churn = rng.randint(150, 500)
        files_modified = rng.randint(4, 12)
        entropy = round(rng.uniform(0.7, 1.4), 4)
        is_merge = rng.choice([0, 1])
        msg_len = rng.randint(30, 120)
        author_freq = round(rng.uniform(0.02, 0.10), 4)
    else:
        churn = rng.randint(400, 2000)
        files_modified = rng.randint(10, 40)
        entropy = round(rng.uniform(1.3, 2.5), 4)
        is_merge = 1
        msg_len = rng.randint(50, 200)
        author_freq = round(rng.uniform(0.001, 0.04), 4)

    lines_added = int(churn * rng.uniform(0.4, 0.8))
    lines_deleted = churn - lines_added

    log_type_map = {
        "low": "clean",
        "medium": "warn",
        "high": rng.choice(["error", "flaky", "timeout"])
    }
    log_type = rng.choice(list(_CI_LOG_TEMPLATES)) if rng.random() < 0.1 else log_type_map[tier]
    ci_feats = parse_ci_log(_CI_LOG_TEMPLATES[log_type], baseline_duration=60.0)

    if tier == "low":
        phrases = [
            p for p in _BUG_PHRASES
            if not any(w in p for w in ["hotfix", "revert", "security", "migration", "emergency", "crash"])
        ]
    elif tier == "medium":
        phrases = _BUG_PHRASES[3:]
    else:
        phrases = _BUG_PHRASES[:6]

    text = rng.choice(phrases or _BUG_PHRASES)
    text_feats = extract_text_features(text)
    text_feats["commit_message"] = text

    base_prob = {"low": 0.05, "medium": 0.30, "high": 0.75}[tier]
    noise = rng.uniform(-0.05, 0.05)
    risk_label = int(rng.random() < max(0.0, min(1.0, base_prob + noise)))

    row = {
        "commit_hash": f"sim{idx:05d}",
        "lines_added": lines_added,
        "lines_deleted": lines_deleted,
        "commit_churn": churn,
        "files_modified": files_modified,
        "directory_entropy": entropy,
        "is_merge_commit": is_merge,
        "commit_message_length": msg_len,
        "author_commit_frequency": author_freq,
    }
    row.update(ci_feats)
    row.update(text_feats)
    row["risk_label"] = risk_label

    return row


def simulate_dataset(n_rows: int = 500, seed: int = 42) -> pd.DataFrame:
    rng = random.Random(seed)
    rows = [_simulate_row(rng, i) for i in range(n_rows)]
    df = pd.DataFrame(rows)
    print(f"[dataset_builder] Simulated {len(df)} rows | risk_label=1: {df['risk_label'].sum()} ({df['risk_label'].mean():.1%})")
    return df


def save_dataset(df: pd.DataFrame, out_path: str) -> None:
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_path, index=False)
    print(f"[dataset_builder] Saved -> {out_path} ({len(df)} rows, {df.shape[1]} columns)")


def main():
    parser = argparse.ArgumentParser(description="Build release-risk dataset.")
    sub = parser.add_subparsers(dest="mode", required=True)

    sim_p = sub.add_parser("simulate", help="Generate synthetic data")
    sim_p.add_argument("--rows", type=int, default=500)
    sim_p.add_argument("--seed", type=int, default=42)
    sim_p.add_argument("--out", type=str, default="data/features.csv")

    args = parser.parse_args()

    if args.mode == "simulate":
        df = simulate_dataset(args.rows, args.seed)
        save_dataset(df, args.out)


if __name__ == "__main__":
    main()

