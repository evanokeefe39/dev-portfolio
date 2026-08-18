"""Minimal OpenAI-compatible chat-completions client (stdlib urllib only).

Mirrors the loc-dock ``summary.rs`` HTTP contract: POST ``{base}/chat/completions``
with Bearer auth, retry with exponential backoff, and a consecutive-failure
circuit breaker so a dead endpoint never burns tokens. ``finish_reason ==
"length"`` or empty ``content`` is treated as a FAILURE (deepseek-v4-flash can
spend the whole ``max_tokens`` budget on ``reasoning_content``).
"""

from __future__ import annotations

import json
import logging
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field

from .config import (
    DEFAULT_LLM_BASE_URL,
    DEFAULT_LLM_MODEL,
    LLM_BACKOFF_SECONDS,
    LLM_BREAKER_THRESHOLD,
    LLM_MAX_TOKENS,
    LLM_RETRIES,
    LLM_TIMEOUT_SECONDS,
    ROLLUP_MAX_WORDS,
)

logger = logging.getLogger(__name__)

ROLLUP_SYSTEM_PROMPT = (
    "Summarize the developer's work sessions below into ONE tight paragraph of "
    f"at most {ROLLUP_MAX_WORDS} words. Plain text. No lists, headers, or preamble."
)


class LlmError(Exception):
    """A call failed (HTTP error, empty content, length-truncated, missing key)."""


class CircuitOpenError(LlmError):
    """Too many consecutive failures; calls are skipped until a success."""


@dataclass
class LlmClient:
    """OpenAI-compatible client with retry + backoff + circuit breaker.

    Preconditions:
    - ``base_url`` non-empty; ``api_key`` non-empty (callers guard first).
    - ``summarize`` may raise :class:`LlmError` (or ``CircuitOpenError``) on
      failure — never returns empty text.
    """

    base_url: str = DEFAULT_LLM_BASE_URL
    api_key: str = ""
    model: str = DEFAULT_LLM_MODEL
    max_tokens: int = LLM_MAX_TOKENS
    timeout: float = LLM_TIMEOUT_SECONDS
    retries: int = LLM_RETRIES
    backoff: tuple[float, ...] = LLM_BACKOFF_SECONDS
    breaker_threshold: int = LLM_BREAKER_THRESHOLD
    _consecutive_failures: int = field(default=0, init=False, repr=False)

    def summarize(self, text: str) -> str:
        """One summary paragraph for ``text``; raises :class:`LlmError` on failure."""
        if self._consecutive_failures >= self.breaker_threshold:
            raise CircuitOpenError(
                f"circuit breaker open after {self._consecutive_failures} consecutive failures"
            )
        url = f"{self.base_url.rstrip('/')}/chat/completions"
        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": ROLLUP_SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
            "max_tokens": self.max_tokens,
            "temperature": 0.3,
            # Thinking off (harness `deepseek-v4-flash:off` semantics): v4-flash
            # otherwise burns max_tokens on reasoning_content and returns empty
            # content with finish_reason="length". Verified against the real API
            # 2026-08-17 (thinking disabled -> 0 reasoning tokens, stop).
            "thinking": {"type": "disabled"},
        }
        last_err: str | None = None
        for attempt in range(self.retries + 1):
            if attempt:
                delay = self.backoff[min(attempt - 1, len(self.backoff) - 1)]
                time.sleep(delay)
            try:
                content = self._post(url, body)
            except LlmError as err:
                last_err = str(err)
                logger.warning("LLM call attempt %d/%d failed: %s", attempt + 1, self.retries + 1, last_err)
                continue
            self._consecutive_failures = 0
            return content
        self._consecutive_failures += 1
        raise LlmError(f"LLM call failed after {self.retries + 1} attempts: {last_err}")

    def _post(self, url: str, body: dict) -> str:
        """POST once and parse; raises :class:`LlmError` on any failure."""
        payload = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=payload,
            method="POST",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                raw = resp.read()
        except urllib.error.HTTPError as err:
            raise LlmError(f"API returned HTTP {err.code}") from err
        except urllib.error.URLError as err:
            raise LlmError(f"HTTP request failed: {err.reason}") from err
        except TimeoutError as err:
            raise LlmError(f"HTTP request timed out after {self.timeout}s") from err

        try:
            data = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as err:
            raise LlmError(f"JSON parse failed: {err}") from err

        try:
            choice = data["choices"][0]
            content = choice["message"]["content"]
            finish_reason = choice.get("finish_reason")
        except (KeyError, IndexError, TypeError) as err:
            raise LlmError(f"missing expected keys in LLM response: {err}") from err

        if not content or not content.strip():
            raise LlmError(
                f"LLM returned empty content (finish_reason={finish_reason}, "
                f"max_tokens={self.max_tokens})"
            )
        if finish_reason == "length":
            raise LlmError(f"LLM response truncated (finish_reason=length, max_tokens={self.max_tokens})")
        return content.strip()


def load_env_file(path) -> dict[str, str]:
    """Parse a ``KEY=VALUE`` .env file; skip ``#`` comments and blank lines.

    Returns a plain dict; values are stripped of surrounding quotes.
    """
    env: dict[str, str] = {}
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return env
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if "=" not in stripped:
            continue
        key, _, value = stripped.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            env[key] = value
    return env
