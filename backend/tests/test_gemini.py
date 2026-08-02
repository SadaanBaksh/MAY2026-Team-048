"""Direct unit tests for app/core/gemini.py - the layer that has actually broken in
production more than once this project (deprecated model, thinking-budget token
exhaustion, malformed JSON), yet every endpoint test monkeypatches generate_json()/
generate_multimodal_json() themselves and never exercises this module at all."""

import io
import json
from urllib.error import HTTPError, URLError

import pytest
from fastapi import HTTPException

from app.core import gemini


class _FakeResponse:
    """Stands in for the object urlopen() yields as a context manager."""

    def __init__(self, body: bytes, content_type: str | None = None):
        self._body = body
        if content_type is not None:
            from types import SimpleNamespace

            self.headers = SimpleNamespace(get_content_type=lambda: content_type)

    def read(self, size: int = -1) -> bytes:
        return self._body if size is None or size < 0 else self._body[:size]

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


def _gemini_response(text: str) -> bytes:
    return json.dumps(
        {"candidates": [{"content": {"parts": [{"text": text}]}}]}
    ).encode("utf-8")


def _configure_gemini(monkeypatch, api_key: str = "test-key") -> None:
    monkeypatch.setattr(gemini.settings, "GEMINI_API_KEY", api_key)


def _configure_s3(monkeypatch, bucket: str = "test-bucket", region: str = "us-east-1") -> None:
    monkeypatch.setattr(gemini.settings, "S3_BUCKET_NAME", bucket)
    monkeypatch.setattr(gemini.settings, "AWS_REGION", region)


# --- _request_json ---------------------------------------------------------------


def test_request_json_requires_api_key(monkeypatch):
    _configure_gemini(monkeypatch, api_key="")
    with pytest.raises(gemini.GeminiError, match="not configured"):
        gemini._request_json({})


def test_request_json_success(monkeypatch):
    _configure_gemini(monkeypatch)
    monkeypatch.setattr(gemini, "urlopen", lambda *a, **k: _FakeResponse(b'{"ok": true}'))
    assert gemini._request_json({"contents": []}) == {"ok": True}


def test_request_json_rate_limited(monkeypatch):
    _configure_gemini(monkeypatch)

    def _raise(*args, **kwargs):
        raise HTTPError("url", 429, "Too Many Requests", hdrs=None, fp=io.BytesIO(b"{}"))

    monkeypatch.setattr(gemini, "urlopen", _raise)
    with pytest.raises(gemini.GeminiError, match="temporarily busy"):
        gemini._request_json({})


def test_request_json_http_error_surfaces_provider_status(monkeypatch):
    _configure_gemini(monkeypatch)
    body = json.dumps({"error": {"status": "NOT_FOUND"}}).encode()

    def _raise(*args, **kwargs):
        raise HTTPError("url", 404, "Not Found", hdrs=None, fp=io.BytesIO(body))

    monkeypatch.setattr(gemini, "urlopen", _raise)
    with pytest.raises(gemini.GeminiError, match=r"HTTP 404 \(NOT_FOUND\)"):
        gemini._request_json({})


def test_request_json_http_error_without_parseable_body(monkeypatch):
    _configure_gemini(monkeypatch)

    def _raise(*args, **kwargs):
        raise HTTPError("url", 500, "Server Error", hdrs=None, fp=io.BytesIO(b"not json"))

    monkeypatch.setattr(gemini, "urlopen", _raise)
    with pytest.raises(gemini.GeminiError, match="HTTP 500"):
        gemini._request_json({})


def test_request_json_network_error(monkeypatch):
    _configure_gemini(monkeypatch)

    def _raise(*args, **kwargs):
        raise URLError("no route to host")

    monkeypatch.setattr(gemini, "urlopen", _raise)
    with pytest.raises(gemini.GeminiError, match="currently unavailable"):
        gemini._request_json({})


# --- _response_text ---------------------------------------------------------------


def test_response_text_extracts_and_joins_parts():
    response = {"candidates": [{"content": {"parts": [{"text": "hello "}, {"text": "world"}]}}]}
    assert gemini._response_text(response) == "hello world"


def test_response_text_missing_candidates_raises():
    with pytest.raises(gemini.GeminiError, match="incomplete response"):
        gemini._response_text({})


def test_response_text_empty_text_raises():
    response = {"candidates": [{"content": {"parts": [{"text": "   "}]}}]}
    with pytest.raises(gemini.GeminiError, match="empty response"):
        gemini._response_text(response)


# --- generate_json / generate_multimodal_json --------------------------------------


def test_generate_json_returns_parsed_result(monkeypatch):
    _configure_gemini(monkeypatch)
    monkeypatch.setattr(
        gemini, "urlopen", lambda *a, **k: _FakeResponse(_gemini_response('{"reply": "hi"}'))
    )
    assert gemini.generate_json(prompt="p", schema={}, max_output_tokens=10) == {"reply": "hi"}


def test_generate_json_non_json_text_raises(monkeypatch):
    _configure_gemini(monkeypatch)
    monkeypatch.setattr(
        gemini, "urlopen", lambda *a, **k: _FakeResponse(_gemini_response("not json"))
    )
    with pytest.raises(gemini.GeminiError, match="invalid response"):
        gemini.generate_json(prompt="p", schema={}, max_output_tokens=10)


def test_generate_multimodal_json_returns_parsed_result(monkeypatch):
    _configure_gemini(monkeypatch)
    monkeypatch.setattr(
        gemini, "urlopen", lambda *a, **k: _FakeResponse(_gemini_response('{"a": 1}'))
    )
    assert gemini.generate_multimodal_json(prompt="p", media=[], schema={}) == {"a": 1}


def test_generate_multimodal_json_non_json_text_raises(monkeypatch):
    _configure_gemini(monkeypatch)
    monkeypatch.setattr(
        gemini, "urlopen", lambda *a, **k: _FakeResponse(_gemini_response("nope"))
    )
    with pytest.raises(gemini.GeminiError, match="invalid response"):
        gemini.generate_multimodal_json(prompt="p", media=[], schema={})


# --- _approved_s3_url --------------------------------------------------------------


def test_approved_s3_url_accepts_matching_host(monkeypatch):
    _configure_s3(monkeypatch)
    gemini._approved_s3_url("https://test-bucket.s3.us-east-1.amazonaws.com/photos/x.jpg")


def test_approved_s3_url_rejects_foreign_host(monkeypatch):
    _configure_s3(monkeypatch)
    with pytest.raises(HTTPException) as exc_info:
        gemini._approved_s3_url("https://evil.example.com/x.jpg")
    assert exc_info.value.status_code == 422


def test_approved_s3_url_rejects_non_https(monkeypatch):
    _configure_s3(monkeypatch)
    with pytest.raises(HTTPException):
        gemini._approved_s3_url("http://test-bucket.s3.us-east-1.amazonaws.com/x.jpg")


def test_approved_s3_url_rejects_when_bucket_unconfigured(monkeypatch):
    _configure_s3(monkeypatch, bucket="")
    with pytest.raises(HTTPException):
        gemini._approved_s3_url("https://anything.s3.us-east-1.amazonaws.com/x.jpg")


# --- media_part --------------------------------------------------------------------

_S3_URL = "https://test-bucket.s3.us-east-1.amazonaws.com/photos/x.jpg"


def test_media_part_rejects_unsupported_content_type(monkeypatch):
    _configure_s3(monkeypatch)
    monkeypatch.setattr(gemini, "urlopen", lambda *a, **k: _FakeResponse(b"data", "text/plain"))
    with pytest.raises(HTTPException) as exc_info:
        gemini.media_part(_S3_URL, max_bytes=100)
    assert exc_info.value.status_code == 422


def test_media_part_rejects_oversized_content(monkeypatch):
    _configure_s3(monkeypatch)
    monkeypatch.setattr(
        gemini, "urlopen", lambda *a, **k: _FakeResponse(b"x" * 200, "image/jpeg")
    )
    with pytest.raises(HTTPException) as exc_info:
        gemini.media_part(_S3_URL, max_bytes=100)
    assert exc_info.value.status_code == 413


def test_media_part_wraps_download_failure(monkeypatch):
    _configure_s3(monkeypatch)

    def _raise(*a, **k):
        raise URLError("boom")

    monkeypatch.setattr(gemini, "urlopen", _raise)
    with pytest.raises(HTTPException) as exc_info:
        gemini.media_part(_S3_URL, max_bytes=100)
    assert exc_info.value.status_code == 422


def test_media_part_success_returns_base64_inline_data(monkeypatch):
    import base64

    _configure_s3(monkeypatch)
    monkeypatch.setattr(
        gemini, "urlopen", lambda *a, **k: _FakeResponse(b"fake-bytes", "image/jpeg")
    )
    part = gemini.media_part(_S3_URL, max_bytes=100)
    assert part["inlineData"]["mimeType"] == "image/jpeg"
    assert base64.b64decode(part["inlineData"]["data"]) == b"fake-bytes"
