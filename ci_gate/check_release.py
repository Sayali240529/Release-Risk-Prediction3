"""
check_release.py
CLI gate script. Takes a JSON file of release features, scores it,
and exits 0 (safe) or 1 (blocked) so it can be used in any CI pipeline.
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from model.predict_api import predict


def main():
    parser = argparse.ArgumentParser(description="Release Risk CI gate")
    parser.add_argument("--input", required=True, help="Path to JSON file with release features")
    parser.add_argument("--threshold", type=float, default=0.35, help="Risk threshold")
    args = parser.parse_args()

    features = json.loads(Path(args.input).read_text(encoding="utf-8"))
    result = predict(features)

    score = result["score"]
    action = result["action"]
    pct = int(score * 100)

    print("\n" + "=" * 55)
    print("  Release Risk Gate")
    print(f"  Score    : {pct}%")
    print(f"  Action   : {action}")
    print(f"  Decision : {result['headline']}")
    print("\n  Top Risk Drivers:")
    for label, val in result["top_factors"]:
        direction = "+" if val >= 0 else ""
        print(f"    {direction}{val:.3f}  {label}")
    print("=" * 55 + "\n")

    if action == "AUTO_PROMOTE":
        print("GATE: PASSED -- deployment may proceed.")
        sys.exit(0)
    else:
        print("GATE: BLOCKED -- deployment requires review.")
        sys.exit(1)


if __name__ == "__main__":
    main()

