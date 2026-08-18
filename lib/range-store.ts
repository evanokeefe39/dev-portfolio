import { useSyncExternalStore } from 'react'
import type { RangeKey } from './types'

/**
 * Shared scene-window range (7d/30d/90d/1y/all) with zero dependencies.
 * StatCard writes via `setRange` (its toggle buttons), the scene reads via
 * `useRange`. Tiny pub/sub + `useSyncExternalStore` — no context, no provider.
 */

let range: RangeKey = '7d'
const listeners = new Set<() => void>()

export function getRange(): RangeKey {
  return range
}

/** No-op when the range is unchanged; otherwise notify every subscriber. */
export function setRange(next: RangeKey): void {
  if (next === range) return
  range = next
  for (const fn of listeners) fn()
}

export function subscribeRange(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function useRange(): RangeKey {
  return useSyncExternalStore(subscribeRange, getRange, getRange)
}
