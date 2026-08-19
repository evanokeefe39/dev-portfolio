'use client'

import React, { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useCursor } from '@react-three/drei'
import type * as THREE from 'three'
import { HARNESS_COLORS } from '@/lib/harness'
import type { Harness, SessionEntry } from '@/lib/types'
import { BranchIcon, RepoIcon } from './icons'
import { sessionRowParts, SEAT_POSITIONS } from './layout'
import { DATA_KRAB_SHELLS, generateTraits, hashString } from './krabs/traits'
import { makeScheduler, routeTo, type KrabLeg, type NamedWaypoint } from './krabs/behavior'
import { MAX_DT, pathLengthsFor, stepKrab, type KrabStepState } from './krabs/walk'
import { Voxel } from './Voxel'

/**
 * One deterministic voxel krab per repo. Harness drives the palette; a seeded
 * per-repo trait system (branch C) drives the shell + build proportions. The
 * krab roams a seeded waypoint itinerary (idle animation at rest, and
 * task-based walking between its desk, the lounge couch, and the mezzanine —
 * feedback #8) on a pure waypoint graph with no physics (no clipping by
 * construction). On focus it recalls to its seat so Scene's fly-to lands on
 * it, then idles.
 *
 * The tooltip is a drei <Html> glass pill (RepoIcon + repo name + harness chip,
 * then a grouped repo-stats section with signed/colored LOC), above the krab,
 * gated behind hover. Focus shows a session panel instead.
 */

const EYE_COLOR = '#111111'
const GLINT_COLOR = '#ffffff'

/** `${repo} · ${harness}` → parts; lastIndexOf keeps repo names containing ' · '. */
function splitTitle(title: string): { repo: string; harness: string } {
  const sep = title.lastIndexOf(' · ')
  return sep === -1 ? { repo: title, harness: '' } : { repo: title.slice(0, sep), harness: title.slice(sep + 3) }
}

/** Line 2 of repoTooltipBody: `+added −removed LOC` (+ ` · N PR refs`). */
const LOC_LINE_RE = /^\+(\d+) −(\d+) LOC(?: · (\d+) PR refs)?$/

interface ParsedLoc {
  added: number
  removed: number
  prRefs: number
}

function parseLocLine(line: string | undefined): ParsedLoc | null {
  if (line === undefined) return null
  const m = LOC_LINE_RE.exec(line)
  if (m === null) return null
  return { added: Number(m[1]), removed: Number(m[2]), prRefs: m[3] !== undefined ? Number(m[3]) : 0 }
}

/** Header row: RepoIcon + repo name + small harness chip. */
function TooltipHeader({ repo, harness, harnessColor }: { repo: string; harness: string; harnessColor: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <RepoIcon className="h-3.5 w-3.5 shrink-0 text-white/70" />
      <span className="min-w-0 truncate font-mono text-[11px] font-semibold tracking-tight text-white/90">{repo}</span>
      {harness !== '' && (
        <span
          className="ml-auto shrink-0 rounded border border-white/15 px-1.5 py-px font-mono text-[9px] font-medium uppercase tracking-wider"
          style={{ color: harnessColor }}
        >
          {harness}
        </span>
      )}
    </div>
  )
}

/** Repo stats section: metrics line + signed/colored LOC line (+ PR refs). */
function RepoSection({ metrics, loc, locFallback }: { metrics: string; loc: ParsedLoc | null; locFallback?: string }) {
  return (
    <div className="mt-1.5 space-y-0.5 border-t border-white/10 pt-1.5">
      <div className="font-mono text-[11px] text-white/60">{metrics}</div>
      {loc !== null ? (
        <div className="font-mono text-[11px] text-white/60">
          <span className="text-emerald-400">+{loc.added}</span>
          <span className="text-rose-400"> −{loc.removed}</span> LOC
          {loc.prRefs > 0 && <span className="text-white/45"> · {loc.prRefs} PR refs</span>}
        </div>
      ) : (
        locFallback !== undefined && <div className="font-mono text-[11px] text-white/60">{locFallback}</div>
      )}
    </div>
  )
}

/** One focus-panel session row: day/msgs, colored LOC, PR refs, branch, title. */
function SessionRow({ entry }: { entry: SessionEntry }) {
  const parts = sessionRowParts(entry)
  return (
    <div className="mt-0.5 flex max-w-[280px] items-baseline gap-1.5 truncate font-mono text-[11px] text-white/60">
      <span className="shrink-0">
        {parts.day} · {parts.msgs} msgs
      </span>
      {parts.loc !== null && (
        <span className="shrink-0 tabular-nums">
          <span className="text-emerald-400">+{parts.loc.added}</span>
          <span className="text-rose-400"> −{parts.loc.removed}</span>
        </span>
      )}
      {parts.prRefs.map((ref) => (
        <span key={ref} className="shrink-0 text-white/45">
          #{ref}
        </span>
      ))}
      {parts.branch !== null && (
        <span className="flex min-w-0 items-center gap-1 text-white/45">
          <BranchIcon className="h-3 w-3 shrink-0" />
          <span className="truncate">{parts.branch}</span>
        </span>
      )}
      {parts.title !== null && <span className="truncate text-white/70">{parts.title}</span>}
    </div>
  )
}

export interface SessionKrabProps {
  harness: Harness
  /** Seat anchor — SEAT_POSITIONS[seatIndex] (already at SEAT_Y). */
  position: [number, number, number]
  /** sessionScale(assistantMessages, locAdded, locRemoved), ~0.55..1.1. */
  scale: number
  /** Mono title line in the tooltip pill / focus panel (`${repo} · ${harness}`). */
  title: string
  /** Deterministic stats body (2 newline-separated lines). */
  body: string
  /** Selection focus: pulsing ring + session panel; hover tooltip suppressed. */
  focused?: boolean
  /** External highlight (card hover): ring + forced tooltip, no camera move. */
  highlighted?: boolean
  /** Window sessions for the focus panel, newest-first (≤8 rows + "+N more"). */
  sessions?: SessionEntry[]
}

/** Walk params for a roaming data krab (speed in world units/s; legs to match). */
const WALK = { speed: 1.1, pause: 0, legRate: 12, snapRate: 3 }

/** Gentle upright bob while the krab is at rest (idle life). */
function bobOffset(time: number): number {
  return Math.sin(time * 2) * 0.02
}

export const SessionKrab = memo(function SessionKrab({
  harness,
  position,
  scale,
  title,
  body,
  focused = false,
  highlighted = false,
  sessions,
}: SessionKrabProps) {
  const [hovered, setHovered] = useState(false)
  const palette = HARNESS_COLORS[harness]
  const lines = body.split('\n')
  const { repo, harness: titleHarness } = splitTitle(title)
  const loc = parseLocLine(lines[1])

  // Deterministic per-repo character (feedback #9): the repo name seeds the
  // PRNG so the same repo always renders the same krab. Shell from the subdued
  // DATA_KRAB_SHELLS pool; the build's proportions shape the body/claws/legs.
  // Palette stays harness-driven. `seed % len` indexes directly (no perturb).
  const seed = useMemo(() => hashString(repo), [repo])
  const traits = useMemo(() => generateTraits(seed), [seed])
  const shell = DATA_KRAB_SHELLS[seed % DATA_KRAB_SHELLS.length].shell
  const build = traits.build

  // Roaming: only the 16 desk krabs roam (seatIndex 0..15). The couch
  // spotlight krab's position isn't in SEAT_POSITIONS → seatIndex -1 → it
  // idles at its spot and never roams (it only appears under focus).
  const seatIndex = useMemo(() => {
    return SEAT_POSITIONS.findIndex(([x, y, z]) => x === position[0] && y === position[1] && z === position[2])
  }, [position])
  const home: NamedWaypoint = useMemo(
    () => (seatIndex >= 0 ? { kind: 'desk', index: seatIndex } : { kind: 'lounge' }),
    [seatIndex],
  )
  const itinerary = useMemo(() => {
    if (seatIndex < 0) return [] as KrabLeg[]
    const legs = makeScheduler(seatIndex)
    // Chain every leg's path from the previous leg's target (the first leaves
    // from the desk). A leg whose target equals its origin is a no-op walk.
    const chained: KrabLeg[] = []
    let prev: NamedWaypoint = home
    for (const leg of legs) {
      const path = routeTo(prev, leg.target) ?? []
      // Drop a zero-step leg (already there) so the walk never spins in place.
      if (path.length > 1) {
        chained.push({ ...leg, path })
        prev = leg.target
      }
    }
    return chained
  }, [seatIndex, home])

  // Roaming FSM (mutable ref across frames; pure pose math lives in walk.ts).
  const moveRef = useRef<THREE.Group>(null!)
  const roam = useRef({
    legIndex: 0,
    recall: false,
    dwelling: false,
    dwellT: 0,
    /** The place the krab is currently walking toward (for recall-home routes). */
    target: null as NamedWaypoint | null,
    /** World point where the krab rests while dwelling (the leg's target). */
    restPt: null as { x: number; y: number; z: number } | null,
    walk: { pathIndex: 0, progress: 0, pausing: 0, time: 0, activity: 1 } as KrabStepState,
  })

  // Pointer cursor while hovered — R3F v9 dropped the per-object `cursor` prop,
  // so drive it from the same hover state via drei's useCursor (unmount-safe).
  useCursor(hovered)
  // Pulsing ring material — opacity animates only while the ring is mounted.
  const ringMat = useRef<THREE.MeshBasicMaterial | null>(null)

  // Idle + roaming, driven each frame. Recall-to-seat (manifest design): on
  // focus the krab walks home to its anchor first, then idles, so Scene's
  // fly-to (which lands on the seat) lands on the krab — Scene.tsx stays
  // untouched. When focus releases, roaming resumes from the seat.
  useFrame((state, delta) => {
    if (ringMat.current !== null) {
      ringMat.current.opacity = 0.4 + 0.25 * (1 + Math.sin(state.clock.elapsedTime * 3))
    }
    if (!moveRef.current) return
    const r = roam.current
    if (seatIndex < 0 || itinerary.length === 0) {
      // Couch/spotlight krab (or no graph): idle bob only, at the anchor.
      r.walk.time = (r.walk.time + Math.min(delta, MAX_DT)) % 1000
      moveRef.current.position.set(0, bobOffset(r.walk.time), 0)
      moveRef.current.rotation.y = 0
      return
    }

    const active: KrabLeg | null = r.recall
      ? { target: home, dwell: 0, path: routeTo(r.target ?? home, home) ?? [] }
      : itinerary[r.legIndex % itinerary.length]
    const wp = active?.path ?? []
    const ax = position[0]
    const ay = position[1]
    const az = position[2]

    // Dwell phase: resting at the previous leg's target for its dwell time.
    // Hold the rest point (idle bob) until the dwell elapses, then advance to
    // the next leg. Recall never dwells — it heads straight home.
    if (r.dwelling && !r.recall) {
      r.dwellT -= delta
      r.walk.time = (r.walk.time + Math.min(delta, MAX_DT)) % 1000
      const pt = r.restPt
      if (pt !== null) {
        moveRef.current.position.set(bobOffset(r.walk.time) + (pt.x - ax), pt.y - ay, pt.z - az)
      }
      if (r.dwellT <= 0) {
        r.dwelling = false
        r.legIndex = (r.legIndex + 1) % itinerary.length
      }
      return
    }

    if (wp.length <= 1) {
      // No route or the target is the current position: arrive immediately.
      if (r.recall) r.recall = false
      moveRef.current.position.set(0, bobOffset(r.walk.time), 0)
      r.walk.time = (r.walk.time + Math.min(delta, MAX_DT)) % 1000
      return
    }
    r.target = active.target

    // behavior.ts uses `{x,y,z}` objects; walk.ts walks `[x, z, y?]` tuples.
    // Convert once at the boundary so the two keep their own idioms.
    const walkPath: [number, number, number][] = wp.map((w) => [w.x, w.z, w.y])
    const wasFinalSegment = r.walk.pathIndex === walkPath.length - 2
    const lengths = pathLengthsFor(walkPath)
    const pose = stepKrab(r.walk, walkPath, lengths, { ...WALK, pause: 0 }, delta)
    // Pose is absolute world; moveRef is the outer layer above the
    // seat-anchored inner group, so the offset from the anchor keeps the
    // krab's feet at the waypoint elevation (its own seat top or the floor).
    moveRef.current.position.set(bobOffset(r.walk.time) + (pose.x - ax), pose.y - ay, pose.z - az)
    moveRef.current.rotation.y = pose.rotationY

    // Arrival: we completed the final segment into the leg's target waypoint
    // (the walk wrapped to path[0] and its progress reset). Rest there for the
    // leg's dwell, except when recalling home.
    if (wasFinalSegment && r.walk.progress === 0) {
      if (!r.recall) {
        r.dwelling = true
        r.dwellT = active.dwell
        r.restPt = wp[wp.length - 1]
      } else {
        // Reached home: idle at the seat.
        r.recall = false
        r.walk = { pathIndex: 0, progress: 0, pausing: 0, time: r.walk.time, activity: 1 }
      }
    }
  })

  // Begin recall-to-seat on focus: route home from wherever the krab is (its
  // current target) and reset the walk to start walking it.
  useEffect(() => {
    if (focused && seatIndex >= 0) {
      roam.current.recall = true
      roam.current.walk = { pathIndex: 0, progress: 0, pausing: 0, time: roam.current.walk.time, activity: 1 }
    }
  }, [focused, seatIndex])

  return (
    <group ref={moveRef}>
      <group position={position} scale={[scale, scale, scale]}>
        {/* body — width/depth scaled by the seeded build trait */}
        <Voxel position={[0, 0.22, 0]} size={[0.4 * build.bodyWidth, 0.18, 0.3 * build.bodyDepth]} color={palette.body} />
        <Voxel position={[0, 0.28, 0]} size={[0.36 * build.bodyWidth, 0.12, 0.26 * build.bodyDepth]} color={palette.body} />
        {/* eye stalks */}
        <Voxel position={[-0.12 * build.bodyWidth, 0.33 + 0.06 * build.eyeStalk, -0.12 * build.bodyDepth]} size={[0.04, 0.1 * build.eyeStalk, 0.04]} color={palette.body} />
        <Voxel position={[0.12 * build.bodyWidth, 0.33 + 0.06 * build.eyeStalk, -0.12 * build.bodyDepth]} size={[0.04, 0.1 * build.eyeStalk, 0.04]} color={palette.body} />
        {/* eyes */}
        <Voxel position={[-0.12 * build.bodyWidth, 0.36 + 0.1 * build.eyeStalk, -0.12 * build.bodyDepth]} size={[0.06, 0.06, 0.06]} color={EYE_COLOR} />
        <Voxel position={[0.12 * build.bodyWidth, 0.36 + 0.1 * build.eyeStalk, -0.12 * build.bodyDepth]} size={[0.06, 0.06, 0.06]} color={EYE_COLOR} />
        <Voxel position={[-0.13 * build.bodyWidth, 0.38 + 0.1 * build.eyeStalk, -0.14 * build.bodyDepth]} size={[0.02, 0.02, 0.02]} color={GLINT_COLOR} />
        <Voxel position={[0.11 * build.bodyWidth, 0.38 + 0.1 * build.eyeStalk, -0.14 * build.bodyDepth]} size={[0.02, 0.02, 0.02]} color={GLINT_COLOR} />
        {/* shell — deterministic per-repo from the subdued pool (replaces the fixed stack) */}
        {shell}
        {/* legs (3 pairs) — length scaled by the seeded build trait */}
        {[-0.06 * build.bodyDepth, 0, 0.06 * build.bodyDepth].map((zo, i) => (
          <React.Fragment key={`cl${i}`}>
            <Voxel position={[-0.24 * build.bodyWidth, 0.18, zo]} size={[0.1 * build.legLen, 0.04, 0.04]} color={palette.dark} />
            <Voxel position={[0.24 * build.bodyWidth, 0.18, zo]} size={[0.1 * build.legLen, 0.04, 0.04]} color={palette.dark} />
          </React.Fragment>
        ))}
        {/* claws — scale driven by the seeded clawScale trait (feedback #9) */}
        <Voxel position={[-0.24 * build.bodyWidth, 0.24, -0.14 * build.bodyDepth]} size={[0.1 * build.clawScale, 0.06 * build.clawScale, 0.06 * build.clawScale]} color={palette.body} />
        <Voxel position={[-0.32 * build.bodyWidth, 0.26 * build.clawScale, -0.14 * build.bodyDepth]} size={[0.06 * build.clawScale, 0.03 * build.clawScale, 0.07 * build.clawScale]} color={palette.dark} />
        <Voxel position={[-0.32 * build.bodyWidth, 0.22 * build.clawScale, -0.14 * build.bodyDepth]} size={[0.06 * build.clawScale, 0.03 * build.clawScale, 0.07 * build.clawScale]} color={palette.dark} />
        <Voxel position={[0.24 * build.bodyWidth, 0.24, -0.14 * build.bodyDepth]} size={[0.1 * build.clawScale, 0.06 * build.clawScale, 0.06 * build.clawScale]} color={palette.body} />
        <Voxel position={[0.32 * build.bodyWidth, 0.26 * build.clawScale, -0.14 * build.bodyDepth]} size={[0.06 * build.clawScale, 0.03 * build.clawScale, 0.07 * build.clawScale]} color={palette.dark} />
        <Voxel position={[0.32 * build.bodyWidth, 0.22 * build.clawScale, -0.14 * build.bodyDepth]} size={[0.06 * build.clawScale, 0.03 * build.clawScale, 0.07 * build.clawScale]} color={palette.dark} />
        {/* selection highlight ring — horizontal, pulsing, around the krab base */}
        {(focused || highlighted) && (
          <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.45, 0.6, 48]} />
            <meshBasicMaterial ref={ringMat} color={palette.body} transparent opacity={0.65} />
          </mesh>
        )}
        {/* invisible hover hitbox — body footprint (0.5 x 1.7 x 0.45).
            Width/depth shrunk so adjacent hitboxes never overlap at max scale:
            half-width 0.25 x 1.1 = 0.275 and half-depth 0.225 x 1.1 ≈ 0.25 are
            both well under the 0.5 half-seat pitch. Height (1.7) is kept so the
            pointer stays inside while moving up into the tooltip pill. */}
        <mesh position={[0, 0.8, 0]} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
          <boxGeometry args={[0.5, 1.7, 0.45]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {/* tooltip pill above the krab */}
        <Html position={[0, 1.25, 0]} center pointerEvents="none" wrapperClass="pointer-events-none">
          <div
            className="pointer-events-none select-none rounded-lg border border-white/10 bg-black/35 px-3 py-2 shadow-lg backdrop-blur-md"
            style={{ opacity: (hovered || highlighted) && !focused ? 1 : 0, transition: 'opacity 150ms' }}
          >
            <TooltipHeader repo={repo} harness={titleHarness} harnessColor={palette.body} />
            <RepoSection metrics={lines[0] ?? ''} loc={loc} locFallback={lines[1]} />
          </div>
        </Html>
        {/* focus session panel above the krab — replaces the tooltip while focused */}
        {focused && (
          <Html position={[0, 1.9, 0]} center pointerEvents="none" wrapperClass="pointer-events-none">
            <div className="pointer-events-none select-none rounded-lg border border-white/10 bg-black/35 px-3 py-2 shadow-lg backdrop-blur-md">
              <TooltipHeader repo={repo} harness={titleHarness} harnessColor={palette.body} />
              <RepoSection metrics={lines[0] ?? ''} loc={loc} locFallback={lines[1]} />
              <div className="my-1.5 border-t border-white/15" />
              {sessions?.slice(0, 8).map((s, i) => (
                <SessionRow key={i} entry={s} />
              ))}
              {sessions !== undefined && sessions.length > 8 && (
                <div className="mt-0.5 font-mono text-[11px] text-white/60">+{sessions.length - 8} more</div>
              )}
            </div>
          </Html>
        )}
      </group>
    </group>
  )
})

