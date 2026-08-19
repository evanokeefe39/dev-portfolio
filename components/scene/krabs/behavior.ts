/**
 * Seeded roaming scheduler + waypoint graph for the data krabs. Pure, no
 * three.js, no React — fully unit-testable. Contracts:
 *
 * - A waypoint is a 3D point [x, y, z] (y = krab feet elevation; the floor is
 *   y=0, a desk seat is y=SEAT_Y ≈ 0.44, a couch seat ~0.54, the mezzanine
 *   deck ~2.5).
 * - `WAYPOINTS` are authored ONLY where furniture leaves a clear lane (verified
 *   against environments/warehouse/Room.tsx + Furniture.tsx). Clipping is
 *   impossible by construction: krabs travel node→node along these lanes and
 *   never step off them.
 * - `routeTo(origin, dest)` runs BFS over the weighted edge graph and returns
 *   the ordered waypoint list (origin first, dest last), or null if
 *   unreachable. Deterministic for a given graph.
 * - `makeScheduler(seatIndex)` returns a deterministic cyclic itinerary:
 *   the desk seat → a lounge spot → the mezzanine deck → back to the desk, but
 *   seeded so a given krab always roams the same places in the same order
 *   (feedback #8). Each leg carries a dwell time (seconds) the krab rests.
 *
 * The desk seats, lounge couch 2 seats, and the mezzanine office are the
 * destination classes. Stationary/queue logic lives in the caller (SessionKrab
 * + KrazyKrab); this module produces the routes and the schedule.
 */

import { SEAT_POSITIONS } from '../layout'

/** Krab feet elevation at a wait/spot. */
export interface Waypoint {
  x: number
  y: number
  z: number
}

export type NamedWaypoint =
  | { kind: 'desk'; index: number }
  | { kind: 'aisle' }
  | { kind: 'lounge' }
  | { kind: 'mezzanine' }

/**
 * A single scheduled leg in a krab's itinerary: walk to `target`, then rest
 * for `dwell` seconds. `target` is a NamedWaypoint (resolved via the graph).
 */
export interface KrabLeg {
  target: NamedWaypoint
  dwell: number
  /** Waypoints walked to reach `target` from the previous leg (origin first). */
  path: Waypoint[]
}

/* ── Waypoint graph ──
 *
 * Rooms (from the furniture source):
 *   hot desks      x≈1.0,  z ≈ -1.5 (desk A) / 2.5 (desk B); seats at SEAT_POSITIONS
 *   lounge         top-left  x∈[-6,-2.5], z∈[2.5,6]
 *   mezzanine deck x∈[-6,-0.5], z∈[-5.93,-2.3], y≈2.5, via stairs at z=-5.2
 *   stairs         floor x≈3.33 … platform x≈-0.5, z=-5.2
 *
 * Lanes (furniture-free corridor), all y=0 except the deck:
 *   desk approach   seatX, then toward the central aisle
 *   aisle spine     (1.0, 0.0) … (1.0, 2.0)
 *   to lounge       (1.0, 2.0) → (-1.5, 2.6) → (-4.0, 4.4)
 *   to stairs       aisle → (1.0, -1.0) → (1.2, -3.4) → (1.9, -5.2) → stair bottom
 *   stairs          staged ascent along z=-5.2, x from 3.33 down to -0.5, y up to 2.5
 *   mezzanine spot    (-3.2, 2.5, -2.8)  deck, forward of the office
 */

interface WaypointNode {
  id: string
  pt: Waypoint
}
type NodeId = string

/** Single source of truth for the graph; build order determines BFS determinism. */
const NODES: Record<NodeId, WaypointNode> = {}
const EDGES: [NodeId, NodeId][] = []

function define(id: string, pt: Waypoint) {
  NODES[id] = { id, pt: { x: pt.x, y: pt.y, z: pt.z } }
}
function edge(a: NodeId, b: NodeId) {
  EDGES.push([a, b])
}

/* Desk-approach nodes (per seat; approach is in the aisle, off the chair).
 * The side mirrors buildKrabLayout (seats 0-3 / 4-7 per desk side). */
for (let i = 0; i < SEAT_POSITIONS.length; i++) {
  const [x, y, z] = SEAT_POSITIONS[i]
  const side = i % 8 < 4 ? -1 : 1
  define(`desk-${i}`, { x, y, z })
  define(`approach-${i}`, { x, y, z: z + side * 1.2 })
}

/* Aisle spine + lounge + stairs lanes. */
define('aisle-a', { x: 1.0, y: 0, z: 0.5 })
define('aisle-b', { x: 1.0, y: 0, z: 2.0 })
define('cross-lounge', { x: -1.5, y: 0, z: 2.6 })
define('lounge', { x: -4.0, y: 0, z: 4.4 }) // rug, clear of couch 2
define('stairs-left', { x: 1.0, y: 0, z: -1.0 })
define('stairs-mid1', { x: 1.2, y: 0, z: -3.4 })
define('stairs-mid2', { x: 1.9, y: 0, z: -5.2 })
define('stair-bottom', { x: 3.33, y: 0, z: -5.2 })
define('stair-1', { x: 2.9, y: 0.42, z: -5.2 })
define('stair-2', { x: 2.2, y: 0.83, z: -5.2 })
define('stair-3', { x: 1.5, y: 1.25, z: -5.2 })
define('stair-4', { x: 0.8, y: 1.67, z: -5.2 })
define('stair-5', { x: 0.1, y: 2.08, z: -5.2 })
define('stair-top', { x: -0.5, y: 2.5, z: -5.2 })
define('mezzanine', { x: -3.2, y: 2.5, z: -2.8 })

/* Edges — each pair shares a clear lane. */
for (let i = 0; i < SEAT_POSITIONS.length; i++) {
  edge(`desk-${i}`, `approach-${i}`)
  const [, , z] = SEAT_POSITIONS[i]
  edge(`approach-${i}`, z < 0 ? 'aisle-a' : 'aisle-b')
}
edge('aisle-a', 'aisle-b')
edge('aisle-b', 'cross-lounge')
edge('cross-lounge', 'lounge')
edge('aisle-b', 'stairs-left')
edge('stairs-left', 'stairs-mid1')
edge('stairs-mid1', 'stairs-mid2')
edge('stairs-mid2', 'stair-bottom')
edge('stair-bottom', 'stair-1')
edge('stair-1', 'stair-2')
edge('stair-2', 'stair-3')
edge('stair-3', 'stair-4')
edge('stair-4', 'stair-5')
edge('stair-5', 'stair-top')
edge('stair-top', 'mezzanine')

/* ── Resolution ── */

function resolve(target: NamedWaypoint): NodeId {
  switch (target.kind) {
    case 'desk':
      return `desk-${target.index}`
    case 'aisle':
      return 'aisle-b'
    case 'lounge':
      return 'lounge'
    case 'mezzanine':
      return 'mezzanine'
  }
}

/* ── BFS shortest route ── */

/**
 * Breadth-first route between two named spots. Returns the ordered waypoint
 * list (origin first, destination last), or null if not connected.
 * Deterministic: BFS visits nodes in fixed insertion order.
 */
export function routeTo(origin: NamedWaypoint, dest: NamedWaypoint): Waypoint[] | null {
  const start = resolve(origin)
  const goal = resolve(dest)
  if (start === goal) return [NODES[start].pt]

  const adj = new Map<NodeId, NodeId[]>()
  for (const [a, b] of EDGES) {
    if (!adj.has(a)) adj.set(a, [])
    if (!adj.has(b)) adj.set(b, [])
    adj.get(a)!.push(b)
    adj.get(b)!.push(a)
  }

  const prev = new Map<NodeId, NodeId | null>([[start, null]])
  const queue: NodeId[] = [start]
  let head = 0
  while (head < queue.length) {
    const cur = queue[head++]
    if (cur === goal) break
    for (const nb of adj.get(cur) ?? []) {
      if (!prev.has(nb)) {
        prev.set(nb, cur)
        queue.push(nb)
      }
    }
  }
  if (!prev.has(goal)) return null

  const rev: NodeId[] = []
  let cur: NodeId | null = goal
  while (cur !== null) {
    rev.push(cur)
    cur = prev.get(cur) ?? null
  }
  rev.reverse()
  return rev.map((id) => NODES[id].pt)
}

/* ── Seeded schedule ── */

/**
 * Deterministic per-seat roaming itinerary. Home is the desk seat at
 * `seatIndex`. Returns home → lounge → home → mezzanine → home, with a dwell
 * that varies by seat index so different krabs rest for different amounts but
 * always cycle deterministically. The caller loops this and walks each leg's
 * path; the krab always returns to its desk eventually.
 */
export function makeScheduler(seatIndex: number): KrabLeg[] {
  const home: NamedWaypoint = { kind: 'desk', index: Math.max(0, seatIndex) }
  const dwell = 6 - (seatIndex % 5) // 2..6 s rest per stop, varies per seat
  return [
    { target: { kind: 'lounge' }, dwell, path: [] },
    { target: home, dwell, path: [] },
    { target: { kind: 'mezzanine' }, dwell, path: [] },
    { target: home, dwell, path: [] },
  ]
}

/**
 * Materialize a leg's waypoint path from its previous destination. Schedule
 * legs start with `path: []`; call this once the prior leg's resolved target
 * is known so the graph can route forward. Falls back to the seat node if the
 * graph cannot reach a target (never stalls the krab mid-room).
 */
export function withPath(previous: NamedWaypoint, leg: KrabLeg, seatIndex: number): KrabLeg {
  if (leg.path.length > 0) return leg
  const path = routeTo(previous, leg.target)
  return { ...leg, path: path ?? [NODES[`desk-${seatIndex}`].pt] }
}
