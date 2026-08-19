import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_DT, pathLengthsFor, stepKrab } from '../components/scene/krabs/walk'
import type { KrabStepState } from '../components/scene/krabs/walk'

// ---- helpers -------------------------------------------------------------

const PATH: [number, number][] = [[0, 0], [10, 0]]
const PATH_LENGTHS = [10, 10]
const PARAMS = { speed: 2, pause: 0.5, legRate: 4, snapRate: 3 }

function state(over: Partial<KrabStepState> = {}): KrabStepState {
  return {
    pathIndex: 0,
    progress: 0,
    pausing: 0,
    time: 0,
    activity: 1,
    ...over,
  }
}

// ---- no teleport: rawDt clamp --------------------------------------------

test('a dropped frame (rawDt = 1.0) advances no more than a 0.05s frame would', () => {
  const slow = state()
  const fast = state()
  const slowPose = stepKrab(slow, PATH, PATH_LENGTHS, PARAMS, MAX_DT)
  const fastPose = stepKrab(fast, PATH, PATH_LENGTHS, PARAMS, 1.0)

  // Identical clamped dt -> identical state and pose: no teleport.
  assert.deepEqual(fast, slow)
  assert.deepEqual(fastPose, slowPose)
  // Sanity: the clamp kept the walk at one 0.05s step, not a full second.
  assert.equal(fast.progress, MAX_DT / (PATH_LENGTHS[0] / PARAMS.speed))
  assert.ok(fastPose.x <= 1, 'krab moved farther than a 0.05s step would allow')
})

// ---- pause ease ----------------------------------------------------------

test('while paused, activity and leg/claw motion ease to rest', () => {
  const s = state({ progress: 0.5, pausing: 5 })
  let pose = stepKrab(s, PATH, PATH_LENGTHS, PARAMS, 0.016)
  for (let i = 0; i < 200; i++) {
    pose = stepKrab(s, PATH, PATH_LENGTHS, PARAMS, 0.016)
  }
  assert.ok(s.activity < 0.01, `activity did not ease to rest: ${s.activity}`)
  assert.ok(pose.legSwings.every((sw) => Math.abs(sw) < 0.01), 'legs did not ease to rest')
  assert.ok(Math.abs(pose.clawSnap) < 0.01, 'claws did not ease to rest')
  // pause-per-waypoint: the krab stays put while resting...
  assert.equal(s.progress, 0.5)
  assert.equal(pose.x, 5)
  assert.equal(pose.z, 0)
  // ...but the clock keeps advancing, so the phase is never frozen.
  assert.ok(s.time > 3)
})

// ---- phase continuity on resume ------------------------------------------

test('leg and claw phase is continuous across the pause -> walk transition', () => {
  // The krab is already easing to rest (activity 0.5) when the pause hits,
  // rests, then resumes walking. No single frame may jump a leg more than a
  // small bound: a freeze-then-resume pop (old behavior) snaps from 0 to
  // full amplitude (~0.35) in one frame and fails this bound.
  const s = state({ progress: 0.5, pausing: 0.5, time: 1.234, activity: 0.5 })
  let prevSwings: number[] | null = null
  let prevSnap: number | null = null
  let maxSwingJump = 0
  let maxSnapJump = 0
  for (let i = 0; i < 60; i++) { // ~30 paused + ~30 resumed frames at 60fps
    const pose = stepKrab(s, PATH, PATH_LENGTHS, PARAMS, 1 / 60)
    if (prevSwings !== null && prevSnap !== null) {
      for (let j = 0; j < 6; j++) {
        maxSwingJump = Math.max(maxSwingJump, Math.abs(pose.legSwings[j] - prevSwings[j]))
      }
      maxSnapJump = Math.max(maxSnapJump, Math.abs(pose.clawSnap - prevSnap))
    }
    prevSwings = pose.legSwings
    prevSnap = pose.clawSnap
  }
  assert.ok(maxSwingJump <= 0.05, `leg swing jumped ${maxSwingJump} in one frame`)
  assert.ok(maxSnapJump <= 0.05, `claw snap jumped ${maxSnapJump} in one frame`)
})

// ---- determinism ----------------------------------------------------------

test('identical inputs produce an identical pose', () => {
  const a = state({ progress: 0.37, pausing: 0.2, time: 0.84, activity: 0.6 })
  const b = state({ progress: 0.37, pausing: 0.2, time: 0.84, activity: 0.6 })
  const poseA = stepKrab(a, PATH, PATH_LENGTHS, PARAMS, 0.016)
  const poseB = stepKrab(b, PATH, PATH_LENGTHS, PARAMS, 0.016)
  assert.deepEqual(poseA, poseB)
})

// ---- waypoint wrap --------------------------------------------------------

test('reaching the segment end wraps pathIndex, resets progress, and starts the pause', () => {
  const s = state({ progress: 0.99 })
  const fast = { ...PARAMS, speed: 4 }
  const pose = stepKrab(s, PATH, PATH_LENGTHS, fast, 0.05)
  // 0.99 + 0.05 / (10 / 4) = 1.01 -> wraps to the next segment and rests.
  assert.equal(s.pathIndex, 1)
  assert.equal(s.progress, 0)
  assert.equal(s.pausing, fast.pause)
  assert.equal(pose.x, 10) // pose snapped to the wrapped waypoint
  assert.equal(pose.z, 0)
  // The following frame is a rest frame: the krab stays at the waypoint.
  const rest = stepKrab(s, PATH, PATH_LENGTHS, fast, 1 / 60)
  assert.equal(rest.x, 10)
  assert.equal(rest.z, 0)
  assert.equal(s.progress, 0)
  assert.ok(s.pausing < fast.pause)
})

// ---- vertical (stair) segments -------------------------------------------

test('elevation interpolates as the krab walks a 3D stair segment', () => {
  // A single rising segment from floor (y=0) to the mezzanine (y=2.5), at
  // [x, z, y] ordering: displacement (Δx=2, Δz=0, Δy=2.5) → length √10.25.
  const stair: [number, number, number][] = [[0, 0, 0], [2, 0, 2.5]]
  const len = pathLengthsFor(stair)
  assert.equal(len[0], Math.hypot(2, 0, 2.5))
  const s = state()
  stepKrab(s, stair, len, { ...PARAMS, pause: 0 }, 0.016)
  // Advancing along the segment raises y monotonically toward 2.5.
  let prevY = 0
  let prevX = 0
  for (let i = 0; i < 100; i++) {
    const p = stepKrab(s, stair, len, { ...PARAMS, pause: 0 }, 0.016)
    assert.ok(p.y >= prevY - 1e-9, 'elevation must be monotonic non-decreasing up the stairs')
    assert.ok(p.x >= prevX - 1e-9, 'krab advances along x while climbing')
    prevY = p.y
    prevX = p.x
  }
  assert.ok(prevY > 0, 'krab actually climbed')
  assert.ok(prevY <= 2.5 + 1e-9, 'y capped at the top of the stairs')
})

test('2D paths keep y at 0 (backwards-compatible)', () => {
  const s = state({ progress: 0.5 })
  const pose = stepKrab(s, PATH, PATH_LENGTHS, PARAMS, 0.016)
  assert.equal(pose.y, 0)
})

test('pathLengthsFor includes vertical rise in 3D segments', () => {
  assert.deepEqual(pathLengthsFor([[0, 0, 0], [3, 4, 12]]), [13, 13]) // 3-4-12 pythagorean triple
  assert.deepEqual(pathLengthsFor([[0, 0], [3, 4]]), [5, 5]) // 2D: no elevation added
})
