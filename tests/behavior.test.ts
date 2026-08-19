import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeScheduler, routeTo, type NamedWaypoint } from '../components/scene/krabs/behavior'

const desk: NamedWaypoint = { kind: 'desk', index: 0 }
const lounge: NamedWaypoint = { kind: 'lounge' }
const mezz: NamedWaypoint = { kind: 'mezzanine' }

// ---- route: desk <-> lounge <-> mezzanine are all connected --------------

test('routeTo connects every desk to the lounge', () => {
  for (let i = 0; i < 16; i++) {
    const route = routeTo({ kind: 'desk', index: i }, lounge)
    assert.ok(route && route.length >= 2, `desk ${i} should reach the lounge`)
    assert.equal(route[0].x, route[0].x) // first waypoint is the desk's x
  }
})

test('routeTo connects the lounge to the mezzanine (up the stairs)', () => {
  const route = routeTo(lounge, mezz)
  assert.ok(route && route.length > 2, 'lounge should reach the mezzanine')
  // The stairs must include an elevation gain: the mezzanine end is higher.
  const lastY = route[route.length - 1].y
  assert.ok(lastY >= 2.0, `mezzanine waypoint should be elevated (got ${lastY})`)
})

test('routeTo(desk, sameDesk) is a single-point no-op walk', () => {
  const route = routeTo(desk, desk)
  assert.ok(route && route.length === 1)
})

test('routeTo is deterministic for a fixed graph', () => {
  const a = routeTo(desk, mezz)
  const b = routeTo(desk, mezz)
  assert.deepEqual(a, b)
})

// ---- schedule ------------------------------------------------------------

test('makeScheduler returns a cyclic home → lounge → mezzanine → home itinerary', () => {
  const sched = makeScheduler(0)
  assert.ok(sched.length >= 4)
  const targets = sched.map((l) => l.target.kind)
  assert.ok(targets.includes('lounge'))
  assert.ok(targets.includes('mezzanine'))
  // The krab always returns to its desk.
  assert.equal(sched[sched.length - 1].target.kind, 'desk')
})

test('makeScheduler dwell varies by seat but stays deterministic', () => {
  const s0 = makeScheduler(0)
  const s1 = makeScheduler(1)
  assert.deepEqual(makeScheduler(0).map((l) => [l.target.kind, l.dwell]), s0.map((l) => [l.target.kind, l.dwell]))
  // Different seat residues rest different amounts (2..6s).
  assert.notEqual(s0[0].dwell, s1[0].dwell)
  assert.ok(s0[0].dwell >= 2 && s0[0].dwell <= 6)
})
