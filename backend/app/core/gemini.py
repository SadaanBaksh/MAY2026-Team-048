"""Dependency-free Gemini-compatible gateway for all Simplifix AI features.

Requests can go directly to Google Gemini or through AI Pipe. Both providers accept the same
``generateContent`` payload, so structured output and multimodal behavior stay consistent.
"""

import base64
import json
import logging
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)


class GeminiError(Exception):
    """Backward-compatible name for errors from the configured AI provider."""

    pass


def _provider_request() -> tuple[str, str, dict[str, str]]:
    if settings.AI_PROVIDER == "gemini":
        if not settings.GEMINI_API_KEY:
            raise GeminiError(
                "AI is not configured. Ask an administrator to add GEMINI_API_KEY."
            )
        return (
            "Gemini",
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{settings.GEMINI_MODEL}:generateContent",
            {"x-goog-api-key": settings.GEMINI_API_KEY},
        )

    if not settings.AIPIPE_TOKEN:
        raise GeminiError("AI is not configured. Ask an administrator to add AIPIPE_TOKEN.")
    return (
        "AI Pipe",
        f"https://aipipe.org/geminiv1beta/models/{settings.AIPIPE_MODEL}:generateContent",
        # AI Pipe's Gemini proxy follows the native Gemini authentication shape. Its current API
        # guide requires the AI Pipe token in x-goog-api-key (unlike its OpenAI/OpenRouter routes,
        # which use Authorization: Bearer).
        {"x-goog-api-key": settings.AIPIPE_TOKEN},
    )


def _request_json(payload: dict) -> dict:
    provider, url, auth_headers = _provider_request()
    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            # AI Pipe is fronted by Cloudflare, which rejects urllib's default Python user-agent
            # with error 1010. A curl-compatible API client user-agent is accepted.
            "User-Agent": "curl/8.5.0",
            **auth_headers,
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=40) as response:  # nosec B310 - fixed provider endpoints
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        # Return a concise provider reason without exposing the request payload or credential.
        provider_status = ""
        provider_message = ""
        try:
            error_body = json.loads(exc.read().decode("utf-8"))
            # Gemini nests details under "error"; AI Pipe's own validation errors are top-level.
            error = error_body.get("error") or error_body
            provider_status = str(error.get("status") or "")
            provider_message = str(error.get("message") or "")
        except (AttributeError, UnicodeDecodeError, json.JSONDecodeError):
            pass
        logger.warning(
            "%s request failed with HTTP %s (%s): %s",
            provider,
            exc.code,
            provider_status or "unknown status",
            provider_message or exc.reason,
        )
        if exc.code == 429:
            raise GeminiError("AI is temporarily busy. Please try again in a minute.") from exc
        detail = f" ({provider_status})" if provider_status else ""
        raise GeminiError(
            f"{provider} rejected the request with HTTP {exc.code}{detail}. "
            "Check the selected AI model and the server logs."
        ) from exc
    except (URLError, TimeoutError) as exc:
        logger.warning("%s request unavailable: %s", provider, exc)
        raise GeminiError("The AI service is currently unavailable. Please try again.") from exc


def _response_text(response: dict) -> str:
    try:
        parts = response["candidates"][0]["content"]["parts"]
        text = "".join(part.get("text", "") for part in parts).strip()
    except (KeyError, IndexError, TypeError) as exc:
        finish_reason = None
        try:
            finish_reason = response["candidates"][0].get("finishReason")
        except (KeyError, IndexError, TypeError):
            pass
        logger.warning("Gemini response missing text (finishReason=%s): %s", finish_reason, response)
        raise GeminiError("The AI service returned an incomplete response.") from exc
    if not text:
        logger.warning("Gemini returned an empty response: %s", response)
        raise GeminiError("The AI service returned an empty response.")
    return text


def generate_json(*, prompt: str, schema: dict, max_output_tokens: int) -> dict:
    response = _request_json(
        {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": max_output_tokens,
                "responseMimeType": "application/json",
                "responseSchema": schema,
                # gemini-2.5-flash "thinks" by default; with a small maxOutputTokens budget the
                # thinking tokens alone can exhaust it, leaving an empty candidates[0].content —
                # this task is a simple classification/reply, not something needing chain-of-
                # thought reasoning, so disable it and put the whole budget toward the actual
                # structured output.
                "thinkingConfig": {"thinkingBudget": 0},
            },
        }
    )
    text = _response_text(response)
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        logger.warning("Gemini returned non-JSON text despite responseSchema: %r", text)
        raise GeminiError("The AI service returned an invalid response. Please try again.") from exc


def _approved_s3_url(url: str) -> None:
    parsed = urlparse(url)
    expected_host = f"{settings.S3_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com"
    if (
        parsed.scheme != "https"
        or not settings.S3_BUCKET_NAME
        or parsed.hostname != expected_host
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Media must be an uploaded Simplifix file.",
        )


def media_part(url: str, max_bytes: int) -> dict:
    """Download a verified app upload and turn it into an inline Gemini media part."""
    _approved_s3_url(url)
    request = Request(url, headers={"User-Agent": "Simplifix-AI/1.0"})
    try:
        with urlopen(request, timeout=20) as response:  # nosec B310 - validated S3 host
            content_type = (response.headers.get_content_type() or "").lower()
            if not (content_type.startswith("image/") or content_type.startswith("audio/") or content_type.startswith("video/")):
                raise HTTPException(status_code=422, detail="Unsupported uploaded media type.")
            content = response.read(max_bytes + 1)
    except HTTPException:
        raise
    except (HTTPError, URLError, TimeoutError) as exc:
        raise HTTPException(status_code=422, detail="Uploaded media could not be read.") from exc
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail="Media is too large for AI analysis.")
    # REST uses camelCase here (the SDK exposes snake_case fields separately).
    return {
        "inlineData": {
            "mimeType": content_type,
            "data": base64.b64encode(content).decode("ascii"),
        }
    }


def generate_multimodal_json(*, prompt: str, media: list[dict], schema: dict) -> dict:
    response = _request_json(
        {
            "contents": [{"role": "user", "parts": [{"text": prompt}, *media]}],
            "generationConfig": {
                "temperature": 0.1,
                # A bit more headroom than generate_json's callers use: the model tends to
                # write closer to the prompt's "max 80 words" limit than a hard token cap
                # would suggest, and a truncated ai_description cuts the JSON off mid-string.
                "maxOutputTokens": 500,
                "responseMimeType": "application/json",
                "responseSchema": schema,
                # See the matching comment in generate_json — disable thinking so the small
                # output budget isn't silently consumed before any actual JSON is produced.
                "thinkingConfig": {"thinkingBudget": 0},
            },
        }
    )
    text = _response_text(response)
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        logger.warning("Gemini returned non-JSON text despite responseSchema: %r", text)
        raise GeminiError("The AI service returned an invalid response. Please try again.") from exc
