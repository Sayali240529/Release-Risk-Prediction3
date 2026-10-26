"""
train.py
Loads features.csv, trains a CatBoost classifier, and saves model.pkl to model/artifacts/.
"""

import argparse
from pathlib import Path
import joblib
import pandas as pd
from catboost import CatBoostClassifier
from sklearn.model_selection import train_test_split

_DROP_COLS = ["commit_hash", "commit_date", "author_email", "commit_message"]
FEATURE_COLS: list[str] = []


def load_data(csv_path: str):
    df = pd.read_csv(csv_path)
    assert "risk_label" in df.columns, "features.csv must have a 'risk_label' column"

    drop = [c for c in _DROP_COLS if c in df.columns]
    df = df.drop(columns=drop)

    X = df.drop(columns=["risk_label"])
    y = df["risk_label"]

    global FEATURE_COLS
    FEATURE_COLS = list(X.columns)
    return X, y


def train(csv_path: str = "data/features.csv",
          out_path: str = "model/artifacts/model.pkl",
          test_size: float = 0.20,
          seed: int = 42) -> CatBoostClassifier:

    X, y = load_data(csv_path)

    neg, pos = (y == 0).sum(), (y == 1).sum()
    scale_pos = neg / max(pos, 1)
    print(f"[train] Dataset: {len(X)} rows | positives (risky): {pos} | scale_pos_weight: {scale_pos:.2f}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=seed, stratify=y
    )

    model = CatBoostClassifier(
        iterations=500,
        learning_rate=0.05,
        depth=6,
        scale_pos_weight=scale_pos,
        eval_metric="AUC",
        random_seed=seed,
        verbose=100,
    )
    model.fit(
        X_train, y_train,
        eval_set=(X_test, y_test),
        early_stopping_rounds=50,
    )

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, "feature_cols": FEATURE_COLS}, out_path)
    print(f"[train] Saved -> {out_path}")

    return model


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="data/features.csv")
    parser.add_argument("--out", default="model/artifacts/model.pkl")
    args = parser.parse_args()
    train(args.data, args.out)


if __name__ == "__main__":
    main()

