"""Automated OpenAPI <-> pytest validation report generator.

Usage (from the backend/ directory, using the project's own venv):

    .venv/Scripts/python.exe scripts/generate_api_report.py      (Windows)
    .venv/bin/python scripts/generate_api_report.py               (macOS/Linux)

What it does, in order:

1. Regenerates openapi.yaml directly from the live FastAPI app object (so it can
   never go stale) and parses every operation out of it - method, path template,
   and documented response status codes. Nothing about the 24 current endpoints
   is hardcoded; add or remove a route and the next run picks it up automatically.
2. Runs the full pytest suite as a subprocess. tests/conftest.py patches
   TestClient.request() once (see the comment there) to record every real HTTP
   call any test makes - method, concrete path, status code, and which test made
   it - to reports/api_execution_results.json.
3. Maps every captured concrete path (e.g. "/api/v1/tickets/abc123") back to its
   OpenAPI template (e.g. "/api/v1/tickets/{ticket_id}") and aggregates observed
   status codes per (method, template).
4. Compares documented vs. observed statuses per operation and classifies each
   as PASS / MISMATCH / NOT TESTED, then renders a self-contained HTML report.
"""

from __future__ import annotations

import html
import json
import re
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import yaml

BACKEND_DIR = Path(__file__).resolve().parent.parent
OPENAPI_YAML_PATH = BACKEND_DIR / "openapi.yaml"
REPORTS_DIR = BACKEND_DIR / "reports"
EXECUTIONS_JSON_PATH = REPORTS_DIR / "api_execution_results.json"
REPORT_HTML_PATH = REPORTS_DIR / "api_validation_report.html"

HTTP_METHODS = {"get", "post", "put", "patch", "delete", "options", "head"}


# ===================================================================================
# Step 1 - regenerate + parse the OpenAPI YAML
# ===================================================================================


def regenerate_openapi_yaml() -> None:
    """Always regenerated from the live app, never hand-maintained, so it can't drift
    out of sync with the actual routes/schemas."""
    sys.path.insert(0, str(BACKEND_DIR))
    from app.main import app  # imported lazily so this script works from any cwd

    with OPENAPI_YAML_PATH.open("w", encoding="utf-8") as f:
        yaml.safe_dump(app.openapi(), f, sort_keys=False)


_PARAM_RE = re.compile(r"\{[^/}]+\}")


def _compile_path_regex(path_template: str) -> re.Pattern:
    """Turn '/api/v1/tickets/{ticket_id}' into a regex matching any concrete path
    with a single non-slash segment in place of {ticket_id}."""
    parts: list[str] = []
    last_end = 0
    for m in _PARAM_RE.finditer(path_template):
        parts.append(re.escape(path_template[last_end : m.start()]))
        parts.append(r"[^/]+")
        last_end = m.end()
    parts.append(re.escape(path_template[last_end:]))
    return re.compile("^" + "".join(parts) + "$")


@dataclass
class OpenApiOperation:
    method: str
    path: str
    expected_statuses: set[str]
    regex: re.Pattern = field(repr=False)


def load_openapi_operations() -> list[OpenApiOperation]:
    with OPENAPI_YAML_PATH.open(encoding="utf-8") as f:
        spec = yaml.safe_load(f)

    operations: list[OpenApiOperation] = []
    for path, path_item in (spec.get("paths") or {}).items():
        if not isinstance(path_item, dict):
            continue
        for method, operation in path_item.items():
            if method.lower() not in HTTP_METHODS or not isinstance(operation, dict):
                continue
            responses = operation.get("responses") or {}
            expected = {str(code) for code in responses if str(code).isdigit()}
            operations.append(
                OpenApiOperation(
                    method=method.upper(),
                    path=path,
                    expected_statuses=expected,
                    regex=_compile_path_regex(path),
                )
            )
    return operations


# ===================================================================================
# Step 2 - normalize / match a concrete runtime path back to an OpenAPI template
# ===================================================================================


def match_operation(
    method: str, path: str, operations: list[OpenApiOperation]
) -> OpenApiOperation | None:
    path_only = path.split("?", 1)[0]
    method_upper = method.upper()
    candidates = [
        op for op in operations if op.method == method_upper and op.regex.match(path_only)
    ]
    if not candidates:
        return None
    # Prefer the most specific template (fewest {parameters}) in the rare case of overlap.
    candidates.sort(key=lambda op: op.path.count("{"))
    return candidates[0]


# ===================================================================================
# Step 3 & 5 - run pytest (tests/conftest.py does the actual capturing)
# ===================================================================================


def run_pytest_suite() -> int:
    print("=" * 70)
    print("Running full pytest suite (this also captures every API call made)...")
    print("=" * 70)
    result = subprocess.run([sys.executable, "-m", "pytest"], cwd=BACKEND_DIR)
    return result.returncode


def load_executions() -> list[dict]:
    if not EXECUTIONS_JSON_PATH.exists():
        raise SystemExit(
            f"{EXECUTIONS_JSON_PATH} was not created - tests/conftest.py's "
            "pytest_sessionfinish hook did not run. Was pytest actually executed?"
        )
    with EXECUTIONS_JSON_PATH.open(encoding="utf-8") as f:
        return (json.load(f) or {}).get("executions", [])


# ===================================================================================
# Step 6, 7, 8 - aggregate observed statuses per operation and classify the result
# ===================================================================================


@dataclass
class OperationResult:
    method: str
    path: str
    expected: set[str]
    observed: set[str] = field(default_factory=set)
    executions: list[dict] = field(default_factory=list)

    @property
    def undocumented(self) -> set[str]:
        return self.observed - self.expected

    @property
    def untested_documented(self) -> set[str]:
        return self.expected - self.observed

    @property
    def status(self) -> str:
        if not self.executions:
            return "NOT TESTED"
        if self.undocumented:
            return "MISMATCH"
        return "PASS"

    def tests_by_status(self) -> dict[str, list[str]]:
        grouped: dict[str, list[str]] = defaultdict(list)
        for execution in self.executions:
            status = str(execution["status"])
            test_id = execution["test"]
            if test_id not in grouped[status]:
                grouped[status].append(test_id)
        return grouped


def build_operation_results(
    operations: list[OpenApiOperation], executions: list[dict]
) -> tuple[list[OperationResult], int]:
    results: dict[tuple[str, str], OperationResult] = {
        (op.method, op.path): OperationResult(op.method, op.path, set(op.expected_statuses))
        for op in operations
    }

    unmapped = 0
    for execution in executions:
        op = match_operation(execution["method"], execution["path"], operations)
        if op is None:
            # Not part of the OpenAPI operations under test - excluded per spec.
            unmapped += 1
            continue
        result = results[(op.method, op.path)]
        result.observed.add(str(execution["status"]))
        result.executions.append(execution)

    return list(results.values()), unmapped


# ===================================================================================
# Step 11-13 - render the self-contained HTML report
# ===================================================================================

_STATUS_ROW_CLASS = {"PASS": "row-pass", "MISMATCH": "row-mismatch", "NOT TESTED": "row-nottested"}
_STATUS_BADGE_CLASS = {"PASS": "badge-pass", "MISMATCH": "badge-mismatch", "NOT TESTED": "badge-nottested"}


def _fmt_statuses(statuses: set[str]) -> str:
    return ", ".join(sorted(statuses, key=lambda s: (len(s), s))) if statuses else "—"


def _esc(value: str) -> str:
    return html.escape(str(value), quote=True)


def render_html(
    results: list[OperationResult],
    *,
    total_calls_captured: int,
    unmapped_calls: int,
    pytest_exit_code: int,
    generated_at: datetime,
) -> str:
    total_ops = len(results)
    executed = sum(1 for r in results if r.executions)
    not_tested = total_ops - executed
    mismatches = sum(1 for r in results if r.status == "MISMATCH")
    passes = sum(1 for r in results if r.status == "PASS")
    without_mismatches = total_ops - mismatches

    total_unique_expected = len({s for r in results for s in r.expected})
    total_observed_combos = sum(len(r.observed) for r in results)
    total_undocumented_combos = sum(len(r.undocumented) for r in results)

    # --- main table rows ---------------------------------------------------------
    rows_html: list[str] = []
    for i, r in enumerate(results, start=1):
        row_class = _STATUS_ROW_CLASS[r.status]
        badge_class = _STATUS_BADGE_CLASS[r.status]
        rows_html.append(
            f"""
            <tr class="{row_class}">
              <td class="col-num">{i}</td>
              <td class="col-op"><span class="method method-{_esc(r.method.lower())}">{_esc(r.method)}</span> {_esc(r.path)}</td>
              <td class="col-statuses">{_esc(_fmt_statuses(r.expected))}</td>
              <td class="col-statuses">{_esc(_fmt_statuses(r.observed))}</td>
              <td class="col-statuses">{_esc(_fmt_statuses(r.undocumented))}</td>
              <td class="col-result"><span class="badge {badge_class}">{r.status}</span></td>
            </tr>"""
        )

    # --- mismatch detail section ---------------------------------------------------
    mismatch_results = [r for r in results if r.status == "MISMATCH"]
    if mismatch_results:
        mismatch_blocks = []
        for r in mismatch_results:
            grouped = r.tests_by_status()
            status_blocks = []
            for status in sorted(r.undocumented, key=lambda s: (len(s), s)):
                tests = grouped.get(status, [])
                items = "\n".join(f"<li><code>{_esc(t)}</code></li>" for t in tests)
                status_blocks.append(
                    f"""
                    <div class="undoc-status">
                      <div class="undoc-status-label">{_esc(status)}:</div>
                      <ul>{items}</ul>
                    </div>"""
                )
            mismatch_blocks.append(
                f"""
                <div class="mismatch-card">
                  <h3><span class="method method-{_esc(r.method.lower())}">{_esc(r.method)}</span> {_esc(r.path)}</h3>
                  <table class="mismatch-meta">
                    <tr><th>OpenAPI statuses</th><td>{_esc(_fmt_statuses(r.expected))}</td></tr>
                    <tr><th>Observed statuses</th><td>{_esc(_fmt_statuses(r.observed))}</td></tr>
                    <tr><th>Undocumented statuses</th><td class="undoc-cell">{_esc(_fmt_statuses(r.undocumented))}</td></tr>
                  </table>
                  <div class="undoc-tests-label">Tests producing undocumented statuses:</div>
                  {''.join(status_blocks)}
                </div>"""
            )
        mismatch_section = f"""
        <h2>API Documentation Mismatches</h2>
        <p class="section-note">Every operation below returned at least one status code during testing
        that is <strong>not</strong> listed in its OpenAPI <code>responses</code>. This is real, observed
        behavior proving the documentation is incomplete - not a test-coverage gap.</p>
        {''.join(mismatch_blocks)}
        """
    else:
        mismatch_section = """
        <h2>API Documentation Mismatches</h2>
        <p class="section-note section-note-good">No mismatches found - every status code observed during
        testing is documented in the OpenAPI spec.</p>
        """

    # --- not-tested section ---------------------------------------------------------
    not_tested_results = [r for r in results if r.status == "NOT TESTED"]
    if not_tested_results:
        items = "\n".join(
            f'<li><span class="method method-{_esc(r.method.lower())}">{_esc(r.method)}</span> {_esc(r.path)}</li>'
            for r in not_tested_results
        )
        not_tested_section = f"""
        <h2>OpenAPI Operations Not Exercised by Tests</h2>
        <p class="section-note">These operations exist in the OpenAPI spec but no captured test request
        matched them at all - not even once. This is a test-coverage gap, not an API mismatch.</p>
        <ul class="not-tested-list">{items}</ul>
        """
    else:
        not_tested_section = """
        <h2>OpenAPI Operations Not Exercised by Tests</h2>
        <p class="section-note section-note-good">Every OpenAPI operation was exercised by at least one test.</p>
        """

    pytest_note = (
        ""
        if pytest_exit_code == 0
        else f'<p class="section-note section-note-warn">Note: the pytest run exited with code '
        f"{pytest_exit_code} (one or more tests failed) - the report below still reflects every "
        f"request that was actually captured.</p>"
    )

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>API Validation Report</title>
<style>
{_CSS}
</style>
</head>
<body>
<div class="wrap">
  <header class="report-header">
    <h1>API Validation Report</h1>
    <div class="report-meta">Generated {_esc(generated_at.strftime('%Y-%m-%d %H:%M:%S UTC'))} &middot; Simplifix backend</div>
  </header>

  {pytest_note}

  <h2>Endpoint Execution Distribution</h2>
  <p class="section-note">A total of {total_ops} OpenAPI operations underwent validation. {executed}
  operation{'s' if executed != 1 else ''} were exercised by the automated test suite, while {not_tested}
  operation{'s' if not_tested != 1 else ''} were not executed.</p>

  <div class="stats-grid">
    <div class="stat-card"><div class="stat-value">{total_ops}</div><div class="stat-label">Total OpenAPI Operations</div></div>
    <div class="stat-card"><div class="stat-value">{executed}</div><div class="stat-label">Operations Executed</div></div>
    <div class="stat-card"><div class="stat-value">{not_tested}</div><div class="stat-label">Operations Not Tested</div></div>
    <div class="stat-card stat-bad"><div class="stat-value">{mismatches}</div><div class="stat-label">Operations With API Mismatches</div></div>
    <div class="stat-card stat-good"><div class="stat-value">{without_mismatches}</div><div class="stat-label">Operations Without API Mismatches</div></div>
    <div class="stat-card"><div class="stat-value">{total_calls_captured}</div><div class="stat-label">Total Runtime API Calls Captured</div></div>
    <div class="stat-card"><div class="stat-value">{total_unique_expected}</div><div class="stat-label">Unique Documented Statuses</div></div>
    <div class="stat-card"><div class="stat-value">{total_observed_combos}</div><div class="stat-label">Unique Endpoint/Status Combos Observed</div></div>
    <div class="stat-card stat-bad"><div class="stat-value">{total_undocumented_combos}</div><div class="stat-label">Undocumented Endpoint/Status Combos</div></div>
  </div>

  <h2>Endpoint Table</h2>
  <table class="main-table">
    <thead>
      <tr>
        <th class="col-num">#</th>
        <th class="col-op">API Operation</th>
        <th class="col-statuses">Expected Statuses</th>
        <th class="col-statuses">Observed Statuses</th>
        <th class="col-statuses">Undocumented Statuses</th>
        <th class="col-result">Result</th>
      </tr>
    </thead>
    <tbody>
      {''.join(rows_html)}
    </tbody>
  </table>

  {mismatch_section}

  {not_tested_section}

  <footer class="report-footer">
    PASS: {passes} &middot; MISMATCH: {mismatches} &middot; NOT TESTED: {not_tested}
    {f'&middot; {unmapped_calls} captured call(s) excluded (did not map to any OpenAPI operation)' if unmapped_calls else ''}
  </footer>
</div>
</body>
</html>
"""


_CSS = """
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #1a1a1a;
  background: #f4f6f5;
  margin: 0;
  padding: 24px;
  font-size: 14px;
  line-height: 1.5;
}
.wrap { max-width: 1200px; margin: 0 auto; }
.report-header {
  background: #1e7a3d;
  color: #ffffff;
  padding: 24px 28px;
  border-radius: 8px 8px 0 0;
}
.report-header h1 { margin: 0 0 4px 0; font-size: 26px; font-weight: 700; }
.report-meta { font-size: 13px; opacity: 0.9; }
h2 {
  margin-top: 32px;
  font-size: 19px;
  border-left: 5px solid #1e7a3d;
  padding-left: 10px;
}
.section-note { color: #444; max-width: 900px; }
.section-note-good { color: #1e7a3d; font-weight: 600; }
.section-note-warn { color: #8a5a00; background: #fff6e5; border: 1px solid #f0d38a; padding: 10px 14px; border-radius: 6px; }
code { background: #eef0ef; padding: 1px 5px; border-radius: 4px; font-size: 12.5px; }

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin: 16px 0 8px 0;
}
.stat-card {
  background: #ffffff;
  border: 1px solid #dfe3e1;
  border-radius: 8px;
  padding: 14px 16px;
  text-align: center;
}
.stat-value { font-size: 26px; font-weight: 700; color: #1e7a3d; }
.stat-bad .stat-value { color: #b3261e; }
.stat-good .stat-value { color: #1e7a3d; }
.stat-label { font-size: 12px; color: #666; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.03em; }

table.main-table, table.mismatch-meta {
  width: 100%;
  border-collapse: collapse;
  background: #ffffff;
}
table.main-table { table-layout: fixed; }
table.main-table thead th {
  background: #1e7a3d;
  color: #ffffff;
  font-weight: 700;
  text-align: left;
  padding: 10px 12px;
  font-size: 13px;
}
table.main-table thead { display: table-header-group; }
table.main-table tr { break-inside: avoid; page-break-inside: avoid; }
table.main-table td, table.main-table th {
  border: 1px solid #d7dbd9;
  padding: 9px 12px;
  vertical-align: top;
  word-wrap: break-word;
  overflow-wrap: break-word;
}
table.main-table .col-num { width: 42px; text-align: center; }
table.main-table .col-op { width: 30%; }
table.main-table .col-statuses { width: 18%; font-size: 13px; font-family: "SFMono-Regular", Consolas, monospace; }
table.main-table .col-result { width: 110px; text-align: center; }

tr.row-pass { background: #eaf7ee; }
tr.row-mismatch { background: #fdecec; }
tr.row-nottested { background: #fbf6e3; }
tr.row-pass:nth-child(even) { background: #dff2e4; }
tr.row-mismatch:nth-child(even) { background: #fbdede; }
tr.row-nottested:nth-child(even) { background: #f7eecb; }

.badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 0.02em; }
.badge-pass { background: #1e7a3d; color: #ffffff; }
.badge-mismatch { background: #b3261e; color: #ffffff; }
.badge-nottested { background: #8a7a1e; color: #ffffff; }

.method { display: inline-block; font-weight: 700; font-size: 11px; padding: 2px 6px; border-radius: 4px; margin-right: 4px; color: #fff; }
.method-get { background: #2563eb; }
.method-post { background: #16a34a; }
.method-put { background: #ca8a04; }
.method-patch { background: #9333ea; }
.method-delete { background: #dc2626; }
.method-options, .method-head { background: #64748b; }

.mismatch-card {
  background: #ffffff;
  border: 1px solid #f2c6c2;
  border-left: 5px solid #b3261e;
  border-radius: 8px;
  padding: 16px 18px;
  margin: 14px 0;
}
.mismatch-card h3 { margin: 0 0 10px 0; font-size: 15px; }
table.mismatch-meta { margin-bottom: 10px; }
table.mismatch-meta th { text-align: left; width: 200px; padding: 4px 8px; color: #555; font-weight: 600; background: none; border: none; }
table.mismatch-meta td { padding: 4px 8px; border: none; font-family: "SFMono-Regular", Consolas, monospace; }
.undoc-cell { color: #b3261e; font-weight: 700; }
.undoc-tests-label { font-weight: 700; margin: 10px 0 4px 0; }
.undoc-status { margin: 6px 0 6px 10px; }
.undoc-status-label { font-weight: 700; color: #b3261e; }
.undoc-status ul { margin: 4px 0 0 0; padding-left: 22px; }
.undoc-status li { margin: 2px 0; }

.not-tested-list { columns: 2; column-gap: 32px; }
.not-tested-list li { margin: 4px 0; break-inside: avoid; }

.report-footer { margin: 28px 0 12px 0; padding-top: 12px; border-top: 1px solid #d7dbd9; color: #555; font-size: 13px; }

@media print {
  body { background: #fff; }
  .stat-card, .mismatch-card { break-inside: avoid; }
}
"""


# ===================================================================================
# Step 17 - orchestration + terminal summary
# ===================================================================================


def main() -> int:
    REPORTS_DIR.mkdir(exist_ok=True)

    print("Step 1: regenerating openapi.yaml from the live app and parsing operations...")
    regenerate_openapi_yaml()
    operations = load_openapi_operations()
    print(f"Total OpenAPI operations: {len(operations)}")
    for op in operations:
        expected = ", ".join(sorted(op.expected_statuses, key=lambda s: (len(s), s))) or "(none)"
        print(f"  {op.method:<7} {op.path:<55} expected=[{expected}]")

    pytest_exit_code = run_pytest_suite()

    print("\nStep 6: loading captured executions and mapping to OpenAPI operations...")
    executions = load_executions()
    results, unmapped = build_operation_results(operations, executions)

    print("Step 11: rendering HTML report...")
    report_html = render_html(
        results,
        total_calls_captured=len(executions),
        unmapped_calls=unmapped,
        pytest_exit_code=pytest_exit_code,
        generated_at=datetime.now(timezone.utc),
    )
    REPORT_HTML_PATH.write_text(report_html, encoding="utf-8")

    total_ops = len(results)
    executed = sum(1 for r in results if r.executions)
    not_tested = total_ops - executed
    mismatches = sum(1 for r in results if r.status == "MISMATCH")

    print()
    print("=" * 50)
    print("API VALIDATION REPORT")
    print("=" * 50)
    print()
    print(f"OpenAPI operations:        {total_ops}")
    print(f"Operations executed:       {executed}")
    print(f"Operations not tested:     {not_tested}")
    print(f"API mismatches:            {mismatches}")
    print(f"Runtime API calls:         {len(executions)}")
    print()
    print("Report:")
    print(f"{REPORT_HTML_PATH.relative_to(BACKEND_DIR)}")
    print()
    print("=" * 50)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
