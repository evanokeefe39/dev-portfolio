"""Local dev-portfolio snapshot pipeline.

Ingests Claude/Pi/Codex/OMP session JSONL (via DuckDB ``read_ndjson_objects``)
and git commit history, computes developer metrics over five time ranges
(7d/30d/90d/1y/all), LTTB-downsamples daily sparklines, and writes a
committed JSON snapshot to ``public/data/``.

The logic mirrors the loc-dock Rust implementation:
``~/repos/loc-dock/docs/DATA_FLOWS.md`` and the ``src-tauri/src`` modules
``source_adapter.rs``, ``usage_store.rs``, ``pricing.rs``, ``git.rs`` and the
``sql/*-silver.sql`` templates.
"""

__version__ = "0.1.0"
