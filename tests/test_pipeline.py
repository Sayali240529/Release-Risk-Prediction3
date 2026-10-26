"""
test_pipeline.py
Unit tests verifying all 3 modules:
  - Extractor (git, ci, text, dataset_builder)
  - Model (policy, predict_api)
  - CI Gate (check_release)
"""

import unittest
from extractor.ci_features import parse_ci_log
from extractor.text_features import extract_text_features
from extractor.dataset_builder import simulate_dataset
from model.policy import evaluate_policy
from model.predict_api import predict


class TestReleaseRiskPipeline(unittest.TestCase):

    def test_ci_feature_extraction(self):
        log = "WARNING: timeout warning\nERROR: stack trace\nFinished in 90.0 s\n"
        feats = parse_ci_log(log, baseline_duration=60.0)
        self.assertEqual(feats["ci_warning_count"], 1)
        self.assertEqual(feats["ci_error_count"], 1)
        self.assertGreater(feats["ci_test_duration_delta"], 0)

    def test_text_feature_extraction(self):
        text = "Hotfix emergency payment rollback"
        feats = extract_text_features(text)
        self.assertEqual(feats["text_has_hotfix"], 1)
        self.assertGreater(feats["text_risk_score"], 0.5)

    def test_dataset_simulation(self):
        df = simulate_dataset(n_rows=20, seed=123)
        self.assertEqual(len(df), 20)
        self.assertIn("risk_label", df.columns)
        self.assertIn("commit_churn", df.columns)

    def test_policy_logic(self):
        p_low = evaluate_policy(0.20)
        self.assertEqual(p_low.action, "AUTO_PROMOTE")

        p_med = evaluate_policy(0.50)
        self.assertEqual(p_med.action, "HOLD_CANARY")

        p_high = evaluate_policy(0.85)
        self.assertEqual(p_high.action, "MANUAL_REVIEW")

    def test_predict_api_contract(self):
        sample = {
            "commit_churn": 500,
            "files_modified": 8,
            "directory_entropy": 1.2,
            "ci_warning_count": 4,
            "text_risk_score": 0.6,
        }
        res = predict(sample)
        self.assertIn("score", res)
        self.assertIn("action", res)
        self.assertIn("top_factors", res)
        self.assertTrue(0.0 <= res["score"] <= 1.0)
        self.assertEqual(len(res["top_factors"]), 3)


if __name__ == "__main__":
    unittest.main()

