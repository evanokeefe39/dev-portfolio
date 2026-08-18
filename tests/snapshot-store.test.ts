import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getSnapshotState, startSnapshotLoad, subscribeSnapshot } from '../lib/snapshot-store'

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

test('snapshot store fetches once and notifies subscribers on resolve', async () => {
  const real = globalThis.fetch
  let calls = 0
  const observed: string[] = []
  globalThis.fetch = (async () => {
    calls += 1
    return new Response(JSON.stringify(FIXTURE), { status: 200 })
  }) as unknown as typeof fetch
  try {
    const unsubA = subscribeSnapshot(() => observed.push(getSnapshotState().status))
    const unsubB = subscribeSnapshot(() => {})
    assert.equal(calls, 1, 'two subscribers must share one fetch')
    assert.equal(getSnapshotState().status, 'loading')
    unsubB()

    await startSnapshotLoad() // the promise the store already exposes — no wall-clock wait

    assert.equal(getSnapshotState().status, 'ready')
    assert.equal(getSnapshotState().snapshot?.snapshotDate, '2026-08-18')
    assert.deepEqual(observed, ['ready'], 'subscriber was notified on resolution')
    assert.equal(calls, 1, 'no refetch after resolution')
    unsubA()
  } finally {
    globalThis.fetch = real
  }
})
