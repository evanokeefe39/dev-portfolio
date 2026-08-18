/**
 * Pure walk derivation for a single krab — no three.js, no React, fully
 * unit-testable. Contracts (krabs-hitch-fix):
 *
 * - rawDt is clamped to MAX_DT = 0.05s, so a dropped frame (huge delta)
 *   can never teleport the krab: movement advances exactly as if the frame
 *   had lasted MAX_DT.
 * - state.time ALWAYS advances by the clamped dt — even while pausing — so
 *   the sin() leg/claw phases never freeze mid-swing and never jump on
 *   resume (phase continuity).
 * - `activity` eases toward 0 while paused and back to 1 on resume
 *   (exponential ease, rate 8/s). Legs/claws therefore ease smoothly to
 *   rest instead of freezing, and ramp back up without a phase pop: only
 *   the amplitude changes, never the phase.
 * - Movement mirrors the original frame loop: progress advances by
 *   dt / (segLen / speed); crossing 1 wraps pathIndex, resets progress and
 *   starts a `params.pause`-second rest at the waypoint. Pose x/z is the
 *   same waypoint lerp and rotationY the same angle as before.
 *
 * Ownership (poka-yoke):
 * - MUTATES: `state` — the only object written; the caller owns it across
 *   frames (a useRef).
 * - READ-ONLY: `path` and `pathLengths` are never written.
 * - Returns a FRESH pose object each call; the caller may mutate it freely.
 *
 * Preconditions: path.length >= 1 (segments wrap around to path[0]);
 *   pathLengths.length === path.length; state.progress in [0, 1);
 *   state.activity in [0, 1]; state.pausing >= 0.
 * Postconditions: state.time increased by exactly min(rawDt, MAX_DT);
 *   state.progress in [0, 1); state.pausing in [0, params.pause];
 *   state.activity in [0, 1]; pose.legSwings.length === 6.
 */

export const MAX_DT = 0.05

export interface KrabStepState {
  pathIndex: number
  progress: number
  pausing: number
  time: number
  activity: number
}

export interface KrabPose {
  x: number
  z: number
  rotationY: number
  legSwings: number[] /* length 6 */
  clawSnap: number
}

export interface KrabStepParams {
  speed: number
  pause: number
  legRate: number
  snapRate: number
}

/** Per-second exponential ease rate of `activity` toward its pause/walk target. */
const ACTIVITY_EASE = 8

export function stepKrab(
  state: KrabStepState,
  path: [number, number][],
  pathLengths: number[],
  params: KrabStepParams,
  rawDt: number,
): KrabPose {
  const dt = Math.min(rawDt, MAX_DT)

  // Phase continuity: the clock always advances (clamped), so the sin()
  // phases never stop mid-swing and never jump when the krab resumes.
  state.time += dt

  // Activity: ease to 0 while paused (legs/claws settle to rest), back to
  // 1 while walking (amplitude ramps up) — never a phase discontinuity.
  const target = state.pausing > 0 ? 0 : 1
  state.activity += (target - state.activity) * Math.min(1, dt * ACTIVITY_EASE)

  // Movement: rest while pausing, otherwise advance along the segment and
  // wrap to the next one (with a pause) on arrival.
  if (state.pausing > 0) {
    state.pausing -= dt
  } else {
    const segLen = pathLengths[state.pathIndex]
    state.progress += dt / (segLen / params.speed)
    if (state.progress >= 1) {
      state.progress = 0
      state.pathIndex = (state.pathIndex + 1) % path.length
      state.pausing = params.pause
    }
  }

  // Pose: identical waypoint lerp + angle to the original frame loop.
  const cur = path[state.pathIndex]
  const next = path[(state.pathIndex + 1) % path.length]
  const t = state.progress
  const x = cur[0] + (next[0] - cur[0]) * t
  const z = cur[1] + (next[1] - cur[1]) * t
  const rotationY = Math.atan2(next[0] - cur[0], next[1] - cur[1]) + Math.PI / 2

  const legSwings: number[] = []
  for (let i = 0; i < 6; i++) {
    legSwings.push(Math.sin(state.time * params.legRate + i * 2.1) * 0.35 * state.activity)
  }
  const clawSnap = Math.sin(state.time * params.snapRate) * 0.25 * state.activity

  return { x, z, rotationY, legSwings, clawSnap }
}
