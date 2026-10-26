"""
backend/webhook_handler.py
Processes real or simulated GitHub Webhook events (pull_request, push),
computes risk via CatBoost + SHAP, and posts status/comments back to GitHub.
"""

import os
import requests
from typing import Dict, Any, Optional

from extractor.text_features import extract_text_features
from model.predict_api import predict


def generate_markdown_comment(result: Dict[str, Any]) -> str:
    """Formats the AI release risk verdict into a GitHub PR comment."""
    score = result["score"]
    action = result["action"]
    pct = int(score * 100)

    emoji_map = {
        "AUTO_PROMOTE": "✅",
        "HOLD_CANARY": "⚠️",
        "MANUAL_REVIEW": "🛑"
    }
    emoji = emoji_map.get(action, "ℹ️")

    lines = [
        f"### {emoji} AI Release-Risk Assessment: {action.replace('_', ' ')} ({pct}% Risk)",
        "",
        f"**Decision:** {result['headline']}",
        f"**Recommendation:** {result['detail']}",
        "",
        "#### 🧠 Key Root Causes (SHAP Factor Attribution)",
        "| Factor | Impact on Risk | Direction |",
        "| :--- | :---: | :--- |"
    ]

    for factor, val in result["top_factors"]:
        sign = "+" if val >= 0 else ""
        direction = "🔴 Elevates Risk" if val > 0 else "🟢 Reduces Risk"
        lines.append(f"| {factor} | `{sign}{val:.3f}` | {direction} |")

    lines.extend([
        "",
        "---",
        "*Automated verification gate powered by **Release-Risk Copilot** (CatBoost + SHAP).*"
    ])

    return "\n".join(lines)


def post_github_comment(
    repo_full_name: str,
    pr_number: int,
    comment_body: str,
    token: Optional[str] = None
) -> bool:
    """Posts a comment on a GitHub PR using GitHub REST API."""
    github_token = token or os.getenv("GITHUB_TOKEN")
    if not github_token:
        print(f"[webhook] GITHUB_TOKEN not configured. Skipping live PR comment on {repo_full_name}#{pr_number}")
        return False

    url = f"https://api.github.com/repos/{repo_full_name}/issues/{pr_number}/comments"
    headers = {
        "Authorization": f"token {github_token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Release-Risk-Engine"
    }

    resp = requests.post(url, headers=headers, json={"body": comment_body}, timeout=10)
    if resp.status_code == 201:
        print(f"[webhook] Successfully posted comment on GitHub PR {repo_full_name}#{pr_number}")
        return True
    else:
        print(f"[webhook] Failed to post GitHub comment: {resp.status_code} - {resp.text}")
        return False


def set_github_commit_status(
    repo_full_name: str,
    sha: str,
    action: str,
    score: float,
    token: Optional[str] = None
) -> bool:
    """Sets the commit status check (Green check, Yellow pending, Red failure) on GitHub."""
    github_token = token or os.getenv("GITHUB_TOKEN")
    if not github_token:
        return False

    state_map = {
        "AUTO_PROMOTE": "success",
        "HOLD_CANARY": "pending",
        "MANUAL_REVIEW": "failure"
    }
    state = state_map.get(action, "pending")
    desc = f"Risk: {int(score * 100)}% ({action.replace('_', ' ')})"

    url = f"https://api.github.com/repos/{repo_full_name}/statuses/{sha}"
    headers = {
        "Authorization": f"token {github_token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Release-Risk-Engine"
    }
    payload = {
        "state": state,
        "description": desc,
        "context": "release-risk/ai-gate"
    }

    resp = requests.post(url, headers=headers, json=payload, timeout=10)
    return resp.status_code == 201


def process_github_webhook_payload(payload: Dict[str, Any], event_type: str = "pull_request") -> Dict[str, Any]:
    """
    Parses a GitHub webhook payload, extracts multimodal signals, executes
    CatBoost + SHAP prediction, and optionally posts back to GitHub.
    """
    if event_type == "pull_request" or "pull_request" in payload:
        pr = payload["pull_request"]
        repo = payload.get("repository", {})
        repo_name = repo.get("full_name", "unknown/repo")
        pr_number = pr.get("number", 0)
        title = pr.get("title", "Untitled PR")
        body = pr.get("body", "") or ""
        author = pr.get("user", {}).get("login", "unknown")
        branch = pr.get("head", {}).get("ref", "feature-branch")
        commit_hash = (pr.get("head", {}).get("sha", "0000000"))[:7]

        additions = int(pr.get("additions", 100))
        deletions = int(pr.get("deletions", 50))
        files_modified = int(pr.get("changed_files", 5))
    else:
        # Push event payload
        repo = payload.get("repository", {})
        repo_name = repo.get("full_name", "unknown/repo")
        commits = payload.get("commits", [])
        pr_number = 999
        title = commits[0].get("message", "Direct git push commit") if commits else "Direct git push"
        body = ""
        author = payload.get("pusher", {}).get("name", "git-user")
        branch = payload.get("ref", "refs/heads/main").replace("refs/heads/", "")
        commit_hash = (payload.get("after", "0000000"))[:7]

        additions = sum(len(c.get("added", [])) * 25 for c in commits) or 150
        deletions = sum(len(c.get("removed", [])) * 10 for c in commits) or 40
        files_modified = max(sum(len(c.get("modified", [])) for c in commits), 3)

    churn = additions + deletions
    entropy = round(min(files_modified * 0.15, 2.5), 2)

    # NLP text features
    combined_text = f"{title} {body}"
    text_feats = extract_text_features(combined_text)

    # Simulated CI baseline for the incoming webhook
    ci_feats = {
        "ci_warning_count": 5 if churn > 500 else 1,
        "ci_error_count": 0,
        "ci_test_duration_s": round(55.0 + min(churn * 0.05, 50.0), 1),
        "ci_test_duration_delta": round(min(churn * 0.0006, 0.5), 2),
        "ci_flaky_test_flag": 1 if churn > 600 else 0,
        "ci_stack_trace_flag": 0,
        "ci_timeout_flag": 0,
        "ci_oom_flag": 0,
    }

    features = {
        "lines_added": additions,
        "lines_deleted": deletions,
        "commit_churn": churn,
        "files_modified": files_modified,
        "directory_entropy": entropy,
        "is_merge_commit": 0,
        "commit_message_length": len(combined_text),
        "author_commit_frequency": 0.06,
        **ci_feats,
        **text_feats
    }

    # Run AI prediction
    prediction = predict(features)

    # Prepare markdown comment
    markdown_report = generate_markdown_comment(prediction)

    # Post back to GitHub if credentials available
    post_github_comment(repo_name, pr_number, markdown_report)
    set_github_commit_status(repo_name, commit_hash, prediction["action"], prediction["score"])

    # Prepare UI-ready release record
    release_entry = {
        "id": f"webhook-{repo_name.replace('/', '-')}-{pr_number}-{commit_hash}",
        "pr_number": pr_number,
        "repo_name": repo_name,
        "title": title,
        "author": author,
        "author_role": "Webhook Trigger",
        "branch": branch,
        "commit_hash": commit_hash,
        "commit_time": "Just now (Webhook)",
        "risk_score": prediction["score"],
        "action": prediction["action"],
        "badge_color": prediction["badge_color"],
        "headline": prediction["headline"],
        "features": features,
        "ci_logs": [
            f"[00:00:01] GitHub Webhook payload received for {repo_name}#{pr_number}",
            f"[00:00:02] Event: pull_request (commit {commit_hash})",
            f"[00:00:03] Churn detected: +{additions} / -{deletions} ({files_modified} files touched)",
            f"[00:00:04] Entropy: {entropy} | Keyword flags: {text_feats['text_risk_keyword_count']}",
            f"[00:00:05] CatBoost + SHAP Inference completed: Risk={int(prediction['score']*100)}%",
            f"[00:00:06] Automated Policy Output: {prediction['action']}"
        ],
        "radar_scores": [
            {"subject": "Code Churn", "score": min(int(churn / 12), 100), "baseline": 35},
            {"subject": "Directory Entropy", "score": min(int(entropy * 38), 100), "baseline": 40},
            {"subject": "CI Warnings", "score": min(ci_feats["ci_warning_count"] * 12, 100), "baseline": 25},
            {"subject": "NLP Risk Semantics", "score": min(text_feats["text_risk_keyword_count"] * 30, 100), "baseline": 20},
            {"subject": "Canary Telemetry Drift", "score": min(int(prediction["score"] * 85), 100), "baseline": 15}
        ],
        "diff_files": [
            {
                "filename": f"src/modules/core/{branch.replace('/', '_')}.ts",
                "additions": additions,
                "deletions": deletions,
                "status": "modified",
                "hunks": [
                    {"type": "context", "line": f"@@ -1,5 +1,9 @@ // Webhook commit: {commit_hash}"},
                    {"type": "addition", "line": f"+ // PR #{pr_number}: {title}"},
                    {"type": "addition", "line": f"+ export const REVISION_FLAGS = {{ churn: {churn}, files: {files_modified} }};", "flag": "Webhook Payload" if churn > 400 else None},
                    {"type": "context", "line": "  export default class PipelineHandler { ... }"}
                ]
            }
        ],
        "canary_telemetry": {
            "current_traffic": "5% (Automated)",
            "p99_latency_ms": 188 if prediction["score"] < 0.4 else (290 if prediction["score"] < 0.7 else 440),
            "baseline_p99_ms": 180,
            "error_rate": "0.02%" if prediction["score"] < 0.4 else "0.38%",
            "baseline_error_rate": "0.02%",
            "latency_series": [
                {"time": "12:00", "baseline": 180, "canary": 182, "err_base": 0.02, "err_canary": 0.02},
                {"time": "12:05", "baseline": 179, "canary": 185 if prediction["score"] < 0.4 else 240, "err_base": 0.02, "err_canary": 0.04},
                {"time": "12:10", "baseline": 181, "canary": 188 if prediction["score"] < 0.4 else (290 if prediction["score"] < 0.7 else 440), "err_base": 0.02, "err_canary": 0.38 if prediction["score"] >= 0.4 else 0.02}
            ]
        },
        "prediction": prediction,
        "pipeline_stages": [
            {"name": "GitHub Webhook Trigger", "status": "passed", "time": "0.1s"},
            {"name": "Payload Ingestion", "status": "passed", "time": "0.2s"},
            {"name": "Multimodal Feature Extractor", "status": "passed", "time": "0.3s"},
            {"name": "AI Release-Risk Gate", "status": prediction["action"].lower(), "time": "0.14s"},
            {
                "name": "Canary Rollout (10%)",
                "status": "holding" if prediction["action"] == "HOLD_CANARY" else ("blocked" if prediction["action"] == "MANUAL_REVIEW" else "passed"),
                "time": "active"
            },
            {
                "name": "Production Gate",
                "status": "waiting" if prediction["action"] != "AUTO_PROMOTE" else "promoted",
                "time": "-"
            }
        ]
    }

    return release_entry

