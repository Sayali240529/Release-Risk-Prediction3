"""
backend/main.py
FastAPI backend service exposing the Release Risk Prediction Engine API.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json
from pathlib import Path
import pandas as pd
import sys
from dotenv import load_dotenv

# Load local .env if present
load_dotenv()

# Ensure project root is in path
sys.path.insert(0, str(Path(__file__).parent.parent))

from model.predict_api import predict
from extractor.text_features import extract_text_features
from backend.github_client import fetch_and_analyze_github_pr
from backend.webhook_handler import process_github_webhook_payload

app = FastAPI(
    title="Release Risk Prediction API",
    version="2.0.0",
    description="Enterprise-grade multimodal release risk engine connecting commits, CI logs, and PR semantics."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store for releases pushed via live webhooks or fetched from GitHub
LIVE_WEBHOOK_RELEASES = []
REAL_RELEASES_FILE = Path(__file__).parent.parent / "data" / "real_releases.json"


def get_all_stored_releases() -> List[Dict[str, Any]]:
    """Loads all real analyzed GitHub releases from persistent JSON store."""
    releases = []
    if REAL_RELEASES_FILE.exists():
        try:
            releases = json.loads(REAL_RELEASES_FILE.read_text(encoding="utf-8"))
        except Exception:
            releases = []

    # Merge live webhook releases without duplicates
    for w in LIVE_WEBHOOK_RELEASES:
        if not any(r.get("id") == w.get("id") for r in releases):
            releases.insert(0, w)
    return releases


def save_stored_release(release_data: Dict[str, Any]):
    """Persists a new real GitHub release into the real releases database."""
    releases = get_all_stored_releases()
    # Remove older duplicate if exists
    releases = [r for r in releases if r.get("id") != release_data.get("id")]
    releases.insert(0, release_data)
    try:
        REAL_RELEASES_FILE.write_text(json.dumps(releases, indent=2), encoding="utf-8")
    except Exception as e:
        print(f"[backend] Warning: could not persist real_releases.json: {e}")


class PredictRequest(BaseModel):
    commit_churn: int
    files_modified: int
    directory_entropy: float
    is_merge_commit: int = 0
    author_commit_frequency: float = 0.05
    ci_warning_count: int = 0
    ci_error_count: int = 0
    ci_test_duration_delta: float = 0.0
    ci_flaky_test_flag: int = 0
    ci_stack_trace_flag: int = 0
    ci_timeout_flag: int = 0
    pr_text: str = ""


class GitHubPRRequest(BaseModel):
    pr_url: str
    ci_log_text: Optional[str] = None
    github_token: Optional[str] = None


@app.post("/api/github/analyze-pr")
def analyze_github_pr_endpoint(req: GitHubPRRequest):
    """
    Connects to GitHub REST API, downloads PR diff, commits, and files,
    runs entropy and NLP extraction, and returns real-time risk assessment.
    """
    try:
        result = fetch_and_analyze_github_pr(
            pr_url=req.pr_url,
            custom_ci_log=req.ci_log_text,
            github_token=req.github_token,
        )
        # Persist to real releases store
        save_stored_release(result)
        return result
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze GitHub PR: {str(e)}")


@app.post("/api/webhook/github")
async def github_webhook_endpoint(payload: Dict[str, Any]):
    """
    Fully automated GitHub Webhook listener.
    Triggered when code is pushed or a PR is opened/updated on GitHub.
    """
    try:
        release_entry = process_github_webhook_payload(payload)
        # Prepend to live releases store and persist
        LIVE_WEBHOOK_RELEASES.insert(0, release_entry)
        save_stored_release(release_entry)
        return {
            "status": "success",
            "message": "GitHub Webhook processed and release risk evaluated",
            "release": release_entry
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Webhook processing error: {str(e)}")


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "engine": "CatBoost + SHAP Multimodal Engine",
        "model_loaded": True
    }


@app.get("/api/releases")
def get_releases():
    """Returns list of real GitHub releases stored and evaluated by the engine."""
    return get_all_stored_releases()


@app.get("/api/releases/{release_id}")
def get_release_detail(release_id: str):
    """Returns full release detail with SHAP root cause breakdown."""
    for rel in get_all_stored_releases():
        if rel.get("id") == release_id:
            return rel
    raise HTTPException(status_code=404, detail="Release not found")


@app.post("/api/predict")
def predict_custom(req: PredictRequest):
    """Live risk scoring for custom user-submitted release params."""
    text_feats = extract_text_features(req.pr_text)
    features = {
        "lines_added": int(req.commit_churn * 0.6),
        "lines_deleted": int(req.commit_churn * 0.4),
        "commit_churn": req.commit_churn,
        "files_modified": req.files_modified,
        "directory_entropy": req.directory_entropy,
        "is_merge_commit": req.is_merge_commit,
        "commit_message_length": len(req.pr_text),
        "author_commit_frequency": req.author_commit_frequency,
        "ci_warning_count": req.ci_warning_count,
        "ci_error_count": req.ci_error_count,
        "ci_test_duration_s": round(60.0 * (1.0 + req.ci_test_duration_delta), 1),
        "ci_test_duration_delta": req.ci_test_duration_delta,
        "ci_flaky_test_flag": req.ci_flaky_test_flag,
        "ci_stack_trace_flag": req.ci_stack_trace_flag,
        "ci_timeout_flag": req.ci_timeout_flag,
        "ci_oom_flag": 0,
        **text_feats
    }
    res = predict(features)
    return {
        "features": features,
        "prediction": res,
        "pipeline_stages": [
            {"name": "Commit & Lint", "status": "passed", "time": "10s"},
            {"name": "CI Build & Tests", "status": "warning" if req.ci_warning_count > 3 else "passed", "time": "45s"},
            {"name": "AI Release Risk Gate", "status": res["action"].lower(), "time": "0.15s"},
            {"name": "Canary Traffic (5%)", "status": "holding" if res["action"] == "HOLD_CANARY" else ("blocked" if res["action"] == "MANUAL_REVIEW" else "passed"), "time": "active"},
            {"name": "Production Promotion", "status": "waiting" if res["action"] != "AUTO_PROMOTE" else "promoted", "time": "-"}
        ]
    }


@app.get("/api/benchmarks")
def get_benchmarks():
    """Returns the ablation study results comparing all models."""
    csv_path = Path("model/artifacts/ablation_results.csv")
    if csv_path.exists():
        df = pd.read_csv(csv_path)
        return df.to_dict(orient="records")
    return []


# Mount frontend dist if built
dist_dir = Path(__file__).parent.parent / "frontend" / "dist"
if dist_dir.exists():
    app.mount("/", StaticFiles(directory=str(dist_dir), html=True), name="frontend")


if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.getenv("PORT", 8080))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("backend.main:app", host=host, port=port, reload=False)


