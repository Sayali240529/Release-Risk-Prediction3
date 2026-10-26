"""
ablation.py
Runs an ablation study comparing:
  1. Random Baseline
  2. Heuristic Rule (lines changed > 300)
  3. Git-only Baseline (Replicating König et al. 2025)
  4. Git + CI Logs Baseline
  5. Full Multimodal Model (Git + CI + Text NLP) - Our Proposed System

Saves ablation_results.csv and prints comparative table for the report.
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import average_precision_score, roc_auc_score, f1_score
from catboost import CatBoostClassifier

_DROP_COLS = ["commit_hash", "commit_date", "author_email", "commit_message", "risk_label"]

GIT_COLS = [
    "lines_added", "lines_deleted", "commit_churn", "files_modified",
    "directory_entropy", "is_merge_commit", "commit_message_length",
    "author_commit_frequency"
]

CI_COLS = [
    "ci_warning_count", "ci_error_count", "ci_test_duration_s",
    "ci_test_duration_delta", "ci_flaky_test_flag", "ci_stack_trace_flag",
    "ci_timeout_flag", "ci_oom_flag"
]

TEXT_COLS = [
    "text_risk_keyword_count", "text_risk_score", "text_message_length",
    "text_has_hotfix", "text_has_migration", "text_has_revert",
    "text_has_security", "text_has_regression"
]


def run_ablation(csv_path: str = "data/features.csv"):
    df = pd.read_csv(csv_path)
    y = df["risk_label"]

    train_idx, test_idx = train_test_split(
        df.index, test_size=0.20, random_state=42, stratify=y
    )
    y_test = y.loc[test_idx]
    y_train = y.loc[train_idx]

    results = []

    # 1. Random Baseline
    np.random.seed(42)
    rand_probs = np.random.uniform(0, 1, len(y_test))
    results.append({
        "Model / Configuration": "1. Random Baseline",
        "PR-AUC": round(average_precision_score(y_test, rand_probs), 4),
        "ROC-AUC": round(roc_auc_score(y_test, rand_probs), 4),
        "F1-Score": round(f1_score(y_test, (rand_probs >= 0.5).astype(int)), 4),
    })

    # 2. Heuristic Rule (commit_churn > 300)
    rule_pred = (df.loc[test_idx, "commit_churn"] > 300).astype(int)
    results.append({
        "Model / Configuration": "2. Heuristic (Churn > 300)",
        "PR-AUC": round(average_precision_score(y_test, rule_pred), 4),
        "ROC-AUC": round(roc_auc_score(y_test, rule_pred), 4),
        "F1-Score": round(f1_score(y_test, rule_pred), 4),
    })

    # Train helper for CatBoost configurations
    def eval_catboost(feature_subset, name):
        X_sub = df[feature_subset]
        X_tr = X_sub.loc[train_idx]
        X_te = X_sub.loc[test_idx]

        neg, pos = (y_train == 0).sum(), (y_train == 1).sum()
        model = CatBoostClassifier(
            iterations=300,
            learning_rate=0.05,
            depth=6,
            scale_pos_weight=neg / max(pos, 1),
            random_seed=42,
            verbose=False,
        )
        model.fit(X_tr, y_train)
        probs = model.predict_proba(X_te)[:, 1]
        preds = (probs >= 0.35).astype(int)

        return {
            "Model / Configuration": name,
            "PR-AUC": round(average_precision_score(y_test, probs), 4),
            "ROC-AUC": round(roc_auc_score(y_test, probs), 4),
            "F1-Score": round(f1_score(y_test, preds), 4),
        }

    # 3. Git-only (König et al. 2025)
    results.append(eval_catboost(GIT_COLS, "3. Git Only (König et al. 2025)"))

    # 4. Git + CI Logs
    results.append(eval_catboost(GIT_COLS + CI_COLS, "4. Git + CI Logs"))

    # 5. Full Multimodal (Git + CI + Text)
    results.append(eval_catboost(GIT_COLS + CI_COLS + TEXT_COLS, "5. Full Multimodal (Proposed)"))

    res_df = pd.DataFrame(results)
    print("\n" + "=" * 65)
    print("               ABLATION STUDY RESULTS")
    print("=" * 65)
    print(res_df.to_string(index=False))
    print("=" * 65)

    out_file = "model/artifacts/ablation_results.csv"
    res_df.to_csv(out_file, index=False)
    print(f"[ablation] Saved results -> {out_file}\n")


if __name__ == "__main__":
    run_ablation()

