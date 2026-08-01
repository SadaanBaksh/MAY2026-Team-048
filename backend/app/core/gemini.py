"""Small, dependency-free Gemini gateway used by the resident AI features."""

import base64
import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from fastapi import HTTPException, status

from app.core.config import settings


class GeminiError(Exception):
    pass


def _request_json(payload: dict) -> dict:
    if not settings.GEMINI_API_KEY:
        raise GeminiError("AI is not configured. Ask an administrator to add GEMINI_API_KEY.")

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.GEMINI_MODEL}:generateContent"
    )
    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": settings.GEMINI_API_KEY,
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=40) as response:  # nosec B310 - fixed Google endpoint
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        # Do not return provider response bodies: they can contain implementation details.
        if exc.code == 429:
            raise GeminiError("AI is temporarily busy. Please try again in a minute.") from exc
        raise GeminiError("The AI service could not complete that request.") from exc
    except (URLError, TimeoutError) as exc:
        raise GeminiError("The AI service is currently unavailable. Please try again.") from exc


def _response_text(response: dict) -> str:
    try:
        parts = response["candidates"][0]["content"]["parts"]
        text = "".join(part.get("text", "") for part in parts).strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise GeminiError("The AI service returned an incomplete response.") from exc
    if not text:
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
    try:
        return json.loads(_response_text(response))
    except json.JSONDecodeError as exc:
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
    return {"inline_data": {"mime_type": content_type, "data": base64.b64encode(content).decode("ascii")}}


def generate_multimodal_json(*, prompt: str, media: list[dict], schema: dict) -> dict:
    response = _request_json(
        {
            "contents": [{"role": "user", "parts": [{"text": prompt}, *media]}],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 300,
                "responseMimeType": "application/json",
                "responseSchema": schema,
                # See the matching comment in generate_json — disable thinking so the small
                # output budget isn't silently consumed before any actual JSON is produced.
                "thinkingConfig": {"thinkingBudget": 0},
            },
        }
    )
    try:
        return json.loads(_response_text(response))
    except json.JSONDecodeError as exc:
        raise GeminiError("The AI service returned an invalid response. Please try again.") from exc
