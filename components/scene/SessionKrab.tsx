'use client'

import React, { memo, useState } from 'react'
import { Html, useCursor } from '@react-three/drei'
import { HARNESS_COLORS } from '@/lib/harness'
import type { Harness } from '@/lib/types'
import { Voxel } from './Voxel'

/**
 * One deterministic voxel krab per session, mirroring ChairKrab's body (2 eye
 * stalks, shell stack, 3 leg pairs, claws) but parametrized by harness. The
 * shell/legs/claw colors come from the four harness palettes; the group is
 * scaled by the session's magnitude (sessionScale) around the seat base, so
 * bigger sessions = bigger krabs.
 *
 * The tooltip is a drei <Html> glass pill (same style as the retired
 * SessionLabels pills): a mono title line + 2-4 deterministic stat lines,
 * above the krab, gated behind hover — invisible until the pointer is over
 * the krab's hitbox. Memoized so neither the static voxel body nor the
 * tooltip re-renders when unrelated scene state (e.g. the hourly clock)
 * changes.
 */

const EYE_COLOR = '#111111'
const GLINT_COLOR = '#ffffff'

export interface SessionKrabProps {
  harness: Harness
  /** Seat anchor — SEAT_POSITIONS[seatIndex] (already at SEAT_Y). */
  position: [number, number, number]
  /** sessionScale(assistantMessages), ~0.55..1.1. */
  scale: number
  /** Mono title line in the tooltip pill (`${repo} · ${harness}`). */
  title: string
  /** Deterministic stats body (2-4 newline-separated lines). */
  body: string
}

export const SessionKrab = memo(function SessionKrab({
  harness,
  position,
  scale,
  title,
  body,
}: SessionKrabProps) {
  const [hovered, setHovered] = useState(false)
  const palette = HARNESS_COLORS[harness]

  // Pointer cursor while hovered — R3F v9 dropped the per-object `cursor` prop,
  // so drive it from the same hover state via drei's useCursor (unmount-safe).
  useCursor(hovered)
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
      {/* invisible hover hitbox — covers the krab body up through the tooltip pill region */}
      <mesh position={[0, 0.8, 0]} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
        <boxGeometry args={[1.1, 1.7, 0.9]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* tooltip pill above the krab */}
      <Html position={[0, 1.25, 0]} center pointerEvents="none" wrapperClass="pointer-events-none">
        <div className="pointer-events-none select-none rounded-lg border border-white/10 bg-black/35 px-3 py-2 shadow-lg backdrop-blur-md" style={{ opacity: hovered ? 1 : 0, transition: 'opacity 150ms' }}>
          <div className="font-mono text-[11px] font-semibold tracking-tight text-white/90">{title}</div>
          {body.split('\n').map((line, i) => (
            <div key={i} className="mt-0.5 max-w-[220px] truncate text-[11px] text-white/60">
              {line}
            </div>
          ))}
        </div>
      </Html>
    </group>
  )
})
