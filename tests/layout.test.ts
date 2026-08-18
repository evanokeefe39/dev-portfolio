import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptySnapshot, normalizeSnapshot } from '../lib/data'
import { buildAgentLayout, SEAT_CAPACITY, SEAT_POSITIONS, SEAT_Y } from '../components/scene/layout'
import type { Rollups, SessionEntry } from '../lib/types'

// ---- helpers -------------------------------------------------------------

function s(over: Partial<SessionEntry> & Pick<SessionEntry, 'harness' | 'repo' | 'sessionId'>): SessionEntry {
  return {
    harness: over.harness,
    repo: over.repo,
    sessionId: over.sessionId,
    day: over.day ?? '2026-08-17',
    startTs: over.startTs ?? '2026-08-17T00:00:00Z',
    summary: over.summary ?? null,
    summarySlug: over.summarySlug ?? null,
    fallback: over.fallback ?? null,
  }
}

// ---- render rule: per-session (<= 16) ------------------------------------

test('sparse window -> per-session, summary used when present, fallback otherwise', () => {
  const sessions = [
    s({
      harness: 'omp',
      repo: 'dev-portfolio',
      sessionId: 'a',
      day: '2026-08-17',
      startTs: '2026-08-17T10:00:00Z',
      summary: 'Refactored the scene loader.',
    }),
    s({
      harness: 'claude',
      repo: 'blog',
      sessionId: 'b',
      day: '2026-08-16',
      startTs: '2026-08-16T09:00:00Z',
      fallback: 'Post draft · 2 commits, +10/-3',
    }),
  ]
  const layout = buildAgentLayout({ sessions, rollups: {}, range: '7d', snapshotDate: '2026-08-17' })
  assert.equal(layout.mode, 'per-session')
  if (layout.mode !== 'per-session') return
  assert.equal(layout.items.length, 2)
  assert.equal(layout.items[0].tooltip, 'Refactored the scene loader.') // summary
  assert.equal(layout.items[1].tooltip, 'Post draft · 2 commits, +10/-3') // fallback
  assert.deepEqual(layout.items.map((i) => i.seatIndex), [0, 1]) // newest first
  assert.equal(layout.items[0].title, 'dev-portfolio')
})

test('summary wins over fallback when both are present', () => {
  const sessions = [
    s({ harness: 'omp', repo: 'r', sessionId: 'q1', day: '2026-08-17', summary: 'The summary.', fallback: 'The fallback.' }),
  ]
  const layout = buildAgentLayout({ sessions, rollups: {}, range: '7d', snapshotDate: '2026-08-17' })
  assert.equal(layout.mode, 'per-session')
  if (layout.mode !== 'per-session') return
  assert.equal(layout.items[0].tooltip, 'The summary.')
})

test('session with neither summary nor fallback uses "harness · day"', () => {
  const sessions = [s({ harness: 'codex', repo: 'r', sessionId: 'z1', day: '2026-08-16', startTs: '2026-08-16T08:00:00Z' })]
  const layout = buildAgentLayout({ sessions, rollups: {}, range: '7d', snapshotDate: '2026-08-17' })
  assert.equal(layout.mode, 'per-session')
  if (layout.mode !== 'per-session') return
  assert.equal(layout.items[0].tooltip, 'codex · 2026-08-16')
})

// ---- render rule: collapsed (> 16) ---------------------------------------

test('dense window -> collapsed to repo x harness groups, top-N by count, rollup tooltips', () => {
  const sessions: SessionEntry[] = []
  for (let i = 0; i < 9; i++) {
    sessions.push(s({ harness: 'omp', repo: 'dev-portfolio', sessionId: `a${i}`, day: '2026-08-17' }))
  }
  for (let i = 0; i < 8; i++) {
    sessions.push(s({ harness: 'claude', repo: 'blog', sessionId: `b${i}`, day: '2026-08-17' }))
  }
  for (let i = 0; i < 2; i++) {
    sessions.push(s({ harness: 'pi', repo: 'dev-portfolio', sessionId: `c${i}`, day: '2026-08-17' }))
  }
  const rollups: Rollups = {
    '7d': {
      'dev-portfolio|omp': 'Nine sessions of portfolio work.',
      'blog|claude': 'Eight blog sessions.',
    },
  }
  const layout = buildAgentLayout({ sessions, rollups, range: '7d', snapshotDate: '2026-08-17' })
  assert.equal(layout.mode, 'collapsed')
  if (layout.mode !== 'collapsed') return
  assert.equal(layout.items.length, 3)
  assert.deepEqual(layout.items.map((i) => i.sessionCount), [9, 8, 2]) // sorted by activity
  assert.equal(layout.items[0].tooltip, 'Nine sessions of portfolio work.') // rollup
  assert.equal(layout.items[1].tooltip, 'Eight blog sessions.')
  assert.equal(layout.items[2].tooltip, 'Summary pending') // pair not rolled up yet
  assert.deepEqual(layout.items.map((i) => i.seatIndex), [0, 1, 2])
  assert.equal(layout.items[0].title, 'dev-portfolio · omp')
  assert.equal(layout.overflow, 0)
})

test('overflow reports groups beyond seat capacity', () => {
  const sessions: SessionEntry[] = []
  for (let g = 0; g < 17; g++) {
    sessions.push(s({ harness: 'omp', repo: `repo-${String(g).padStart(2, '0')}`, sessionId: `g${g}`, day: '2026-08-17' }))
  }
  const layout = buildAgentLayout({ sessions, rollups: {}, range: 'all', snapshotDate: '2026-08-17' })
  assert.equal(layout.mode, 'collapsed')
  if (layout.mode !== 'collapsed') return
  assert.equal(layout.items.length, SEAT_CAPACITY)
  assert.equal(layout.overflow, 1)
  // equal session counts -> deterministic key tie-break (zero-padded repo ascending)
  assert.equal(layout.items[0].repo, 'repo-00')
  assert.equal(layout.items[SEAT_CAPACITY - 1].repo, 'repo-15')
})

test('capacity can be overridden for smaller scenes', () => {
  const sessions = [
    s({ harness: 'omp', repo: 'a', sessionId: 'a1', day: '2026-08-17' }),
    s({ harness: 'claude', repo: 'b', sessionId: 'b1', day: '2026-08-17' }),
    s({ harness: 'pi', repo: 'c', sessionId: 'c1', day: '2026-08-17' }),
  ]
  const layout = buildAgentLayout({ sessions, rollups: {}, range: 'all', snapshotDate: '2026-08-17', capacity: 2 })
  assert.equal(layout.mode, 'collapsed')
  if (layout.mode !== 'collapsed') return
  assert.equal(layout.items.length, 2)
  assert.equal(layout.overflow, 1)
})

test('repo x harness without window activity does not appear', () => {
  const sessions = [s({ harness: 'omp', repo: 'active-repo', sessionId: 'a1', day: '2026-08-17' })]
  const rollups: Rollups = { '7d': { 'old-repo|claude': 'Stale rollup for an inactive pair.' } }
  const layout = buildAgentLayout({ sessions, rollups, range: '7d', snapshotDate: '2026-08-17' })
  assert.equal(layout.mode, 'per-session')
  if (layout.mode !== 'per-session') return
  assert.equal(layout.items.length, 1)
  assert.equal(layout.items[0].repo, 'active-repo')
})

// ---- empty window --------------------------------------------------------

test('empty window renders an empty layout', () => {
  const empty = buildAgentLayout({ sessions: [], rollups: {}, range: '7d', snapshotDate: '2026-08-17' })
  assert.equal(empty.mode, 'empty')
  const outOfWindow = buildAgentLayout({
    sessions: [s({ harness: 'omp', repo: 'r', sessionId: 'x', day: '2026-08-01' })],
    rollups: {},
    range: '7d',
    snapshotDate: '2026-08-17',
  })
  assert.equal(outOfWindow.mode, 'empty')
})

// ---- grain windows -------------------------------------------------------

test('7d window includes snapshotDate-6 and excludes snapshotDate-7', () => {
  const sessions = [
    s({ harness: 'omp', repo: 'r', sessionId: 'in', day: '2026-08-11', startTs: '2026-08-11T10:00:00Z' }),
    s({ harness: 'claude', repo: 'r', sessionId: 'out', day: '2026-08-10', startTs: '2026-08-10T10:00:00Z' }),
  ]
  const layout = buildAgentLayout({ sessions, rollups: {}, range: '7d', snapshotDate: '2026-08-17' })
  assert.equal(layout.mode, 'per-session')
  if (layout.mode !== 'per-session') return
  assert.deepEqual(layout.items.map((i) => i.key), ['omp:in'])
})

test('30d window is wider than the 7d window', () => {
  const sessions = [s({ harness: 'pi', repo: 'r', sessionId: 'old', day: '2026-07-20', startTs: '2026-07-20T00:00:00Z' })]
  const layout = buildAgentLayout({ sessions, rollups: {}, range: '30d', snapshotDate: '2026-08-17' })
  assert.equal(layout.mode, 'per-session')
  if (layout.mode !== 'per-session') return
  assert.equal(layout.items.length, 1)
})

test("'all' grain includes every session and reads the 'all' rollup bucket", () => {
  const sessions: SessionEntry[] = []
  for (let i = 0; i < 9; i++) sessions.push(s({ harness: 'claude', repo: 'r', sessionId: `c${i}`, day: '2026-08-17' }))
  for (let i = 0; i < 9; i++) sessions.push(s({ harness: 'pi', repo: 'r', sessionId: `p${i}`, day: '2025-01-01' }))
  const rollups: Rollups = { all: { 'r|pi': 'Full-history roundup.' } }
  const layout = buildAgentLayout({ sessions, rollups, range: 'all', snapshotDate: '2026-08-17' })
  assert.equal(layout.mode, 'collapsed')
  if (layout.mode !== 'collapsed') return
  assert.equal(layout.items.find((i) => i.harness === 'pi')?.tooltip, 'Full-history roundup.')
  assert.equal(layout.items.find((i) => i.harness === 'pi')?.sessionCount, 9)
  // same sessions under '7d': only the 9 claude sessions fall inside -> per-session
  const week = buildAgentLayout({ sessions, rollups, range: '7d', snapshotDate: '2026-08-17' })
  assert.equal(week.mode, 'per-session')
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

// ---- normalization -------------------------------------------------------

test('old snapshots without sessions/rollups still normalize', () => {
  const snap = normalizeSnapshot({ ranges: { '7d': {} } })
  assert.ok(snap)
  assert.deepEqual(snap.sessions, [])
  assert.deepEqual(snap.rollups, {})
  assert.deepEqual(snap.rollupErrors, {})
  const empty = emptySnapshot()
  assert.deepEqual(empty.sessions, [])
  assert.deepEqual(empty.rollups, {})
  assert.deepEqual(empty.rollupErrors, {})
})

test('normalization drops malformed sessions and non-string rollup values', () => {
  const snap = normalizeSnapshot({
    ranges: { '7d': {} },
    sessions: [
      { harness: 'omp', repo: 'dev-portfolio', sessionId: 'ok', day: '2026-08-17', startTs: '2026-08-17T00:00:00Z' },
      { harness: 'neovim', repo: 'bad-harness', sessionId: 'x' }, // unknown harness dropped
      { repo: 'no-harness', sessionId: 'y' }, // missing harness dropped
      'garbage',
      null,
    ],
    rollups: {
      '7d': { 'dev-portfolio|omp': 42, 'dev-portfolio|claude': 'text', 'dev-portfolio|pi': '' },
      bogus: { 'dev-portfolio|codex': 'ignored' },
    },
    rollupErrors: { '7d': { 'dev-portfolio|pi': 'boom' }, '30d': 'nope' },
  })
  assert.ok(snap)
  assert.equal(snap.sessions.length, 1)
  assert.equal(snap.sessions[0].harness, 'omp')
  assert.equal(snap.sessions[0].summary, null)
  assert.equal(snap.sessions[0].summarySlug, null)
  assert.equal(snap.sessions[0].fallback, null)
  assert.deepEqual(snap.rollups['7d'], { 'dev-portfolio|claude': 'text' })
  assert.equal('bogus' in snap.rollups, false)
  assert.deepEqual(snap.rollupErrors['7d'], { 'dev-portfolio|pi': 'boom' })
  assert.equal(snap.rollupErrors['30d'], undefined) // non-record grain dropped
})
