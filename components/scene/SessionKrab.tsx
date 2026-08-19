'use client'

import React, { memo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useCursor } from '@react-three/drei'
import type * as THREE from 'three'
import { HARNESS_COLORS } from '@/lib/harness'
import type { Harness, SessionEntry } from '@/lib/types'
import { BranchIcon, RepoIcon } from './icons'
import { sessionRowParts } from './layout'
import { Voxel } from './Voxel'

/**
 * One deterministic voxel krab per session, mirroring ChairKrab's body (2 eye
 * stalks, shell stack, 3 leg pairs, claws) but parametrized by harness. The
 * shell/legs/claw colors come from the four harness palettes; the group is
 * scaled by the session's magnitude (sessionScale) around the seat base, so
 * bigger sessions = bigger krabs.
 *
 * The tooltip is a drei <Html> glass pill (same style as the retired
 * SessionLabels pills): a header row (RepoIcon + repo name + harness chip)
 * and a repo-stats section (two deterministic lines from repoTooltipBody,
 * LOC colored by sign), above the krab, gated behind hover — invisible
 * until the pointer is over the krab's hitbox. Memoized so neither the
 * static voxel body nor the tooltip re-renders when unrelated scene state
 * (e.g. the hourly clock) changes.
 *
 * Focus (selected repo): a pulsing highlight ring around the base and a
 * session panel above the krab (header + repo section + divider + up to 8
 * sessionRowParts rows + a "+N more" line); the hover tooltip is
 * suppressed while focused.
 * `highlighted` (card hover) shows the ring + tooltip without focus.
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
  /** sessionScale(assistantMessages), ~0.55..1.1. */
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

  // Pointer cursor while hovered — R3F v9 dropped the per-object `cursor` prop,
  // so drive it from the same hover state via drei's useCursor (unmount-safe).
  useCursor(hovered)
  // Pulsing ring material — opacity animates only while the ring is mounted.
  const ringMat = useRef<THREE.MeshBasicMaterial | null>(null)
  useFrame((state) => {
    if (ringMat.current === null) return
    ringMat.current.opacity = 0.4 + 0.25 * (1 + Math.sin(state.clock.elapsedTime * 3))
  })
  return (
    <group position={position} scale={[scale, scale, scale]}>
      {/* body */}
      <Voxel position={[0, 0.22, 0]} size={[0.4, 0.18, 0.3]} color={palette.body} />
      {/* eye stalks */}
      <Voxel position={[-0.12, 0.36, -0.12]} size={[0.04, 0.12, 0.04]} color={palette.body} />
      <Voxel position={[0.12, 0.36, -0.12]} size={[0.04, 0.12, 0.04]} color={palette.body} />
      {/* eyes */}
      <Voxel position={[-0.12, 0.44, -0.12]} size={[0.06, 0.06, 0.06]} color={EYE_COLOR} />
      <Voxel position={[0.12, 0.44, -0.12]} size={[0.06, 0.06, 0.06]} color={EYE_COLOR} />
      <Voxel position={[-0.13, 0.46, -0.14]} size={[0.02, 0.02, 0.02]} color={GLINT_COLOR} />
      <Voxel position={[0.11, 0.46, -0.14]} size={[0.02, 0.02, 0.02]} color={GLINT_COLOR} />
      {/* shell stack (dark base, light top) */}
      <Voxel position={[0, 0.38, 0.02]} size={[0.3, 0.14, 0.26]} color={palette.dark} />
      <Voxel position={[0, 0.48, 0.02]} size={[0.24, 0.12, 0.2]} color={palette.body} />
      <Voxel position={[0, 0.56, 0.02]} size={[0.16, 0.08, 0.14]} color={palette.body} />
      {/* shell spots — per-harness shell accent */}
      <Voxel position={[0.08, 0.44, -0.1]} size={[0.05, 0.05, 0.02]} color={palette.dark} />
      <Voxel position={[-0.06, 0.52, -0.06]} size={[0.04, 0.04, 0.02]} color={palette.dark} />
      {/* legs (3 pairs) */}
      {[-0.06, 0.02, 0.1].map((zo, i) => (
        <React.Fragment key={`cl${i}`}>
          <Voxel position={[-0.24, 0.15, zo]} size={[0.1, 0.04, 0.04]} color={palette.dark} />
          <Voxel position={[0.24, 0.15, zo]} size={[0.1, 0.04, 0.04]} color={palette.dark} />
        </React.Fragment>
      ))}
      {/* claws */}
      <Voxel position={[-0.24, 0.24, -0.14]} size={[0.1, 0.06, 0.06]} color={palette.body} />
      <Voxel position={[-0.32, 0.26, -0.14]} size={[0.06, 0.03, 0.07]} color={palette.dark} />
      <Voxel position={[-0.32, 0.22, -0.14]} size={[0.06, 0.03, 0.07]} color={palette.dark} />
      <Voxel position={[0.24, 0.24, -0.14]} size={[0.1, 0.06, 0.06]} color={palette.body} />
      <Voxel position={[0.32, 0.26, -0.14]} size={[0.06, 0.03, 0.07]} color={palette.dark} />
      <Voxel position={[0.32, 0.22, -0.14]} size={[0.06, 0.03, 0.07]} color={palette.dark} />
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
  )
})
