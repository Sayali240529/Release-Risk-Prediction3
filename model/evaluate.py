"""
evaluate.py
Evaluates the trained CatBoost model and plots PR curve, ROC curve,
and confusion matrix. Saves plots to model/artifacts/.
"""

import argparse
from pathlib import Path
import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
from sklearn.metrics import (
    ConfusionMatrixDisplay,
    classification_report,
    precision_recall_curve,
    roc_auc_score,
    roc_curve,
    average_precision_score,
)
from sklearn.model_selection import train_test_split


def evaluate(csv_path: str = "data/features.csv",
             model_path: str = "model/artifacts/model.pkl"):

    artifact = joblib.load(model_path)
    model = artifact["model"]
    feat_cols = artifact["feature_cols"]

    df = pd.read_csv(csv_path)
    drop = [c for c in ["commit_hash", "commit_date", "author_email", "commit_message"] if c in df.columns]
    df = df.drop(columns=drop)

    X = df[feat_cols]
    y = df["risk_label"]

    _, X_test, _, y_test = train_test_split(X, y, test_size=0.20, random_state=42, stratify=y)

    y_prob = model.predict_proba(X_test)[:, 1]
    y_pred = (y_prob >= 0.35).astype(int)

    pr_auc = average_precision_score(y_test, y_prob)
    roc_auc = roc_auc_score(y_test, y_prob)

    print("\n" + "=" * 50)
    print(f"  PR-AUC  : {pr_auc:.4f}   (PRIMARY METRIC)")
    print(f"  ROC-AUC : {roc_auc:.4f}")
    print("=" * 50)
    print(classification_report(y_test, y_pred, target_names=["Safe", "Risky"]))

    fig, axes = plt.subplots(1, 3, figsize=(15, 4))

    # PR Curve
    prec, rec, _ = precision_recall_curve(y_test, y_prob)
    axes[0].plot(rec, prec, color="darkorange", lw=2, label=f"PR-AUC = {pr_auc:.3f}")
    axes[0].set_xlabel("Recall")
    axes[0].set_ylabel("Precision")
    axes[0].set_title("Precision-Recall Curve")
    axes[0].legend()

    # ROC Curve
    fpr, tpr, _ = roc_curve(y_test, y_prob)
    axes[1].plot(fpr, tpr, color="steelblue", lw=2, label=f"ROC-AUC = {roc_auc:.3f}")
    axes[1].plot([0, 1], [0, 1], "k--", lw=1)
    axes[1].set_xlabel("FPR")
    axes[1].set_ylabel("TPR")
    axes[1].set_title("ROC Curve")
    axes[1].legend()

    # Confusion Matrix
    ConfusionMatrixDisplay.from_predictions(
        y_test, y_pred, display_labels=["Safe", "Risky"],
        colorbar=False, ax=axes[2]
    )
    axes[2].set_title("Confusion Matrix (threshold=0.35)")

    plt.tight_layout()
    out = "model/artifacts/evaluation.png"
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(out, dpi=120)
    plt.close()
    print(f"[evaluate] Saved evaluation plot -> {out}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="data/features.csv")
    parser.add_argument("--model", default="model/artifacts/model.pkl")
    args = parser.parse_args()
    evaluate(args.data, args.model)


if __name__ == "__main__":
    main()

