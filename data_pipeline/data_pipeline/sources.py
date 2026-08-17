"""Bronze→silver ingestion of session JSONL via DuckDB.

Mirrors loc-dock:
- discovery: ``source_adapter.rs`` ``GlobFileDiscoverer`` (glob ``**/*.jsonl``,
  skip subdirectory components);
- parsing: the ``sql/*-silver.sql`` templates — JSON is never parsed in
  Python; ``read_ndjson_objects`` (never ``read_ndjson_auto``) parses each
  line, fields are extracted by JSON path, rows are deduped on
  ``(source, session_id, ts)`` (plus the OMP message id, which extends the
  entries UNIQUE key).

Deviation from loc-dock (per the assignment): cost is priced **per model**
from the LiteLLM map rather than with a single flat price in SQL. The silver
INSERT extracts token counts (and, for Pi and OMP, the provider-supplied
costs); ``finalize_costs`` fills per-model USD amounts in Python, mirroring
the ``CASE WHEN ...`` guards of the SQL templates. OMP rows are never
LiteLLM-priced — their ``usage.cost.total`` is the exact USD cost.
"""

from __future__ import annotations

import duckdb
from pathlib import Path

from .config import INGEST_BATCH_FILES, MAX_OBJECT_SIZE
from .pricing import Pricing

ENTRIES_SCHEMA = """
CREATE TABLE entries (
  source VARCHAR,
  session_id VARCHAR,
  ts TIMESTAMP,
  model VARCHAR,
  message_id VARCHAR,
  input_tokens BIGINT,
  output_tokens BIGINT,
  cache_creation_input_tokens BIGINT,
  cache_read_input_tokens BIGINT,
  input_cost DOUBLE,
  output_cost DOUBLE,
  cache_write_cost DOUBLE,
  cache_read_cost DOUBLE,
  total_cost DOUBLE,
  file_path VARCHAR,
  UNIQUE(source, session_id, ts, message_id)
);
"""


def open_entries_connection() -> duckdb.DuckDBPyConnection:
    """In-memory DuckDB with the silver ``entries`` table (mirror usage_store)."""
    con = duckdb.connect()
    con.execute("PRAGMA threads=4")
    con.execute(ENTRIES_SCHEMA)
    return con


def discover_files(root: Path, skip_subdirs: tuple[str, ...]) -> list[Path]:
    """All ``*.jsonl`` under ``root`` whose path contains no skip component
    (mirror ``GlobFileDiscoverer::discover_files``; missing root → empty)."""
    if not root.exists():
        return []
    files: list[Path] = []
    for path in root.rglob("*.jsonl"):
        if not path.is_file():
            continue
        parts = path.parts
        if any(part in parts for part in skip_subdirs):
            continue
        files.append(path)
    return sorted(files)


def _paths_sql_array(paths: list[Path]) -> str:
    """Render paths as a DuckDB array literal (mirror ``paths_to_sql_array``)."""
    quoted = []
    for p in paths:
        s = str(p).replace("\\", "/").replace("'", "''")
        quoted.append(f"'{s}'")
    return ", ".join(quoted)


# ── Silver extraction SQL (mirror sql/claude-silver.sql) ────────────────────
CLAUDE_SILVER = """
INSERT OR IGNORE INTO entries
  (source, session_id, ts, model, message_id,
   input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens,
   input_cost, output_cost, cache_write_cost, cache_read_cost, total_cost, file_path)
WITH bronze AS (
  SELECT json AS j, replace(filename, '\\', '/') AS file_path
  FROM read_ndjson_objects([{PATHS}],
         filename = true, ignore_errors = true, maximum_object_size = {MAX_OBJECT_SIZE})
),
ex AS (
  SELECT
    COALESCE(json_extract_string(j, '$.sessionId'),
             regexp_extract(file_path, '([^/]+)\\.jsonl$', 1)) AS session_id,
    TRY_CAST(json_extract_string(j, '$.timestamp') AS TIMESTAMP) AS ts,
    json_extract_string(j, '$.message.model') AS model,
    COALESCE(TRY_CAST(json_extract_string(j, '$.message.usage.input_tokens') AS BIGINT), 0) AS input_tokens,
    COALESCE(TRY_CAST(json_extract_string(j, '$.message.usage.output_tokens') AS BIGINT), 0) AS output_tokens,
    COALESCE(TRY_CAST(json_extract_string(j, '$.message.usage.cache_creation_input_tokens') AS BIGINT), 0) AS cache_creation_input_tokens,
    COALESCE(TRY_CAST(json_extract_string(j, '$.message.usage.cache_read_input_tokens') AS BIGINT), 0) AS cache_read_input_tokens,
    file_path
  FROM bronze
  WHERE json_extract_string(j, '$.type') = 'assistant'
    AND json_extract(j, '$.message.usage') IS NOT NULL
)
SELECT
  'claude', session_id, ts, model, session_id AS message_id,
  input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens,
  0, 0, 0, 0, 0,
  file_path
FROM ex
WHERE ts IS NOT NULL
"""

# ── Silver extraction SQL (mirror sql/pi-silver.sql) ────────────────────────
PI_SILVER = """
INSERT OR IGNORE INTO entries
  (source, session_id, ts, model, message_id,
   input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens,
   input_cost, output_cost, cache_write_cost, cache_read_cost, total_cost, file_path)
WITH bronze AS (
  SELECT json AS j, replace(filename, '\\', '/') AS file_path,
         row_number() OVER () AS rn
  FROM read_ndjson_objects([{PATHS}],
         filename = true, ignore_errors = true, maximum_object_size = {MAX_OBJECT_SIZE})
),
carried AS (
  SELECT *,
    LAST_VALUE(CASE WHEN json_extract_string(j, '$.type') = 'model_change'
                    THEN json_extract_string(j, '$.modelId') END IGNORE NULLS)
      OVER (ORDER BY rn ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS carried_model,
    LAST_VALUE(CASE WHEN json_extract_string(j, '$.type') = 'model_change'
                    THEN json_extract_string(j, '$.provider') END IGNORE NULLS)
      OVER (ORDER BY rn ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS carried_provider
  FROM bronze
),
ex AS (
  SELECT
    split_part(regexp_extract(file_path, '([^/]+)\\.jsonl$', 1), '_', 2) AS session_id,
    COALESCE(
      CASE WHEN TRY_CAST(json_extract_string(j, '$.message.timestamp') AS BIGINT) IS NOT NULL
           THEN to_timestamp(TRY_CAST(json_extract_string(j, '$.message.timestamp') AS BIGINT) / 1000.0) AT TIME ZONE 'UTC'
      END,
      TRY_CAST(json_extract_string(j, '$.timestamp') AS TIMESTAMP)
    ) AS ts,
    COALESCE(json_extract_string(j, '$.message.model'), carried_model) AS model,
    COALESCE(TRY_CAST(json_extract_string(j, '$.message.usage.input')      AS BIGINT), 0) AS input_tokens,
    COALESCE(TRY_CAST(json_extract_string(j, '$.message.usage.output')     AS BIGINT), 0) AS output_tokens,
    COALESCE(TRY_CAST(json_extract_string(j, '$.message.usage.cacheWrite') AS BIGINT), 0) AS cache_creation_input_tokens,
    COALESCE(TRY_CAST(json_extract_string(j, '$.message.usage.cacheRead')  AS BIGINT), 0) AS cache_read_input_tokens,
    COALESCE(TRY_CAST(json_extract_string(j, '$.message.usage.cost.input')      AS DOUBLE), 0) AS p_input_cost,
    COALESCE(TRY_CAST(json_extract_string(j, '$.message.usage.cost.output')     AS DOUBLE), 0) AS p_output_cost,
    COALESCE(TRY_CAST(json_extract_string(j, '$.message.usage.cost.cacheWrite') AS DOUBLE), 0) AS p_cache_write_cost,
    COALESCE(TRY_CAST(json_extract_string(j, '$.message.usage.cost.cacheRead')  AS DOUBLE), 0) AS p_cache_read_cost,
    COALESCE(TRY_CAST(json_extract_string(j, '$.message.usage.cost.total')      AS DOUBLE), 0) AS p_total_cost,
    file_path
  FROM carried
  WHERE json_extract_string(j, '$.type') = 'message'
    AND json_extract_string(j, '$.message.role') = 'assistant'
    AND json_extract(j, '$.message.usage') IS NOT NULL
)
SELECT
  'pi', session_id, ts, model, session_id AS message_id,
  input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens,
  p_input_cost, p_output_cost, p_cache_write_cost, p_cache_read_cost, p_total_cost,
  file_path
FROM ex
WHERE ts IS NOT NULL
"""

# ── Silver extraction SQL for Codex (best effort; loc-dock's template is a
#    no-op placeholder, the assignment includes the source when the dir
#    exists). Codex wraps messages under `payload`; usage may live on
#    payload.usage or payload.message.usage with the same four token fields.
CODEX_SILVER = """
INSERT OR IGNORE INTO entries
  (source, session_id, ts, model, message_id,
   input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens,
   input_cost, output_cost, cache_write_cost, cache_read_cost, total_cost, file_path)
WITH bronze AS (
  SELECT json AS j, replace(filename, '\\', '/') AS file_path
  FROM read_ndjson_objects([{PATHS}],
         filename = true, ignore_errors = true, maximum_object_size = {MAX_OBJECT_SIZE})
),
ex AS (
  SELECT
    COALESCE(json_extract_string(j, '$.payload.session_id'),
             regexp_extract(file_path, '([0-9a-fA-F]{{8}}-[0-9a-fA-F]{{4}}-[0-9a-fA-F]{{4}}-[0-9a-fA-F]{{4}}-[0-9a-fA-F]{{12}})', 1)) AS session_id,
    TRY_CAST(json_extract_string(j, '$.timestamp') AS TIMESTAMP) AS ts,
    COALESCE(json_extract_string(j, '$.payload.model'), json_extract_string(j, '$.payload.message.model')) AS model,
    COALESCE(
      TRY_CAST(json_extract_string(j, '$.payload.usage.input_tokens') AS BIGINT),
      TRY_CAST(json_extract_string(j, '$.payload.message.usage.input_tokens') AS BIGINT), 0) AS input_tokens,
    COALESCE(
      TRY_CAST(json_extract_string(j, '$.payload.usage.output_tokens') AS BIGINT),
      TRY_CAST(json_extract_string(j, '$.payload.message.usage.output_tokens') AS BIGINT), 0) AS output_tokens,
    COALESCE(
      TRY_CAST(json_extract_string(j, '$.payload.usage.cache_creation_input_tokens') AS BIGINT),
      TRY_CAST(json_extract_string(j, '$.payload.message.usage.cache_creation_input_tokens') AS BIGINT), 0) AS cache_creation_input_tokens,
    COALESCE(
      TRY_CAST(json_extract_string(j, '$.payload.usage.cache_read_input_tokens') AS BIGINT),
      TRY_CAST(json_extract_string(j, '$.payload.message.usage.cache_read_input_tokens') AS BIGINT), 0) AS cache_read_input_tokens,
    file_path
  FROM bronze
  WHERE json_extract_string(j, '$.type') = 'response_item'
    AND json_extract_string(j, '$.payload.type') = 'message'
    AND json_extract_string(j, '$.payload.role') = 'assistant'
    AND (json_extract(j, '$.payload.usage') IS NOT NULL OR json_extract(j, '$.payload.message.usage') IS NOT NULL)
)
SELECT
  'codex', session_id, ts, model, session_id AS message_id,
  input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens,
  0, 0, 0, 0, 0,
  file_path
FROM ex
WHERE ts IS NOT NULL
"""

# ── Silver extraction SQL for the OMP (Oh My Pi) harness ─────────────────────
# The harness wrote assistant completion rows with api/provider/model/usage at
# the TOP level, then moved them INSIDE `message` (verified on disk: all rows
# are `$.message.usage`); the template COALESCEs both layouts so either
# ingests. Session id comes from the `type:"session"` line (carried down the
# file), else the ULID segment of the filename. Cost is the provider's exact
# USD total — never LiteLLM-priced (see finalize_costs). Dedup extends the
# entries UNIQUE key with the top-level message id, so re-runs don't
# double-count. `read_ndjson_objects` only — never read_ndjson_auto.
OMP_SILVER = """
INSERT OR IGNORE INTO entries
  (source, session_id, ts, model, message_id,
   input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens,
   input_cost, output_cost, cache_write_cost, cache_read_cost, total_cost, file_path)
WITH bronze AS (
  SELECT json AS j, replace(filename, '\\', '/') AS file_path, row_number() OVER () AS rn
  FROM read_ndjson_objects([{PATHS}],
         filename = true, ignore_errors = true, maximum_object_size = {MAX_OBJECT_SIZE})
),
sess AS (
  SELECT *,
    LAST_VALUE(CASE WHEN json_extract_string(j, '$.type') = 'session'
                    THEN json_extract_string(j, '$.id') END IGNORE NULLS)
      OVER (PARTITION BY file_path ORDER BY rn ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS carried_session_id
  FROM bronze
),
ex AS (
  SELECT
    COALESCE(carried_session_id,
             regexp_extract(file_path, '([0-9a-fA-F]{{8}}-[0-9a-fA-F]{{4}}-[0-9a-fA-F]{{4}}-[0-9a-fA-F]{{4}}-[0-9a-fA-F]{{12}})', 1)) AS session_id,
    TRY_CAST(json_extract_string(j, '$.timestamp') AS TIMESTAMP) AS ts,
    regexp_replace(COALESCE(json_extract_string(j, '$.model'), json_extract_string(j, '$.message.model')), '^deepseek/', '') AS model,
    COALESCE(json_extract_string(j, '$.id'), carried_session_id) AS message_id,
    COALESCE(TRY_CAST(json_extract_string(j, '$.usage.input') AS BIGINT),
             TRY_CAST(json_extract_string(j, '$.message.usage.input') AS BIGINT), 0) AS input_tokens,
    COALESCE(TRY_CAST(json_extract_string(j, '$.usage.output') AS BIGINT),
             TRY_CAST(json_extract_string(j, '$.message.usage.output') AS BIGINT), 0) AS output_tokens,
    COALESCE(TRY_CAST(json_extract_string(j, '$.usage.cacheWrite') AS BIGINT),
             TRY_CAST(json_extract_string(j, '$.message.usage.cacheWrite') AS BIGINT), 0) AS cache_creation_input_tokens,
    COALESCE(TRY_CAST(json_extract_string(j, '$.usage.cacheRead') AS BIGINT),
             TRY_CAST(json_extract_string(j, '$.message.usage.cacheRead') AS BIGINT), 0) AS cache_read_input_tokens,
    COALESCE(TRY_CAST(json_extract_string(j, '$.usage.cost.total') AS DOUBLE),
             TRY_CAST(json_extract_string(j, '$.message.usage.cost.total') AS DOUBLE), 0) AS p_total_cost,
    file_path
  FROM sess
  WHERE json_extract_string(j, '$.type') = 'message'
    AND json_extract_string(j, '$.message.role') = 'assistant'
    AND COALESCE(json_extract(j, '$.usage.totalTokens'), json_extract(j, '$.message.usage.totalTokens')) IS NOT NULL
)
SELECT
  'omp', session_id, ts, model, message_id,
  input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens,
  0, 0, 0, 0, p_total_cost,
  file_path
FROM ex
WHERE ts IS NOT NULL
"""

_SILVER_TEMPLATES = {
    "claude": CLAUDE_SILVER,
    "pi": PI_SILVER,
    "codex": CODEX_SILVER,
    "omp": OMP_SILVER,
}


def ingest_source(
    con: duckdb.DuckDBPyConnection,
    root: Path,
    source: str,
    skip_subdirs: tuple[str, ...],
    files: list[Path] | None = None,
) -> int:
    """Extract all rows from one source into ``entries`` (inserted count).

    ``files`` overrides discovery (the smoke path ingests exactly one file).
    """
    if files is None:
        files = discover_files(root, skip_subdirs)
    if not files:
        return 0
    template = _SILVER_TEMPLATES[source]
    total = 0
    for i in range(0, len(files), INGEST_BATCH_FILES):
        batch = files[i : i + INGEST_BATCH_FILES]
        sql = template.format(
            PATHS=_paths_sql_array(batch),
            MAX_OBJECT_SIZE=MAX_OBJECT_SIZE,
        )
        result = con.execute(sql)
        total += result.fetchone()[0]
    return total


def ingest_all(
    con: duckdb.DuckDBPyConnection,
    roots,
) -> int:
    """Ingest claude, pi, omp and (when present) codex; returns inserted count."""
    total = 0
    for source, root in (("claude", roots.claude), ("pi", roots.pi), ("codex", roots.codex), ("omp", roots.omp)):
        if source == "codex" and not root.exists():
            continue
        from .config import SKIP_SUBDIRS

        total += ingest_source(con, root, source, SKIP_SUBDIRS[source])
    return total


def extract_entries(con: duckdb.DuckDBPyConnection) -> list[dict]:
    """Read silver rows and finalize per-model costs (mirror of the silver
    SQL cost guards, priced per model from the LiteLLM map)."""
    rows = con.execute(
        """
        SELECT source, session_id, ts, model, message_id,
               input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens,
               input_cost, output_cost, cache_write_cost, cache_read_cost, total_cost
        FROM entries
        """
    ).fetchall()
    return [
        {
            "source": r[0],
            "session_id": r[1],
            "ts": r[2],
            "model": r[3],
            "message_id": r[4],
            "input_tokens": int(r[5]),
            "output_tokens": int(r[6]),
            "cache_write_tokens": int(r[7]),
            "cache_read_tokens": int(r[8]),
            "input_cost": float(r[9]),
            "output_cost": float(r[10]),
            "cache_write_cost": float(r[11]),
            "cache_read_cost": float(r[12]),
            "total_cost": float(r[13]),
        }
        for r in rows
    ]


def finalize_costs(entries: list[dict], pricing: Pricing) -> None:
    """Fill USD cost per row.

    Mirrors the silver SQL: Pi rows keep provider-supplied costs when the
    provider reported a nonzero total (``CASE WHEN p_total_cost = 0 ... ELSE
    p_total_cost END``); OMP rows keep the provider's exact USD total from
    ``usage.cost.total`` (the assignment forbids LiteLLM pricing for OMP);
    every other row is priced per model via the LiteLLM map. Rows with no
    token activity cost 0.
    """
    for e in entries:
        if e["source"] == "pi" and e["total_cost"] > 0:
            continue  # provider-supplied costs already stored
        if e["source"] == "omp":
            continue  # exact USD from usage.cost.total — never LiteLLM-priced
        model_cost = pricing.cost_for_model(e["model"])
        in_c, out_c, cw_c, cr_c, total_c = model_cost.cost_of(
            e["input_tokens"],
            e["output_tokens"],
            e["cache_write_tokens"],
            e["cache_read_tokens"],
        )
        e["input_cost"] = in_c
        e["output_cost"] = out_c
        e["cache_write_cost"] = cw_c
        e["cache_read_cost"] = cr_c
        e["total_cost"] = total_c
