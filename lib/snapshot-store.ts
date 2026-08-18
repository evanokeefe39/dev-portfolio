import { useSyncExternalStore } from 'react'
import { loadSnapshot } from './data'
import type { Snapshot } from './types'

/**
 * Shared snapshot store: exactly ONE fetch of /data/current.json per page
 * load, no matter how many consumers subscribe. StatCard and the 3D scene
 * read the same normalized snapshot object via `useSnapshot`.
 * Tiny pub/sub + `useSyncExternalStore` — no context, no provider,
 * no query library. Mirrors lib/range-store.ts.
 */

export type SnapshotStatus = 'loading' | 'ready'

export interface SnapshotState {
  status: SnapshotStatus
  snapshot: Snapshot | null
}

let state: SnapshotState = { status: 'loading', snapshot: null }
const listeners = new Set<() => void>()
let loadPromise: Promise<void> | null = null

/**
 * Kick off the snapshot fetch and cache the promise so every caller shares
 * the same in-flight load. loadSnapshot never rejects (it resolves null on
 * failure), so a single .then that swaps state and notifies is enough.
 */
export function startSnapshotLoad(): Promise<void> {
  if (!loadPromise) {
    loadPromise = loadSnapshot().then((snapshot) => {
      state = { status: 'ready', snapshot }
      for (const fn of listeners) fn()
    })
  }
  return loadPromise
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
