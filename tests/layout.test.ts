import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptySnapshot, normalizeSnapshot } from '../lib/data'
import {
  aggregateReposByRepo,
  buildKrabLayout,
  COUCH_SPOTLIGHT_SEAT,
  repoTooltipBody,
  resolveFocus,
  SEAT_CAPACITY,
  SEAT_POSITIONS,
  SEAT_Y,
  sessionRow,
  sessionScale,
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

// ---- repo mode at every range --------------------------------------------

test('buildKrabLayout returns repos mode for every range (7d included)', () => {
  const sessions = [
    s({ harness: 'omp', repo: 'alpha', sessionId: 'a1', assistantMessages: 5 }),
    s({ harness: 'claude', repo: 'alpha', sessionId: 'a2', assistantMessages: 3 }),
    s({ harness: 'pi', repo: 'beta', sessionId: 'b1', assistantMessages: 20 }),
  ]
  for (const range of ['7d', '30d', '90d', '1y', 'all'] as const) {
    const layout = buildKrabLayout({ sessions, range, snapshotDate: '2026-08-17' })
    assert.equal(layout.mode, 'repos', `expected repos mode at ${range}`)
    if (layout.mode !== 'repos') return
    assert.deepEqual(layout.items.map((i) => i.key), ['beta', 'alpha']) // msgs desc
    assert.equal(layout.overflow, 0)
  }
})

test('buildKrabLayout at 7d aggregates sessions into repo items (no per-session krabs)', () => {
  const sessions = [
    s({ harness: 'omp', repo: 'dev-portfolio', sessionId: 'a', assistantMessages: 5 }),
    s({ harness: 'pi', repo: 'dev-portfolio', sessionId: 'b', assistantMessages: 2 }),
    s({ harness: 'codex', repo: 'blog', sessionId: 'c', assistantMessages: 20 }),
  ]
  const layout = buildKrabLayout({ sessions, range: '7d', snapshotDate: '2026-08-17' })
  assert.equal(layout.mode, 'repos')
  if (layout.mode !== 'repos') return
  assert.deepEqual(layout.items.map((i) => i.key), ['blog', 'dev-portfolio'])
  assert.deepEqual(layout.items.map((i) => i.seatIndex), [0, 1])
  assert.equal(layout.items[1].tooltipTitle, 'dev-portfolio · omp') // dominant harness
})

test('repo mode respects capacity and reports overflow at 7d', () => {
  const sessions: SessionEntry[] = []
  for (let i = 0; i < 18; i++) {
    sessions.push(
      s({ harness: 'omp', repo: `repo-${String(i).padStart(2, '0')}`, sessionId: `s${i}`, assistantMessages: i }),
    )
  }
  const layout = buildKrabLayout({ sessions, range: '7d', snapshotDate: '2026-08-17' })
  assert.equal(layout.mode, 'repos')
  if (layout.mode !== 'repos') return
  assert.equal(layout.items.length, SEAT_CAPACITY)
  assert.equal(layout.overflow, 2)
  assert.equal(layout.items[0].key, 'repo-17') // biggest first
  assert.equal(layout.items.some((i) => i.key === 'repo-00'), false) // smallest overflows
})

test('capacity can be overridden for smaller scenes', () => {
  const sessions = [
    s({ harness: 'omp', repo: 'a', sessionId: 'a1', assistantMessages: 3 }),
    s({ harness: 'claude', repo: 'b', sessionId: 'b1', assistantMessages: 2 }),
    s({ harness: 'pi', repo: 'c', sessionId: 'c1', assistantMessages: 1 }),
  ]
  const layout = buildKrabLayout({ sessions, range: '7d', snapshotDate: '2026-08-17', capacity: 2 })
  assert.equal(layout.mode, 'repos')
  if (layout.mode !== 'repos') return
  assert.equal(layout.items.length, 2)
  assert.equal(layout.overflow, 1)
  assert.deepEqual(layout.items.map((i) => i.key), ['a', 'b'])
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
  assert.equal(layout.mode, 'repos')
  if (layout.mode !== 'repos') return
  assert.equal(layout.items.length, 1)
  assert.equal(layout.items[0].repo, 'r')
  // out-of-window session ignored even if bigger
  assert.match(layout.items[0].tooltipBody, /1 sessions · 1 days · 1 assistant msgs/)
})

test('30d window is wider than the 7d window', () => {
  const sessions = [s({ harness: 'pi', repo: 'r', sessionId: 'old', day: '2026-07-20', startTs: '2026-07-20T00:00:00Z' })]
  const layout = buildKrabLayout({ sessions, range: '30d', snapshotDate: '2026-08-17' })
  assert.equal(layout.mode, 'repos')
  if (layout.mode !== 'repos') return
  assert.equal(layout.items.length, 1)
  assert.equal(layout.items[0].repo, 'r')
})

test("'all' grain includes every session regardless of day", () => {
  const sessions = [
    s({ harness: 'claude', repo: 'r', sessionId: 'recent', day: '2026-08-17', assistantMessages: 1 }),
    s({ harness: 'pi', repo: 'r', sessionId: 'ancient', day: '2025-01-01', assistantMessages: 9 }),
  ]
  const layout = buildKrabLayout({ sessions, range: 'all', snapshotDate: '2026-08-17' })
  assert.equal(layout.mode, 'repos')
  if (layout.mode !== 'repos') return
  assert.equal(layout.items.length, 1) // both sessions collapse into repo 'r'
  assert.equal(layout.items[0].key, 'r')
  assert.match(layout.items[0].tooltipBody, /2 sessions · 2 days · 10 assistant msgs/)
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

// ---- session rows (focus panel) ------------------------------------------

test('sessionRow contains day, msgs, LOC, PR refs and title (title wins over summary)', () => {
  const row = sessionRow(
    s({
      harness: 'omp',
      repo: 'dev-portfolio',
      sessionId: 'a',
      day: '2026-08-17',
      assistantMessages: 42,
      locDelta: { added: 120, removed: 40, net: 80 },
      prRefs: [15, 16],
      title: 'Ship pivot',
      summary: 'Ignored summary',
    }),
  )
  assert.equal(row, '2026-08-17 · 42 msgs · +120/−40 LOC · #15 · #16 · Ship pivot')
})

test('sessionRow omits the LOC clause when the session has no commits', () => {
  const row = sessionRow(s({ harness: 'pi', repo: 'r', sessionId: 'b', assistantMessages: 7, prRefs: [3] }))
  assert.equal(row, '2026-08-17 · 7 msgs · #3')
})

test('sessionRow falls back to summary when title is absent, and omits both when null', () => {
  const withSummary = sessionRow(
    s({ harness: 'codex', repo: 'r', sessionId: 'c', day: '2026-08-16', assistantMessages: 2, summary: 'Harvested.' }),
  )
  assert.equal(withSummary, '2026-08-16 · 2 msgs · Harvested.')
  const bare = sessionRow(s({ harness: 'codex', repo: 'r', sessionId: 'd', assistantMessages: 0 }))
  assert.equal(bare, '2026-08-17 · 0 msgs')
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

test('COUCH_SPOTLIGHT_SEAT is the couch 1 seat top facing into the room', () => {
  assert.deepEqual(COUCH_SPOTLIGHT_SEAT, [-4.2, 0.54, 5.25])
})

// ---- repo aggregation (all ranges) ---------------------------------------

test('buildKrabLayout at 30d aggregates by repo into mode repos', () => {
  const sessions = [
    s({ harness: 'omp', repo: 'alpha', sessionId: 'a1', assistantMessages: 5 }),
    s({ harness: 'claude', repo: 'alpha', sessionId: 'a2', assistantMessages: 3 }),
    s({ harness: 'pi', repo: 'beta', sessionId: 'b1', assistantMessages: 20 }),
  ]
  const layout = buildKrabLayout({ sessions, range: '30d', snapshotDate: '2026-08-17' })
  assert.equal(layout.mode, 'repos')
  if (layout.mode !== 'repos') return
  assert.deepEqual(layout.items.map((i) => i.key), ['beta', 'alpha']) // msgs desc
  assert.equal(layout.overflow, 0)
  const alpha = layout.items[1]
  assert.equal(alpha.repo, 'alpha')
  assert.equal(alpha.harness, 'omp') // dominant harness by session count
  assert.equal(alpha.tooltipTitle, 'alpha · omp')
  assert.equal(alpha.seatIndex, 1)
})

test('repos mode respects capacity and reports overflow', () => {
  const sessions: SessionEntry[] = []
  for (let i = 0; i < 18; i++) {
    sessions.push(
      s({ harness: 'omp', repo: `repo-${String(i).padStart(2, '0')}`, sessionId: `s${i}`, assistantMessages: i }),
    )
  }
  const layout = buildKrabLayout({ sessions, range: 'all', snapshotDate: '2026-08-17' })
  assert.equal(layout.mode, 'repos')
  if (layout.mode !== 'repos') return
  assert.equal(layout.items.length, SEAT_CAPACITY)
  assert.equal(layout.overflow, 2)
  assert.equal(layout.items[0].key, 'repo-17') // biggest first
  assert.equal(layout.items.some((i) => i.key === 'repo-00'), false) // smallest overflows
})

test('aggregateReposByRepo sums msgs, LOC, PR refs and distinct days', () => {
  const sessions = [
    s({
      harness: 'claude',
      repo: 'r',
      sessionId: 'a',
      assistantMessages: 10,
      day: '2026-08-15',
      locDelta: { added: 100, removed: 20, net: 80 },
      prRefs: [1, 2],
    }),
    s({ harness: 'claude', repo: 'r', sessionId: 'b', assistantMessages: 5, day: '2026-08-15', locDelta: null, prRefs: [] }),
    s({ harness: 'pi', repo: 'r', sessionId: 'c', assistantMessages: 2, day: '2026-08-16', locDelta: { added: 7, removed: 3, net: 4 }, prRefs: [9] }),
  ]
  const [agg] = aggregateReposByRepo(sessions)
  assert.equal(agg.sessions.length, 3)
  assert.equal(agg.assistantMessages, 17)
  assert.equal(agg.locAdded, 107)
  assert.equal(agg.locRemoved, 23)
  assert.equal(agg.prRefs, 3)
  assert.equal(agg.daysActive, 2)
})

test('aggregateReposByRepo retains the repo window sessions newest-first with tie-break', () => {
  const sessions = [
    s({ harness: 'omp', repo: 'r', sessionId: 'old', day: '2026-08-10', startTs: '2026-08-10T09:00:00Z', assistantMessages: 10 }),
    s({ harness: 'claude', repo: 'r', sessionId: 'new', day: '2026-08-17', startTs: '2026-08-17T09:00:00Z', assistantMessages: 1 }),
    s({ harness: 'pi', repo: 'r', sessionId: 'tie-b', startTs: '2026-08-16T12:00:00Z', assistantMessages: 3 }),
    s({ harness: 'pi', repo: 'r', sessionId: 'tie-a', startTs: '2026-08-16T12:00:00Z', assistantMessages: 2 }),
    s({ harness: 'codex', repo: 'other', sessionId: 'x', assistantMessages: 7 }),
  ]
  const [agg, other] = aggregateReposByRepo(sessions)
  // exactly the repo's window sessions, newest-first; startTs tie broken by `${harness}:${sessionId}`
  assert.deepEqual(agg.sessions, [sessions[1], sessions[3], sessions[2], sessions[0]])
  assert.deepEqual(other.sessions, [sessions[4]])
  assert.equal(agg.assistantMessages, 16) // sums unchanged by retention
  assert.equal(agg.daysActive, 2)
})

test('aggregateReposByRepo picks dominant harness, ties by HARNESSES order', () => {
  const [agg] = aggregateReposByRepo([
    s({ harness: 'pi', repo: 'r', sessionId: 'p1' }),
    s({ harness: 'omp', repo: 'r', sessionId: 'o1' }),
    s({ harness: 'omp', repo: 'r', sessionId: 'o2' }),
  ])
  assert.equal(agg.harness, 'omp')
  assert.deepEqual(agg.harnesses.map((h) => h.harness), ['omp', 'pi'])
})

test('aggregateReposByRepo orders repos by magnitude then name', () => {
  const repos = aggregateReposByRepo([
    s({ harness: 'omp', repo: 'zebra', sessionId: 'z', assistantMessages: 5 }),
    s({ harness: 'omp', repo: 'alpha', sessionId: 'a', assistantMessages: 5 }),
    s({ harness: 'omp', repo: 'mid', sessionId: 'm', assistantMessages: 9 }),
  ]).map((r) => r.repo)
  assert.deepEqual(repos, ['mid', 'alpha', 'zebra'])
})

test('repoTooltipBody contains sessions, days, msgs, LOC, PRs and harnesses', () => {
  const [agg] = aggregateReposByRepo([
    s({ harness: 'claude', repo: 'r', sessionId: 'a', assistantMessages: 10, locDelta: { added: 5, removed: 2, net: 3 }, prRefs: [1] }),
    s({ harness: 'pi', repo: 'r', sessionId: 'b', assistantMessages: 4 }),
  ])
  const body = repoTooltipBody(agg)
  assert.match(body, /2 sessions · 1 days · 14 assistant msgs/)
  assert.match(body, /\+5\/−2 LOC · 1 PR refs/)
  assert.match(body, /claude 1 · pi 1/)
})

test('repoTooltipBody omits the PR refs suffix when none', () => {
  const [agg] = aggregateReposByRepo([s({ harness: 'omp', repo: 'r', sessionId: 'a', assistantMessages: 1 })])
  const body = repoTooltipBody(agg)
  assert.match(body, /\+0\/−0 LOC/)
  assert.doesNotMatch(body, /PR refs/)
})

test('empty window at 30d renders an empty layout', () => {
  const layout = buildKrabLayout({
    sessions: [s({ harness: 'omp', repo: 'r', sessionId: 'x', day: '2026-01-01' })],
    range: '30d',
    snapshotDate: '2026-08-17',
  })
  assert.equal(layout.mode, 'empty')
})

// ---- focus resolution ----------------------------------------------------

test('resolveFocus returns a desk target for a seated repo', () => {
  const sessions = [
    s({ harness: 'omp', repo: 'alpha', sessionId: 'a1', assistantMessages: 5 }),
    s({ harness: 'claude', repo: 'beta', sessionId: 'b1', assistantMessages: 20 }),
  ]
  const layout = buildKrabLayout({ sessions, range: '7d', snapshotDate: '2026-08-17' })
  assert.equal(layout.mode, 'repos')
  if (layout.mode !== 'repos') return
  const repos = aggregateReposByRepo(sessions)
  const focus = resolveFocus(layout.items, repos, 'beta')
  assert.ok(focus !== null && focus.kind === 'desk')
  if (focus === null || focus.kind !== 'desk') return
  assert.equal(focus.item.key, 'beta')
  assert.equal(focus.item.seatIndex, 0)
})

test('resolveFocus returns a couch target for an overflow repo', () => {
  const sessions: SessionEntry[] = []
  for (let i = 0; i < 18; i++) {
    sessions.push(
      s({ harness: 'omp', repo: `repo-${String(i).padStart(2, '0')}`, sessionId: `s${i}`, assistantMessages: i }),
    )
  }
  const layout = buildKrabLayout({ sessions, range: 'all', snapshotDate: '2026-08-17' })
  assert.equal(layout.mode, 'repos')
  if (layout.mode !== 'repos') return
  const repos = aggregateReposByRepo(sessions)
  assert.equal(repos.length, 18)
  assert.equal(layout.items.some((i) => i.repo === 'repo-00'), false) // overflowed, not on a desk
  const focus = resolveFocus(layout.items, repos, 'repo-00')
  assert.ok(focus !== null && focus.kind === 'couch')
  if (focus === null || focus.kind !== 'couch') return
  assert.equal(focus.repo.repo, 'repo-00')
})

test('resolveFocus returns null for no selection and unknown repos', () => {
  const sessions = [s({ harness: 'omp', repo: 'alpha', sessionId: 'a1', assistantMessages: 5 })]
  const layout = buildKrabLayout({ sessions, range: '7d', snapshotDate: '2026-08-17' })
  assert.equal(layout.mode, 'repos')
  if (layout.mode !== 'repos') return
  const repos = aggregateReposByRepo(sessions)
  assert.equal(resolveFocus(layout.items, repos, null), null)
  assert.equal(resolveFocus(layout.items, repos, 'ghost'), null)
})
