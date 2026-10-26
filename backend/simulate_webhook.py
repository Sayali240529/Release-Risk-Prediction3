"""
backend/simulate_webhook.py
CLI tool to simulate a live GitHub Webhook event payload and post it
to our running FastAPI server (http://127.0.0.1:8080/api/webhook/github).

Usage:
  python -m backend.simulate_webhook --scenario risky
  python -m backend.simulate_webhook --scenario safe
  python -m backend.simulate_webhook --scenario hotfix
"""

import argparse
import json
import requests
import sys

SCENARIOS = {
    "risky": {
        "event": "pull_request",
        "payload": {
            "action": "opened",
            "number": 204,
            "pull_request": {
                "number": 204,
                "title": "fix(checkout): revert schema migration and overhaul billing pipeline",
                "body": "Emergency revert of billing schema migration after intermittent database deadlocks in staging.",
                "user": {"login": "shraddha-2332"},
                "head": {
                    "ref": "revert-billing-schema",
                    "sha": "9b12fe4"
                },
                "additions": 820,
                "deletions": 490,
                "changed_files": 19
            },
            "repository": {
                "full_name": "shraddha-2332/Release-Risk-Prediction"
            }
        }
    },
    "safe": {
        "event": "pull_request",
        "payload": {
            "action": "opened",
            "number": 205,
            "pull_request": {
                "number": 205,
                "title": "docs: update API documentation and fix typo in README",
                "body": "Small cleanup of endpoint description and adding usage notes for curl commands.",
                "user": {"login": "contributor-jane"},
                "head": {
                    "ref": "docs/readme-cleanup",
                    "sha": "1a45b8e"
                },
                "additions": 35,
                "deletions": 12,
                "changed_files": 2
            },
            "repository": {
                "full_name": "shraddha-2332/Release-Risk-Prediction"
            }
        }
    },
    "hotfix": {
        "event": "pull_request",
        "payload": {
            "action": "opened",
            "number": 206,
            "pull_request": {
                "number": 206,
                "title": "HOTFIX: critical memory leak in websocket connection handler",
                "body": "Fixes production crash issue #892 where zombie sockets starved server memory under heavy traffic.",
                "user": {"login": "sre-lead"},
                "head": {
                    "ref": "hotfix/memory-leak",
                    "sha": "e77aa10"
                },
                "additions": 610,
                "deletions": 180,
                "changed_files": 11
            },
            "repository": {
                "full_name": "shraddha-2332/Release-Risk-Prediction"
            }
        }
    }
}


def send_webhook(scenario: str, server_url: str = "http://127.0.0.1:8080/api/webhook/github"):
    if scenario not in SCENARIOS:
        print(f"Unknown scenario '{scenario}'. Choose from: {list(SCENARIOS.keys())}")
        sys.exit(1)

    data = SCENARIOS[scenario]
    print(f"\n[simulate_webhook] Firing GitHub '{data['event']}' Webhook -> {server_url}")
    print(f"[simulate_webhook] Scenario: {scenario.upper()}")
    print(f"[simulate_webhook] PR Title: {data['payload']['pull_request']['title']}")
    print(f"[simulate_webhook] Author:   {data['payload']['pull_request']['user']['login']}")
    print(f"[simulate_webhook] Changes:  +{data['payload']['pull_request']['additions']} / -{data['payload']['pull_request']['deletions']} ({data['payload']['pull_request']['changed_files']} files)")

    try:
        headers = {
            "Content-Type": "application/json",
            "X-GitHub-Event": data["event"],
            "User-Agent": "GitHub-Hookshot/1.0"
        }
        resp = requests.post(server_url, json=data["payload"], headers=headers, timeout=10)

        if resp.status_code == 200:
            res_json = resp.json()
            rel = res_json.get("release", {})
            pred = rel.get("prediction", {})
            print(f"\n[simulate_webhook] SUCCESS (HTTP 200)!")
            print(f"  Release ID  : {rel.get('id')}")
            print(f"  Risk Score  : {int(pred.get('score', 0) * 100)}%")
            print(f"  Verdict     : {pred.get('action')}")
            print(f"  Decision    : {pred.get('headline')}")
            print(f"  Top SHAP    : {pred.get('top_factors')}")
            print(f"\n-> Refresh http://localhost:8080 to see this release live in the cockpit!\n")
        else:
            print(f"[simulate_webhook] FAILED: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"[simulate_webhook] Connection error: {e}")
        print("Make sure the backend server is running on port 8080.")


def main():
    parser = argparse.ArgumentParser(description="Simulate real GitHub webhook events.")
    parser.add_argument("--scenario", default="risky", choices=["safe", "risky", "hotfix"],
                        help="Pre-configured GitHub PR scenario")
    parser.add_argument("--url", default="http://127.0.0.1:8080/api/webhook/github",
                        help="Webhook receiver URL")
    args = parser.parse_args()
    send_webhook(args.scenario, args.url)


if __name__ == "__main__":
    main()

