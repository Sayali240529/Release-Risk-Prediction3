"""
ci_features.py
Parses CI build log text and extracts numerical risk signals.
"""

import re
from pathlib import Path

_WARN_RE = re.compile(r"\b(WARNING|WARN|DeprecationWarning)\b", re.I)
_ERROR_RE = re.compile(r"\b(ERROR|FATAL|CRITICAL|FAILED)\b", re.I)
_STACK_RE = re.compile(r"(Traceback|at [a-zA-Z]+\.[a-zA-Z]+\()", re.I)
_TIMEOUT_RE = re.compile(r"\b(timeout|timed out|connection reset)\b", re.I)
_OOM_RE = re.compile(r"\b(OutOfMemory|OOMKilled|Killed|heap space)\b", re.I)
_FLAKY_RE = re.compile(r"\b(flaky|retry|rerun|intermittent)\b", re.I)
_DURATION_RE = re.compile(r"(?:Tests run|Finished in)[^\d]*(\d+[\.,]?\d*)\s*s", re.I)


def parse_ci_log(log_text: str, baseline_duration: float = 60.0) -> dict:
    """
    Parse a raw CI log string and return a feature dict.
    """
    lines = log_text.splitlines()

    warning_count = sum(1 for ln in lines if _WARN_RE.search(ln))
    error_count = sum(1 for ln in lines if _ERROR_RE.search(ln))
    stack_trace = int(any(_STACK_RE.search(ln) for ln in lines))
    timeout_flag = int(any(_TIMEOUT_RE.search(ln) for ln in lines))
    oom_flag = int(any(_OOM_RE.search(ln) for ln in lines))
    flaky_flag = int(any(_FLAKY_RE.search(ln) for ln in lines))

    durations = _DURATION_RE.findall(log_text)
    if durations:
        test_duration = float(durations[-1].replace(",", "."))
    else:
        test_duration = baseline_duration

    duration_delta = round((test_duration - baseline_duration) / max(baseline_duration, 1.0), 4)

    return {
        "ci_warning_count": warning_count,
        "ci_error_count": error_count,
        "ci_test_duration_s": round(test_duration, 2),
        "ci_test_duration_delta": duration_delta,
        "ci_flaky_test_flag": flaky_flag,
        "ci_stack_trace_flag": stack_trace,
        "ci_timeout_flag": timeout_flag,
        "ci_oom_flag": oom_flag,
    }


def parse_ci_log_file(filepath: str, baseline_duration: float = 60.0) -> dict:
    """Convenience wrapper - reads a .log or .txt file then calls parse_ci_log."""
    text = Path(filepath).read_text(encoding="utf-8", errors="ignore")
    return parse_ci_log(text, baseline_duration)

