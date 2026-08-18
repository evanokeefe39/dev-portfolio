import { useSyncExternalStore } from 'react'

/**
 * Shared selection state (selected + hovered repo) with zero dependencies.
 * The stat card writes via `selectRepo` / `setHoveredRepo` / `clearSelection`,
 * the scene reads via `useSelection`. Tiny pub/sub + `useSyncExternalStore` —
 * no context, no provider. Mirrors lib/range-store.ts.
 */

export interface SelectionState {
  selectedRepo: string | null
  hoveredRepo: string | null
}

let selection: SelectionState = { selectedRepo: null, hoveredRepo: null }
const listeners = new Set<() => void>()

export function getSelection(): SelectionState {
  return selection
}

/** No-op when the repo is unchanged; otherwise notify every subscriber. */
export function selectRepo(repo: string | null): void {
  if (repo === selection.selectedRepo) return
  selection = { ...selection, selectedRepo: repo }
  for (const fn of listeners) fn()
}

/** No-op when the repo is unchanged; otherwise notify every subscriber. */
export function setHoveredRepo(repo: string | null): void {
  if (repo === selection.hoveredRepo) return
  selection = { ...selection, hoveredRepo: repo }
  for (const fn of listeners) fn()
}

/** Reset both fields to null; no-op when already clear. */
export function clearSelection(): void {
  if (selection.selectedRepo === null && selection.hoveredRepo === null) return
  selection = { selectedRepo: null, hoveredRepo: null }
  for (const fn of listeners) fn()
}

export function subscribeSelection(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function useSelection(): SelectionState {
  return useSyncExternalStore(subscribeSelection, getSelection, getSelection)
}
