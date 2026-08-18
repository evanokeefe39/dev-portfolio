# Split snapshot per range: eager 7d + lazy slices

Date: 2026-08-18

## Intent

The frontend shipped one 332.6KB `current.json` (52.6KB gzip) whose `sessions`
array alone was 237.6KB (115 summaries = 46KB) — the 7d view needs 42 sessions,
the 90d view 564. Split the snapshot into per-range files: `7d.json` eager
(small, carries ALL five range aggregates + 7d-windowed sessions with full
detail), `30d/90d/1y/all.json` lazy (windowed sessions stripped to what repo
aggregation needs). Initial paint pays only the 7d file; longer ranges load in
the background on demand. `current.json` removed.

## Checkable items

### Pipeline (agent P, verified)

- [x] `snapshot.py`: `_window_sessions` (inclusive day window; 'all' → all),
      `_strip_sessions` (exact 7 keys, locDelta {added, removed} only),
      `write_outputs` → 7d.json + four lazy slices + history archive (full
      snapshot) + unlink current.json, returns list[Path]. RANGE_DAYS imported
      from config.py (already the single source).
- [x] cli.py + pyproject.toml descriptions updated ("wrote 6 data files").
- [x] test_snapshot.py: window/strip/archive/current-gone assertions; 74/74
      pytest pass.

### Frontend (agent F, verified)

- [x] `data.ts`: loadSnapshot → `/data/7d.json`; `loadRangeSessions(range)`
      → `/data/{range}.json`, [] on failure, sessions through the existing
      normalizer (stripped fields default — no normalizer change).
- [x] `snapshot-store.ts`: `rangeSessions` in state; `ensureRangeSessions`
      with per-range cached promise, atomic merge, never rejects; eager 7d
      unchanged.
- [x] Scene: lazy slice effect; 7d layout stays until the slice lands, then
      recomputes (repo mode); doc comment updated.
- [x] RepoCarousel: null until the slice exists; aggregates the pre-windowed
      slice.
- [x] tests: loadRangeSessions (stripped parse, 404, malformed), store test
      (one eager fetch, one per-range fetch, no refetch); 42/42 npm tests.

### Data

- [x] `uv run pytest` 74 passed; `uv run snapshot` regenerated real data.
- [x] Real slices inspected: 7d.json 56.4KB raw/11.3KB gzip (45 sessions,
      summaries kept, all 5 ranges); 30d 31.8KB/3.4KB (112, stripped); 90d/1y/
      all ~160KB/~16KB (567–568, stripped); current.json gone.

### Verify

- [x] `npm test` 42/42, typecheck, lint — clean
- [x] `next build` static export — exit 0
- [x] Browser (dev server, request capture): initial load fetches ONLY
      /data/7d.json (stat card "1.8B tokens" immediately); switching to 30d
      fetches ONLY /data/30d.json, carousel hidden mid-switch (7d layout
      holds), then "Repos · 30d" with the scene on repo krabs.

### Docs

- [x] portfolio-plan (table, process, schema section, history), WATCHDOG
      (snapshot bullet), lessons, lib/types.ts comment.

## Review section

- Assumption: summaries stay a 7d-only feature (per-session tooltips exist
  only at 7d) — stripping them from lazy slices loses nothing.
- Note: total bytes across ALL slices (~568KB raw) exceeds the old single
  file because 90d/1y/all each carry ~568 stripped session records; the win is
  initial paint (332.6 → 56.4KB) and on-demand fetching, not total transfer.
- RANGE_DAYS imported from config.py rather than redefined (agent deviation,
  accepted — single source of truth).
- No new dependencies in either package.
