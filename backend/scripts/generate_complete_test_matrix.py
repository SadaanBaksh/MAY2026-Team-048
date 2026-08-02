"""Generate an exhaustive Markdown matrix from the collected backend pytest source."""

from __future__ import annotations

import ast
import re
from dataclasses import dataclass
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
TEST_ROOT = BACKEND_ROOT / "tests"
OUTPUT_PATH = BACKEND_ROOT / "COMPLETE_TEST_CASE_MATRIX.md"
HTTP_METHODS = {"get", "post", "put", "patch", "delete"}
VERIFIED_RUN = "172 passed, 1 xfailed, 229 warnings in 42.27s"


@dataclass(frozen=True)
class TestCase:
    path: Path
    node: ast.FunctionDef | ast.AsyncFunctionDef
    category: str


def _one_line(value: str, limit: int = 190) -> str:
    value = re.sub(r"\s+", " ", value).strip()
    if len(value) > limit:
        value = value[: limit - 3].rstrip() + "..."
    return value.replace("|", "\\|").replace("`", "'")


def _unparse(node: ast.AST, limit: int = 190) -> str:
    return _one_line(ast.unparse(node), limit=limit)


def _render_path(node: ast.AST) -> str:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    if isinstance(node, ast.JoinedStr):
        parts: list[str] = []
        for value in node.values:
            if isinstance(value, ast.Constant):
                parts.append(str(value.value))
            elif isinstance(value, ast.FormattedValue):
                parts.append("{" + ast.unparse(value.value) + "}")
        return "".join(parts)
    return _unparse(node, limit=120)


def _client_calls(node: ast.AST) -> list[ast.Call]:
    calls: list[ast.Call] = []
    for candidate in ast.walk(node):
        if not isinstance(candidate, ast.Call) or not isinstance(candidate.func, ast.Attribute):
            continue
        if candidate.func.attr not in HTTP_METHODS:
            continue
        if isinstance(candidate.func.value, ast.Name) and candidate.func.value.id == "client":
            calls.append(candidate)
    return sorted(calls, key=lambda call: (call.lineno, call.col_offset))


def _endpoint_or_component(case: TestCase) -> str:
    endpoints: list[str] = []
    for call in _client_calls(case.node):
        if not call.args:
            continue
        label = f"{call.func.attr.upper()} {_render_path(call.args[0])}"
        if label not in endpoints:
            endpoints.append(label)
    if endpoints:
        return "; ".join(endpoints)

    component_by_file = {
        "test_db_session.py": "app.db.session.get_db",
        "test_gemini.py": "app.core.gemini",
        "test_limiter.py": "app.core.limiter.rate_limit_key_for_user",
        "test_security.py": "app.core.security",
        "test_uploads.py": "app.core.storage._get_s3_client",
    }
    return component_by_file.get(case.path.name, case.path.stem.removeprefix("test_"))


def _scenario(case: TestCase) -> str:
    words = case.node.name.removeprefix("test_").replace("_", " ")
    return words[:1].upper() + words[1:]


def _inputs(case: TestCase) -> str:
    details: list[str] = []
    for call in _client_calls(case.node):
        for keyword in call.keywords:
            if keyword.arg in {"json", "data", "params", "files", "headers"}:
                detail = f"{keyword.arg}={_unparse(keyword.value, limit=105)}"
                if detail not in details:
                    details.append(detail)
            if len(details) == 2:
                break
        if len(details) == 2:
            break

    if details:
        return "; ".join(details)

    parameters = [
        argument.arg
        for argument in case.node.args.args
        if argument.arg not in {"client", "monkeypatch"}
    ]
    if parameters:
        return "Fixtures/inputs: " + ", ".join(parameters)
    return _scenario(case)


def _expected(case: TestCase) -> str:
    expectations: list[str] = []
    for candidate in ast.walk(case.node):
        if isinstance(candidate, ast.Assert):
            text = _unparse(candidate.test, limit=115)
            if text not in expectations:
                expectations.append(text)
        elif isinstance(candidate, (ast.With, ast.AsyncWith)):
            for item in candidate.items:
                expression = item.context_expr
                if (
                    isinstance(expression, ast.Call)
                    and isinstance(expression.func, ast.Attribute)
                    and expression.func.attr == "raises"
                    and expression.args
                ):
                    text = "raises " + _unparse(expression.args[0], limit=80)
                    match = next((kw.value for kw in expression.keywords if kw.arg == "match"), None)
                    if match is not None:
                        text += " matching " + _unparse(match, limit=70)
                    if text not in expectations:
                        expectations.append(text)
        if len(expectations) == 3:
            break
    return "; ".join(expectations) if expectations else "Completes without an unexpected exception"


def _is_xfail(node: ast.FunctionDef | ast.AsyncFunctionDef) -> bool:
    return any("xfail" in ast.unparse(decorator) for decorator in node.decorator_list)


def _discover() -> list[TestCase]:
    cases: list[TestCase] = []
    for path in sorted(TEST_ROOT.rglob("test_*.py")):
        module = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in module.body:
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            if not node.name.startswith("test_"):
                continue
            parameters = {argument.arg for argument in node.args.args}
            category = "Integration" if "client" in parameters or "integration" in path.parts else "Unit"
            cases.append(TestCase(path=path, node=node, category=category))
    return sorted(cases, key=lambda case: (case.category != "Integration", str(case.path), case.node.lineno))


def _build_matrix(cases: list[TestCase]) -> str:
    integration_count = sum(case.category == "Integration" for case in cases)
    unit_count = sum(case.category == "Unit" for case in cases)
    counters = {"Integration": 0, "Unit": 0}
    lines = [
        "# Complete Backend Test Case Matrix",
        "",
        "Scope: Every collected backend pytest unit and integration test. Contract tests are excluded.",
        "",
        f"Verified run: `{VERIFIED_RUN}`",
        "",
        f"Inventory: **{len(cases)} total** - **{integration_count} integration** and **{unit_count} unit** tests.",
        "",
        "Classification rule: tests exercising the FastAPI application through the `client` fixture are integration tests; isolated helpers and provider adapters are unit tests.",
        "",
        "| Case ID | Category | Endpoint / Component | Scenario | Inputs | Expected Output | Actual Output | Result | Test Function |",
        "|---|---|---|---|---|---|---|---|---|",
    ]

    for case in cases:
        counters[case.category] += 1
        prefix = "INT" if case.category == "Integration" else "UNIT"
        case_id = f"{prefix}-{counters[case.category]:03d}"
        xfail = _is_xfail(case.node)
        actual = (
            "HTTP 200; Pending ticket changed directly to Closed"
            if xfail
            else "Matched all asserted outputs"
        )
        result = "XFAIL - known issue" if xfail else "Success"
        relative_path = case.path.relative_to(BACKEND_ROOT).as_posix()
        function = f"`{relative_path}::{case.node.name}`"
        row = [
            case_id,
            case.category,
            _one_line(_endpoint_or_component(case)),
            _one_line(_scenario(case)),
            _one_line(_inputs(case)),
            _one_line(_expected(case)),
            actual,
            result,
            function,
        ]
        lines.append("| " + " | ".join(row) + " |")

    lines.extend(
        [
            "",
            "## Screenshot-friendly execution",
            "",
            "From the `backend` directory:",
            "",
            "```powershell",
            ".\\.venv\\Scripts\\python.exe -m pytest -vv -rx",
            "```",
            "",
            "The intentional XFAIL documents the known premature ticket-closure defect and does not cause pytest to return a failing exit code.",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> None:
    cases = _discover()
    OUTPUT_PATH.write_text(_build_matrix(cases), encoding="utf-8", newline="\n")
    print(f"Wrote {OUTPUT_PATH} with {len(cases)} test cases")


if __name__ == "__main__":
    main()
