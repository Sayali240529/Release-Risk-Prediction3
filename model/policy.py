"""
policy.py
Maps a risk score (0.0-1.0) to a deployment action and plain-English reason.
"""

from dataclasses import dataclass


@dataclass
class PolicyResult:
    action: str          # AUTO_PROMOTE | HOLD_CANARY | MANUAL_REVIEW
    badge_color: str     # green | yellow | red
    headline: str        # one-line plain English decision
    detail: str          # one-sentence explanation


_THRESHOLDS = {
    "low": 0.35,
    "high": 0.70,
}


def evaluate_policy(score: float) -> PolicyResult:
    pct = int(score * 100)

    if score < _THRESHOLDS["low"]:
        return PolicyResult(
            action="AUTO_PROMOTE",
            badge_color="green",
            headline=f"Low Risk ({pct}%) - Safe to Deploy",
            detail=(
                "All signals are within normal bounds. "
                "Proceed with full canary rollout automatically."
            ),
        )
    elif score < _THRESHOLDS["high"]:
        return PolicyResult(
            action="HOLD_CANARY",
            badge_color="yellow",
            headline=f"Moderate Risk ({pct}%) - Hold at 5% Canary",
            detail=(
                "One or more signals are elevated. "
                "Limit traffic to 5%, monitor error rates for 30 minutes, "
                "then promote manually if metrics are stable."
            ),
        )
    else:
        return PolicyResult(
            action="MANUAL_REVIEW",
            badge_color="red",
            headline=f"High Risk ({pct}%) - Block Deployment",
            detail=(
                "Multiple high-risk signals detected. "
                "Block this release and request a senior engineer review "
                "before any production traffic is exposed."
            ),
        )

