import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ensureRangeSessions,
  getSnapshotState,
  startSnapshotLoad,
  subscribeSnapshot,
} from '../lib/snapshot-store'

// Minimal snapshot payload — normalizeSnapshot zero-fills the missing ranges.
const FIXTURE = {
  snapshotDate: '2026-08-18',
  generatedAt: '2026-08-18T00:00:00Z',
  ranges: {
    '7d': {
      tokenBurn: { total: 1, changePct: null, sparkline: [1] },
      tokensByModel: [{ model: 'sonnet', tokens: 1 }],
      cost: { total: 0.01, breakdown: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 } },
      sessions: { total: 1, active: 1 },
      prsReferenced: { count: 1, activeRepos: 1, sparkline: [1] },
      locDelta: { net: 1, added: 1, removed: 0, sparkline: [[1, 0]] },
    },
  },
  recentActivity: [],
  sessions: [],
}

// Stripped 30d slice per the lazy-slice schema (6 keys, locDelta without net).
const THIRTY_DAY_SLICE = {
  snapshotDate: '2026-08-18',
  generatedAt: '2026-08-18T00:00:00Z',
  range: '30d',
  sessions: [
    {
      harness: 'omp',
      repo: 'dev-portfolio',
      sessionId: 'slice-1',
      day: '2026-08-15',
      assistantMessages: 9,
      locDelta: { added: 2622, removed: 1015 },
      prRefs: [17, 18],
    },
  ],
}

test('snapshot store fetches 7d eagerly once and 30d slice on demand once', async () => {
  const real = globalThis.fetch
  const calls: string[] = []
  const observed: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    calls.push(url)
    if (url === '/data/7d.json') return new Response(JSON.stringify(FIXTURE), { status: 200 })
    return new Response(JSON.stringify(THIRTY_DAY_SLICE), { status: 200 })
  }) as unknown as typeof fetch
  try {
    const unsubA = subscribeSnapshot(() => observed.push(getSnapshotState().status))
    const unsubB = subscribeSnapshot(() => {})
    assert.deepEqual(calls, ['/data/7d.json'], 'first subscribe triggers exactly one eager fetch')

    await ensureRangeSessions('30d') // the store's own exported promise — no wall-clock wait
    assert.deepEqual(
      calls,
      ['/data/7d.json', '/data/30d.json'],
      'ensureRangeSessions adds exactly one fetch',
    )
    assert.equal(getSnapshotState().rangeSessions['30d']?.length, 1)
    assert.equal(getSnapshotState().rangeSessions['30d']?.[0].sessionId, 'slice-1')
    unsubB()

    await ensureRangeSessions('30d')
    assert.deepEqual(
      calls,
      ['/data/7d.json', '/data/30d.json'],
      'repeated ensureRangeSessions does not refetch',
    )

    await startSnapshotLoad() // the promise the store already exposes — no wall-clock wait

    assert.equal(getSnapshotState().status, 'ready')
    assert.equal(getSnapshotState().snapshot?.snapshotDate, '2026-08-18')
    assert.equal(getSnapshotState().rangeSessions['30d']?.length, 1)
    assert.equal(getSnapshotState().rangeSessions['30d']?.[0].locDelta?.net, 0)
    assert.ok(observed.includes('ready'), 'subscriber was notified on resolution')
    assert.equal(calls.length, 2, 'no refetch after resolution')
    unsubA()
  } finally {
    globalThis.fetch = real
  }
})
