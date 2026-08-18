import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  clearSelection,
  getSelection,
  selectRepo,
  setHoveredRepo,
  subscribeSelection,
} from '../lib/selection-store'
import type { SelectionState } from '../lib/selection-store'

const CLEARED: SelectionState = { selectedRepo: null, hoveredRepo: null }

test('subscribe → mutate → notified once with the new state', () => {
  clearSelection()
  const seen: SelectionState[] = []
  const unsub = subscribeSelection(() => seen.push(getSelection()))

  selectRepo('dev-portfolio')
  assert.deepEqual(seen, [{ selectedRepo: 'dev-portfolio', hoveredRepo: null }], 'selectRepo notifies exactly once')
  assert.deepEqual(getSelection(), { selectedRepo: 'dev-portfolio', hoveredRepo: null })

  setHoveredRepo('dev-portfolio')
  assert.deepEqual(
    seen,
    [
      { selectedRepo: 'dev-portfolio', hoveredRepo: null },
      { selectedRepo: 'dev-portfolio', hoveredRepo: 'dev-portfolio' },
    ],
    'setHoveredRepo notifies exactly once, keeping selectedRepo',
  )
  unsub()
  clearSelection()
})

test('unsubscribe stops notifications', () => {
  clearSelection()
  const seen: string[] = []
  const unsub = subscribeSelection(() => seen.push(getSelection().selectedRepo ?? 'null'))

  selectRepo('a')
  assert.deepEqual(seen, ['a'])

  unsub()
  selectRepo('b')
  setHoveredRepo('b')
  assert.deepEqual(seen, ['a'], 'no notifications after unsubscribe')
  clearSelection()
})

test('no-op setters do not notify', () => {
  clearSelection()
  let notified = 0
  const unsub = subscribeSelection(() => notified++)

  selectRepo('a')
  assert.equal(notified, 1)
  selectRepo('a')
  assert.equal(notified, 1, 'selectRepo with the same repo does not notify')

  setHoveredRepo('a')
  assert.equal(notified, 2)
  setHoveredRepo('a')
  assert.equal(notified, 2, 'setHoveredRepo with the same repo does not notify')

  setHoveredRepo(null)
  assert.equal(notified, 3, 'clearing hover is a real change')
  unsub()
  clearSelection()
})

test('clearSelection resets both fields and notifies once', () => {
  selectRepo('a')
  setHoveredRepo('b')
  assert.deepEqual(getSelection(), { selectedRepo: 'a', hoveredRepo: 'b' })

  let notified = 0
  const unsub = subscribeSelection(() => notified++)
  clearSelection()
  assert.deepEqual(getSelection(), CLEARED, 'both fields reset to null')
  assert.equal(notified, 1, 'clearSelection notifies exactly once')
  unsub()

  let noopNotified = 0
  const unsub2 = subscribeSelection(() => noopNotified++)
  clearSelection()
  assert.equal(noopNotified, 0, 'clearSelection on already-clear state does not notify')
  unsub2()
})

test('subscribeSelection returns an unsubscribe that can be called twice safely', () => {
  clearSelection()
  let notified = 0
  const unsub = subscribeSelection(() => notified++)

  unsub()
  unsub() // idempotent — Set.delete on a missing member is a no-op
  selectRepo('a')
  assert.equal(notified, 0, 'no notifications after unsubscribing twice')
  clearSelection()
})
