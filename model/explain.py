"""
explain.py
Builds and saves the SHAP TreeExplainer for the trained CatBoost model.
"""

import argparse
from pathlib import Path
import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
import shap

FEATURE_LABELS: dict[str, str] = {
    "commit_churn": "Total lines changed",
    "lines_added": "Lines added",
    "lines_deleted": "Lines deleted",
    "files_modified": "Files modified",
    "directory_entropy": "Change spread across modules",
    "is_merge_commit": "Is a merge commit",
    "commit_message_length": "Commit message length",
    "author_commit_frequency": "Author commit frequency",
    "ci_warning_count": "CI warning count",
    "ci_error_count": "CI error count",
    "ci_test_duration_s": "CI test duration (s)",
    "ci_test_duration_delta": "CI test duration spike",
    "ci_flaky_test_flag": "Flaky test detected",
    "ci_stack_trace_flag": "Stack trace in CI log",
    "ci_timeout_flag": "CI timeout occurred",
    "ci_oom_flag": "Out-of-memory in CI",
    "text_risk_keyword_count": "Risk keyword count in PR/bug text",
    "text_risk_score": "Text semantic risk score",
    "text_message_length": "PR/commit message length",
    "text_has_hotfix": "Contains hotfix/emergency keyword",
    "text_has_migration": "Contains migration/schema keyword",
    "text_has_revert": "Contains revert/rollback keyword",
    "text_has_security": "Contains security/CVE keyword",
    "text_has_regression": "Contains regression/crash keyword",
}


def build_explainer(model_path: str = "model/artifacts/model.pkl",
                    csv_path: str = "data/features.csv",
                    out_path: str = "model/artifacts/shap_explainer.pkl") -> None:

    artifact = joblib.load(model_path)
    model = artifact["model"]
    feat_cols = artifact["feature_cols"]

    df = pd.read_csv(csv_path)
    drop = [c for c in ["commit_hash", "commit_date", "author_email", "commit_message"] if c in df.columns]
    X = df.drop(columns=drop + ["risk_label"])[feat_cols]

    explainer = shap.TreeExplainer(model)
    shap_values = explainer(X)

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({
        "explainer": explainer,
        "feature_cols": feat_cols,
        "feature_labels": FEATURE_LABELS,
    }, out_path)
    print(f"[explain] Saved SHAP explainer -> {out_path}")

    fig, ax = plt.subplots(figsize=(8, 6))
    shap.plots.bar(shap_values, max_display=15, show=False)
    plt.title("Global Feature Importance (mean |SHAP|)")
    plt.tight_layout()
    chart_path = "model/artifacts/shap_global.png"
    plt.savefig(chart_path, dpi=120)
    plt.close()
    print(f"[explain] Saved global SHAP chart -> {chart_path}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="model/artifacts/model.pkl")
    parser.add_argument("--data", default="data/features.csv")
    parser.add_argument("--out", default="model/artifacts/shap_explainer.pkl")
    args = parser.parse_args()
    build_explainer(args.model, args.data, args.out)


if __name__ == "__main__":
    main()

