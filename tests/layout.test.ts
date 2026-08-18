import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptySnapshot, normalizeSnapshot } from '../lib/data'
import {
  buildKrabLayout,
  SEAT_CAPACITY,
  SEAT_POSITIONS,
  SEAT_Y,
  sessionScale,
  tooltipBody,
} from '../components/scene/layout'
import type { SessionEntry } from '../lib/types'

// ---- helpers -------------------------------------------------------------

function s(over: Partial<SessionEntry> & Pick<SessionEntry, 'harness' | 'repo' | 'sessionId'>): SessionEntry {
  return {
    harness: over.harness,
    repo: over.repo,
    sessionId: over.sessionId,
    day: over.day ?? '2026-08-17',
    startTs: over.startTs ?? '2026-08-17T00:00:00Z',
    title: over.title ?? null,
    summary: over.summary ?? null,
    summarySlug: over.summarySlug ?? null,
    assistantMessages: over.assistantMessages ?? 0,
    locDelta: over.locDelta ?? null,
    prRefs: over.prRefs ?? [],
    branch: over.branch ?? null,
  }
}

// ---- render rule: per-session top-N --------------------------------------

test('<= capacity -> all sessions as items, ordered by assistantMessages desc then startTs desc', () => {
  const sessions = [
    s({ harness: 'omp', repo: 'dev-portfolio', sessionId: 'a', assistantMessages: 5, startTs: '2026-08-17T10:00:00Z' }),
    s({ harness: 'pi', repo: 'blog', sessionId: 'b', assistantMessages: 20, startTs: '2026-08-17T09:00:00Z' }),
    s({ harness: 'codex', repo: 'blog', sessionId: 'c', assistantMessages: 20, startTs: '2026-08-17T11:00:00Z' }),
  ]
  const layout = buildKrabLayout({ sessions, range: '7d', snapshotDate: '2026-08-17' })
  assert.equal(layout.mode, 'sessions')
  if (layout.mode !== 'sessions') return
  assert.equal(layout.items.length, 3)
  // msgs tie (20) -> startTs desc; msgs 5 last
  assert.deepEqual(layout.items.map((i) => i.key), ['codex:c', 'pi:b', 'omp:a'])
  assert.deepEqual(layout.items.map((i) => i.seatIndex), [0, 1, 2])
  assert.equal(layout.items[0].tooltipTitle, 'blog · codex')
  assert.equal(layout.overflow, 0)
})

test('> capacity -> top-N by assistantMessages, overflow = total - capacity', () => {
  const sessions: SessionEntry[] = []
  for (let i = 0; i < 17; i++) {
    sessions.push(s({ harness: 'omp', repo: 'dev-portfolio', sessionId: `s${i}`, assistantMessages: i }))
  }
  const layout = buildKrabLayout({ sessions, range: 'all', snapshotDate: '2026-08-17' })
  assert.equal(layout.mode, 'sessions')
  if (layout.mode !== 'sessions') return
  assert.equal(layout.items.length, SEAT_CAPACITY)
  assert.equal(layout.overflow, 17 - SEAT_CAPACITY)
  assert.equal(layout.items[0].key, 'omp:s16') // biggest first
  assert.equal(layout.items[SEAT_CAPACITY - 1].key, 'omp:s1') // smallest seated
  assert.equal(layout.items.some((i) => i.key === 'omp:s0'), false) // smallest overflows
})

test('capacity can be overridden for smaller scenes', () => {
  const sessions = [
    s({ harness: 'omp', repo: 'a', sessionId: 'a1', assistantMessages: 3 }),
    s({ harness: 'claude', repo: 'b', sessionId: 'b1', assistantMessages: 2 }),
    s({ harness: 'pi', repo: 'c', sessionId: 'c1', assistantMessages: 1 }),
  ]
  const layout = buildKrabLayout({ sessions, range: 'all', snapshotDate: '2026-08-17', capacity: 2 })
  assert.equal(layout.mode, 'sessions')
  if (layout.mode !== 'sessions') return
  assert.equal(layout.items.length, 2)
  assert.equal(layout.overflow, 1)
  assert.deepEqual(layout.items.map((i) => i.key), ['omp:a1', 'claude:b1'])
})

// ---- empty window --------------------------------------------------------

test('empty window renders an empty layout', () => {
  const empty = buildKrabLayout({ sessions: [], range: '7d', snapshotDate: '2026-08-17' })
  assert.equal(empty.mode, 'empty')
  const outOfWindow = buildKrabLayout({
    sessions: [s({ harness: 'omp', repo: 'r', sessionId: 'x', day: '2026-08-01' })],
    range: '7d',
    snapshotDate: '2026-08-17',
  })
  assert.equal(outOfWindow.mode, 'empty')
})

// ---- grain windows -------------------------------------------------------

test('7d window includes snapshotDate-6 and excludes snapshotDate-7', () => {
  const sessions = [
    s({ harness: 'omp', repo: 'r', sessionId: 'in', day: '2026-08-11', startTs: '2026-08-11T10:00:00Z', assistantMessages: 1 }),
    s({ harness: 'claude', repo: 'r', sessionId: 'out', day: '2026-08-10', startTs: '2026-08-10T10:00:00Z', assistantMessages: 9 }),
  ]
  const layout = buildKrabLayout({ sessions, range: '7d', snapshotDate: '2026-08-17' })
  assert.equal(layout.mode, 'sessions')
  if (layout.mode !== 'sessions') return
  assert.deepEqual(layout.items.map((i) => i.key), ['omp:in']) // out-of-window ignored even if bigger
})

test('30d window is wider than the 7d window', () => {
  const sessions = [s({ harness: 'pi', repo: 'r', sessionId: 'old', day: '2026-07-20', startTs: '2026-07-20T00:00:00Z' })]
  const layout = buildKrabLayout({ sessions, range: '30d', snapshotDate: '2026-08-17' })
  assert.equal(layout.mode, 'sessions')
  if (layout.mode !== 'sessions') return
  assert.equal(layout.items.length, 1)
})

test("'all' grain includes every session regardless of day", () => {
  const sessions = [
    s({ harness: 'claude', repo: 'r', sessionId: 'recent', day: '2026-08-17', assistantMessages: 1 }),
    s({ harness: 'pi', repo: 'r', sessionId: 'ancient', day: '2025-01-01', assistantMessages: 9 }),
  ]
  const layout = buildKrabLayout({ sessions, range: 'all', snapshotDate: '2026-08-17' })
  assert.equal(layout.mode, 'sessions')
  if (layout.mode !== 'sessions') return
  assert.equal(layout.items.length, 2)
  assert.deepEqual(layout.items.map((i) => i.key), ['pi:ancient', 'claude:recent']) // msgs desc
})

// ---- scale ---------------------------------------------------------------

test('sessionScale(0) is ~0.55 and scale is monotonic non-decreasing', () => {
  assert.equal(sessionScale(0), 0.55)
  const sweep = [0, 1, 5, 10, 50, 100, 500, 1000, 5000, 9999, 10000, 100000]
  for (let i = 1; i < sweep.length; i++) {
    assert.ok(sessionScale(sweep[i]) >= sessionScale(sweep[i - 1]), `not monotonic at ${sweep[i]}`)
  }
  assert.equal(sessionScale(100000), 1.1) // capped
  assert.ok(sessionScale(0) < sessionScale(1))
})

// ---- tooltip body --------------------------------------------------------

test('tooltipBody contains day, msgs, LOC (+A/−R), PRs, branch, summary', () => {
  const session = s({
    harness: 'omp',
    repo: 'dev-portfolio',
    sessionId: 'a',
    day: '2026-08-17',
    assistantMessages: 42,
    locDelta: { added: 120, removed: 40, net: 80 },
    prRefs: [15, 16],
    branch: 'main',
    summary: 'Harvested deterministically.',
  })
  const lines = tooltipBody(session).split('\n')
  assert.equal(lines.length, 4)
  assert.equal(lines[0], '2026-08-17 · 42 assistant msgs · +120/−40 LOC')
  assert.equal(lines[1], 'PRs #15 #16')
  assert.equal(lines[2], 'branch main')
  assert.equal(lines[3], 'Harvested deterministically.')
})

test('tooltipBody omits PR/branch/summary lines when absent', () => {
  const session = s({
    harness: 'pi',
    repo: 'blog',
    sessionId: 'b',
    day: '2026-08-16',
    assistantMessages: 7,
    locDelta: { added: 3, removed: 1, net: 2 },
  })
  const lines = tooltipBody(session).split('\n')
  assert.equal(lines.length, 1)
  assert.equal(lines[0], '2026-08-16 · 7 assistant msgs · +3/−1 LOC')
})

test('tooltipBody with locDelta null says "no commit activity"', () => {
  const session = s({ harness: 'codex', repo: 'r', sessionId: 'c', day: '2026-08-17', assistantMessages: 2 })
  const body = tooltipBody(session)
  assert.ok(body.includes('2026-08-17'))
  assert.ok(body.includes('2 assistant msgs'))
  assert.ok(body.includes('no commit activity that day'))
  assert.equal(body.split('\n').length, 1)
})

// ---- normalization -------------------------------------------------------

test('old snapshots without sessions/rollups still normalize', () => {
  const snap = normalizeSnapshot({ ranges: { '7d': {} } })
  assert.ok(snap)
  assert.deepEqual(snap.sessions, [])
  assert.equal('rollups' in snap, false)
  assert.equal('rollupErrors' in snap, false)
  const empty = emptySnapshot()
  assert.deepEqual(empty.sessions, [])
  assert.equal('rollups' in empty, false)
  assert.equal('rollupErrors' in empty, false)
})

test('normalization drops malformed sessions and defaults the new fields', () => {
  const snap = normalizeSnapshot({
    ranges: { '7d': {} },
    sessions: [
      { harness: 'omp', repo: 'dev-portfolio', sessionId: 'ok', day: '2026-08-17', startTs: '2026-08-17T00:00:00Z' },
      { harness: 'neovim', repo: 'bad-harness', sessionId: 'x' }, // unknown harness dropped
      { repo: 'no-harness', sessionId: 'y' }, // missing harness dropped
      { harness: 'pi', repo: 'no-id' }, // missing sessionId dropped
      'garbage',
      null,
    ],
  })
  assert.ok(snap)
  assert.equal(snap.sessions.length, 1)
  const entry = snap.sessions[0]
  assert.equal(entry.harness, 'omp')
  assert.equal(entry.assistantMessages, 0)
  assert.equal(entry.locDelta, null)
  assert.deepEqual(entry.prRefs, [])
  assert.equal(entry.branch, null)
  assert.equal(entry.title, null)
  assert.equal(entry.summary, null)
  assert.equal(entry.summarySlug, null)
})

test('normalization coerces the new fields: clamp, finite numbers, filtered PRs', () => {
  const snap = normalizeSnapshot({
    ranges: { '7d': {} },
    sessions: [
      {
        harness: 'claude',
        repo: 'dev-portfolio',
        sessionId: 'full',
        day: '2026-08-17',
        startTs: '2026-08-17T00:00:00Z',
        title: 'Ship pivot',
        summary: 'Summary text',
        summarySlug: 'pivot',
        assistantMessages: 42,
        locDelta: { added: 120, removed: 40, net: 80 },
        prRefs: [15, 16],
        branch: 'main',
      },
      {
        harness: 'pi',
        repo: 'r',
        sessionId: 'messy',
        assistantMessages: -5, // clamped to 0
        locDelta: { added: 'nope', removed: 7 }, // partial -> zeros for missing
        prRefs: [3, 'junk', Number.NaN, 9], // non-finite dropped
        branch: '',
        title: '',
      },
    ],
  })
  assert.ok(snap)
  assert.equal(snap.sessions.length, 2)
  const full = snap.sessions[0]
  assert.equal(full.assistantMessages, 42)
  assert.deepEqual(full.locDelta, { added: 120, removed: 40, net: 80 })
  assert.deepEqual(full.prRefs, [15, 16])
  assert.equal(full.branch, 'main')
  assert.equal(full.title, 'Ship pivot')
  const messy = snap.sessions[1]
  assert.equal(messy.assistantMessages, 0)
  assert.deepEqual(messy.locDelta, { added: 0, removed: 7, net: 0 })
  assert.deepEqual(messy.prRefs, [3, 9])
  assert.equal(messy.branch, null)
  assert.equal(messy.title, null)
})

// ---- seats ---------------------------------------------------------------

test('SEAT_POSITIONS has 16 slots matching the furniture formula', () => {
  const desks = [
    { cx: 1.0, cz: -1.5 },
    { cx: 1.0, cz: 2.5 },
  ]
  const expected: [number, number, number][] = []
  for (const desk of desks) {
    for (let wi = 0; wi < 8; wi++) {
      const side = wi < 4 ? -1 : 1
      const col = wi % 4
      expected.push([desk.cx - 1.5 + col * 1.0, SEAT_Y, desk.cz + side * 0.85])
    }
  }
  assert.equal(SEAT_POSITIONS.length, 16)
  assert.deepEqual([...SEAT_POSITIONS], expected)
  assert.deepEqual(SEAT_POSITIONS[0], [-0.5, SEAT_Y, -2.35]) // desk 0, wi 0
  assert.deepEqual(SEAT_POSITIONS[15], [2.5, SEAT_Y, 3.35]) // desk 1, wi 7
})
