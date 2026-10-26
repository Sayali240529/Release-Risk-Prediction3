"""
predict_api.py
Unified inference API for release risk evaluation and SHAP factor attribution.
"""

from pathlib import Path
import joblib
import pandas as pd
from model.policy import evaluate_policy, PolicyResult

_MODEL_PATH = "model/artifacts/model.pkl"
_EXPLAINER_PATH = "model/artifacts/shap_explainer.pkl"

_model_artifact = None
_explainer_artifact = None


def _load():
    global _model_artifact, _explainer_artifact
    if _model_artifact is None:
        assert Path(_MODEL_PATH).exists(), (
            f"model.pkl not found at {_MODEL_PATH}. Run 'python -m model.train' first."
        )
        _model_artifact = joblib.load(_MODEL_PATH)
    if _explainer_artifact is None:
        assert Path(_EXPLAINER_PATH).exists(), (
            f"shap_explainer.pkl not found. Run 'python -m model.explain' first."
        )
        _explainer_artifact = joblib.load(_EXPLAINER_PATH)


def predict(features_dict: dict) -> dict:
    """
    Score a single release candidate and return a full result dict.
    """
    _load()

    feat_cols = _model_artifact["feature_cols"]
    model = _model_artifact["model"]

    row = {col: features_dict.get(col, 0) for col in feat_cols}
    X = pd.DataFrame([row])[feat_cols]

    score = float(model.predict_proba(X)[0, 1])
    policy: PolicyResult = evaluate_policy(score)

    explainer = _explainer_artifact["explainer"]
    labels = _explainer_artifact["feature_labels"]
    sv = explainer(X)
    vals = sv.values[0]
    if vals.ndim == 2:
        vals = vals[:, 1]

    top_factors = sorted(
        [(labels.get(c, c), float(v)) for c, v in zip(feat_cols, vals)],
        key=lambda x: abs(x[1]), reverse=True
    )[:3]

    return {
        "score": round(score, 4),
        "action": policy.action,
        "badge_color": policy.badge_color,
        "headline": policy.headline,
        "detail": policy.detail,
        "top_factors": top_factors,
    }

