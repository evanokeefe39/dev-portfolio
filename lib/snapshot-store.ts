import { useSyncExternalStore } from 'react'
import { loadRangeSessions, loadSnapshot } from './data'
import type { RangeKey, SessionEntry, Snapshot } from './types'

/**
 * Shared snapshot store: exactly ONE eager fetch of /data/7d.json per page
 * load, no matter how many consumers subscribe. StatCard and the 3D scene
 * read the same normalized snapshot object via `useSnapshot`. Longer-range
 * session slices (30d/90d/1y/all) load lazily on demand through
 * `ensureRangeSessions` — one cached fetch per range, merged into
 * `rangeSessions` on resolve. Tiny pub/sub + `useSyncExternalStore` — no
 * context, no provider, no query library. Mirrors lib/range-store.ts.
 */

export type SnapshotStatus = 'loading' | 'ready'

export interface SnapshotState {
  status: SnapshotStatus
  snapshot: Snapshot | null
  rangeSessions: Partial<Record<RangeKey, SessionEntry[]>>
}

let state: SnapshotState = { status: 'loading', snapshot: null, rangeSessions: {} }
const listeners = new Set<() => void>()
let loadPromise: Promise<void> | null = null
const rangeLoads: Partial<Record<RangeKey, Promise<void>>> = {}

/**
 * Kick off the eager 7d snapshot fetch and cache the promise so every caller
 * shares the same in-flight load. loadSnapshot never rejects (it resolves
 * null on failure), so a single .then that merges state and notifies is
 * enough. The merge keeps any rangeSessions slices already resolved.
 */
export function startSnapshotLoad(): Promise<void> {
  if (!loadPromise) {
    loadPromise = loadSnapshot().then((snapshot) => {
      state = { ...state, status: 'ready', snapshot }
      for (const fn of listeners) fn()
    })
  }
  return loadPromise
}

/**
 * Ensure the lazy session slice for `range` is loaded. One cached fetch per
 * range: concurrent and repeated calls share the same promise. On resolve,
 * merge a NEW rangeSessions object — never mutate in place, or
 * useSyncExternalStore bails out on the Object.is-equal snapshot and
 * subscribers keep stale data — then notify. Never rejects:
 * loadRangeSessions resolves [] on failure.
 */
export function ensureRangeSessions(range: RangeKey): Promise<void> {
  const pending = rangeLoads[range]
  if (pending) return pending
  const load = loadRangeSessions(range).then((sessions) => {
    state = { ...state, rangeSessions: { ...state.rangeSessions, [range]: sessions } }
    for (const fn of listeners) fn()
  })
  rangeLoads[range] = load
  return load
}

export function subscribeSnapshot(fn: () => void): () => void {
  listeners.add(fn)
  // Eagerly load on first subscribe; later calls reuse the cached promise.
  if (listeners.size === 1) startSnapshotLoad()
  return () => {
    listeners.delete(fn)
  }
}

/** Stable reference, replaced atomically on load — never rebuilt per call. */
export function getSnapshotState(): SnapshotState {
  return state
}

export function useSnapshot(): SnapshotState {
  return useSyncExternalStore(subscribeSnapshot, getSnapshotState, getSnapshotState)
}
