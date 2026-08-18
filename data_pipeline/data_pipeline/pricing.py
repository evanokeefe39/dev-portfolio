"""LiteLLM community pricing — mirror of loc-dock ``pricing.rs``.

LiteLLM's ``model_prices_and_context_window.json`` stores prices **per
token**; this module converts them to per-million-token rates, exactly like
``pricing.rs::from_default`` (``per_token * 1_000_000``).

Mirror semantics:
- ``#[serde(default)]`` — missing cost fields default to ``0.0``.
- Fallback model — ``gpt-4o-mini``, else the first entry, else the hardcoded
  gpt-4o-mini defaults from ``ModelPricing::default()``.
- When the pricing file is unavailable the caller reports ``cost.total`` as
  ``null`` with a zero breakdown (locked schema), per the assignment.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

# Hardcoded gpt-4o-mini defaults, per-million (pricing.rs ModelPricing::default).
_DEFAULT_PER_MILLION = {
    "input": 0.15,
    "output": 0.60,
    "cache_write": 0.15,
    "cache_read": 0.075,
}


@dataclass(frozen=True)
class ModelCost:
    """Per-million-token prices in USD (mirror ``Pricing`` struct)."""

    input_price: float
    output_price: float
    cache_write_price: float
    cache_read_price: float

    def cost_of(
        self,
        input_tokens: int,
        output_tokens: int,
        cache_write_tokens: int,
        cache_read_tokens: int,
    ) -> tuple[float, float, float, float, float]:
        """Return (input, output, cache_write, cache_read, total) USD.

        Mirrors the silver SQL ``CASE WHEN input_tokens > 0 OR output_tokens
        > 0 THEN ... ELSE 0 END`` guard: rows with no token activity cost 0.
        """
        if input_tokens <= 0 and output_tokens <= 0:
            return (0.0, 0.0, 0.0, 0.0, 0.0)
        input_cost = input_tokens / 1e6 * self.input_price
        output_cost = output_tokens / 1e6 * self.output_price
        cache_write_cost = cache_write_tokens / 1e6 * self.cache_write_price
        cache_read_cost = cache_read_tokens / 1e6 * self.cache_read_price
        total = input_cost + output_cost + cache_write_cost + cache_read_cost
        return (input_cost, output_cost, cache_write_cost, cache_read_cost, total)


class Pricing:
    """LiteLLM pricing map with the loc-dock fallback chain."""

    def __init__(self, path: Path | None) -> None:
        self.available = False
        self.source_path: Path | None = None
        self._models: dict[str, ModelCost] = {}
        if path is not None and path.is_file():
            try:
                raw = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                raw = None
            if isinstance(raw, dict):
                self.available = True
                self.source_path = path
                for name, entry in raw.items():
                    if not isinstance(entry, dict):
                        continue
                    self._models[name] = ModelCost(
                        input_price=float(entry.get("input_cost_per_token", 0.0)) * 1e6,
                        output_price=float(entry.get("output_cost_per_token", 0.0)) * 1e6,
                        cache_write_price=float(
                            entry.get("cache_creation_input_token_cost", 0.0)
                        ) * 1e6,
                        cache_read_price=float(entry.get("cache_read_input_token_cost", 0.0)) * 1e6,
                    )

    def cost_for_model(self, model: str | None) -> ModelCost:
        """Per-model cost, falling back per loc-dock pricing.rs."""
        if model:
            direct = self._models.get(model)
            if direct is not None:
                return direct
            # Provider-stripped lookup: "anthropic/claude-opus-4-8" → "claude-opus-4-8".
            stripped = self._models.get(model.rsplit("/", 1)[-1])
            if stripped is not None:
                return stripped
        fallback = self._models.get("gpt-4o-mini")
        if fallback is None and self._models:
            fallback = next(iter(self._models.values()))
        if fallback is not None:
            return fallback
        return ModelCost(
            input_price=_DEFAULT_PER_MILLION["input"],
            output_price=_DEFAULT_PER_MILLION["output"],
            cache_write_price=_DEFAULT_PER_MILLION["cache_write"],
            cache_read_price=_DEFAULT_PER_MILLION["cache_read"],
        )

    @classmethod
    def discover(cls) -> "Pricing":
        """Load chain mirroring pricing.rs: user override, bundled resource,
        then unavailable (→ null cost)."""
        # 1. User override.
        override = Path.home() / ".config" / "loc-dock" / "litellm.json"
        if override.is_file():
            return cls(override)
        # 2. Bundled resource shipped with loc-dock.
        bundled = Path.home() / "repos" / "loc-dock" / "loc-dock-tauri" / "src-tauri" / "resources" / "pricing" / "litellm.json"
        if bundled.is_file():
            return cls(bundled)
        return cls(None)
