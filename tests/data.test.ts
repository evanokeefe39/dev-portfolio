import { readFileSync, existsSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptySnapshot, loadSnapshot, normalizeSnapshot } from '../lib/data'
import {
  barPercent,
  formatISODate,
  formatPct,
  formatSignedInt,
  formatTokens,
  sparklinePoints,
} from '../lib/format'
import { RANGE_KEYS } from '../lib/types'

// Fixture shaped exactly like the locked snapshot schema (portfolio-plan.md).
const FIXTURE = {
  snapshotDate: '2026-08-17',
  generatedAt: '2026-08-17T22:00:00+02:00',
  ranges: {
    '7d': {
      tokenBurn: {
        total: 1200000,
        changePct: 18,
        sparkline: [80000, 95000, 120000, 110000, 150000, 180000, 200000],
      },
      tokensByModel: [
        { model: 'sonnet', tokens: 540000 },
        { model: 'opus', tokens: 380000 },
        { model: 'haiku', tokens: 120000 },
      ],
      cost: { total: 4.21, breakdown: { input: 1.1, output: 2.0, cacheWrite: 0.6, cacheRead: 0.51 } },
      sessions: { total: 42, active: 3 },
      prsReferenced: { count: 8, activeRepos: 3, sparkline: [1, 2, 3, 1, 2, 3, 2] },
      locDelta: { net: 2847, added: 3412, removed: 565, sparkline: [[67, 12], [120, 30]] },
    },
  },
  recentActivity: [
    {
      repo: 'dev-portfolio',
      message: 'Refactor DB layer (#247)',
      prRefs: [247],
      branch: 'fix/api-rate-limit',
      linesAdded: 67,
      linesRemoved: 12,
      ts: '2026-08-15T14:30:00Z',
    },
    {
      repo: 'loc-dock',
      message: 'no ref here',
      prRefs: [],
      branch: null,
      linesAdded: 1,
      linesRemoved: 1,
      ts: '2026-08-16T09:00:00Z',
    },
  ],
}

test('normalizeSnapshot keeps a valid snapshot and fills all five ranges', () => {
  const snap = normalizeSnapshot(FIXTURE)
  assert.ok(snap)
  for (const key of RANGE_KEYS) {
    assert.ok(snap.ranges[key], `missing range ${key}`)
  }
  assert.equal(snap.ranges['7d'].tokenBurn.total, 1200000)
  assert.equal(snap.ranges['7d'].tokenBurn.changePct, 18)
  assert.equal(snap.ranges['7d'].locDelta.sparkline.length, 2)
  assert.equal(snap.ranges['7d'].cost.breakdown.input, 1.1)
  assert.equal(snap.recentActivity.length, 2)
  assert.equal(snap.recentActivity[0].branch, 'fix/api-rate-limit')
})

test('normalizeSnapshot ranks tokensByModel descending even if unsorted', () => {
  const snap = normalizeSnapshot({
    ranges: {
      '7d': {
        tokensByModel: [
          { model: 'haiku', tokens: 120000 },
          { model: 'sonnet', tokens: 540000 },
        ],
      },
    },
  })
  assert.ok(snap)
  const models = snap.ranges['7d'].tokensByModel
  assert.deepEqual(models.map((m) => m.model), ['sonnet', 'haiku'])
})

test('normalizeSnapshot rejects non-snapshot payloads', () => {
  assert.equal(normalizeSnapshot(null), null)
  assert.equal(normalizeSnapshot(undefined), null)
  assert.equal(normalizeSnapshot('nope'), null)
  assert.equal(normalizeSnapshot(42), null)
  assert.equal(normalizeSnapshot({}), null)
  assert.equal(normalizeSnapshot({ ranges: [] }), null)
  assert.equal(normalizeSnapshot({ ranges: '7d' }), null)
})

test('normalizeSnapshot zero-fills partial ranges instead of crashing', () => {
  const snap = normalizeSnapshot({ ranges: { '7d': {} }, recentActivity: [{ repo: 'x' }] })
  assert.ok(snap)
  const s = snap.ranges['7d']
  assert.equal(s.tokenBurn.total, 0)
  assert.equal(s.tokenBurn.changePct, null)
  assert.deepEqual(s.tokensByModel, [])
  assert.equal(s.cost.total, 0)
  assert.equal(s.sessions.active, 0)
  assert.equal(s.prsReferenced.count, 0)
  assert.equal(s.locDelta.net, 0)
  assert.equal(snap.recentActivity.length, 0) // malformed activity item dropped
})

test('emptySnapshot is all zeros with all five ranges', () => {
  const snap = emptySnapshot()
  for (const key of RANGE_KEYS) {
    const s = snap.ranges[key]
    assert.equal(s.tokenBurn.total, 0)
    assert.equal(s.prsReferenced.count, 0)
    assert.equal(s.locDelta.net, 0)
    assert.deepEqual(s.tokensByModel, [])
  }
  assert.deepEqual(snap.recentActivity, [])
})

test('loadSnapshot resolves null on 404', async () => {
  const real = globalThis.fetch
  globalThis.fetch = (async () => new Response('{}', { status: 404 })) as unknown as typeof fetch
  try {
    assert.equal(await loadSnapshot(), null)
  } finally {
    globalThis.fetch = real
  }
})

test('loadSnapshot resolves null on malformed JSON', async () => {
  const real = globalThis.fetch
  globalThis.fetch = (async () => new Response('not json', { status: 200 })) as unknown as typeof fetch
  try {
    assert.equal(await loadSnapshot(), null)
  } finally {
    globalThis.fetch = real
  }
})

test('loadSnapshot resolves a valid snapshot', async () => {
  const real = globalThis.fetch
  globalThis.fetch = (async () => new Response(JSON.stringify(FIXTURE), { status: 200 })) as unknown as typeof fetch
  try {
    const snap = await loadSnapshot()
    assert.ok(snap)
    assert.equal(snap.ranges['7d'].tokenBurn.total, 1200000)
  } finally {
    globalThis.fetch = real
  }
})

test('formatTokens compacts large numbers', () => {
  assert.equal(formatTokens(1200000), '1.2M')
  assert.equal(formatTokens(84000), '84K')
  assert.equal(formatTokens(999), '999')
  assert.equal(formatTokens(1000000000), '1B')
  assert.equal(formatTokens(0), '0')
  assert.equal(formatTokens(Number.NaN), '0')
})

test('formatPct signs and nulls', () => {
  assert.equal(formatPct(18), '+18.0%')
  assert.equal(formatPct(-5.55), '-5.5%')
  assert.equal(formatPct(null), null)
  assert.equal(formatPct(undefined), null)
  assert.equal(formatPct(Number.NaN), null)
})

test('formatSignedInt signs', () => {
  assert.equal(formatSignedInt(2847), '+2,847')
  assert.equal(formatSignedInt(-12), '-12')
})

test('formatISODate is timezone-safe', () => {
  assert.equal(formatISODate('2026-08-17'), 'Aug 17, 2026')
  assert.equal(formatISODate(''), '')
})

test('sparklinePoints handles flat and normal series', () => {
  assert.equal(sparklinePoints([], 100, 40), '')
  const flat = sparklinePoints([5, 5, 5], 100, 40)
  const ys = flat.split(' ').map((p) => p.split(',')[1])
  assert.equal(ys[0], ys[1])
  assert.equal(ys[1], ys[2])
  const normal = sparklinePoints([0, 10], 100, 40).split(' ')
  assert.equal(normal.length, 2)
  assert.equal(normal[0], '0.00,39.00') // min at bottom
  assert.equal(normal[1], '100.00,1.00') // max near top
})

test('barPercent clamps and floors', () => {
  assert.equal(barPercent(5, 10), 50)
  assert.equal(barPercent(10, 10), 100)
  assert.equal(barPercent(0, 10), 0)
  assert.equal(barPercent(1, 1000), 6) // min visibility floor
  assert.equal(barPercent(5, 0), 0)
})

test('real snapshot file normalizes if present (owned by data_pipeline)', () => {
  const p = 'public/data/current.json'
  if (!existsSync(p)) {
    return // file not produced yet — this is the graceful 404 path
  }
  const raw = JSON.parse(readFileSync(p, 'utf8'))
  const snap = normalizeSnapshot(raw)
  assert.ok(snap)
  for (const key of RANGE_KEYS) {
    assert.ok(snap.ranges[key])
  }
})
