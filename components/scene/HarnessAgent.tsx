'use client'

import React, { memo } from 'react'
import { Html } from '@react-three/drei'
import type { Harness } from '@/lib/types'
import { Voxel } from './Voxel'

/**
 * One voxel humanoid per agent-harness session, built from the shared Voxel
 * primitive (cached geometry/material) — no new packages. Four archetypes:
 *
 *   omp    coral #e8865a     + antenna
 *   claude terracotta #cc785c + headband
 *   pi     teal #3fb3a0      + visor
 *   codex  indigo #6a7bd8    + cap
 *
 * The tooltip is a drei <Html> glass pill (same style as the retired
 * SessionLabels pills): a mono title line + body text, above the head.
 * Memoized so neither the static voxel body nor the tooltip re-renders when
 * unrelated scene state (e.g. the hourly clock) changes.
 */

const EYE_COLOR = '#1c1e26'
const VISOR_COLOR = '#0e1b22'

const LEG_SIZE: [number, number, number] = [0.09, 0.35, 0.09]
const BODY_SIZE: [number, number, number] = [0.34, 0.42, 0.22]
const HEAD_SIZE: [number, number, number] = [0.26, 0.26, 0.26]
const EYE_SIZE: [number, number, number] = [0.05, 0.045, 0.02]

interface Archetype {
  body: string
  dark: string
  accessory: 'antenna' | 'headband' | 'visor' | 'cap'
}

const ARCHETYPES: Record<Harness, Archetype> = {
  omp: { body: '#e8865a', dark: '#a8542f', accessory: 'antenna' },
  claude: { body: '#cc785c', dark: '#8f4a36', accessory: 'headband' },
  pi: { body: '#3fb3a0', dark: '#2a7a6c', accessory: 'visor' },
  codex: { body: '#6a7bd8', dark: '#4653a0', accessory: 'cap' },
}

export interface HarnessAgentProps {
  harness: Harness
  position: [number, number, number]
  scale?: number
  /** Mono title line in the tooltip pill (repo, or `repo · harness`). */
  title?: string
  /** Tooltip body: session summary-or-fallback, or the LLM rollup text. */
  tooltip?: React.ReactNode
}

function Accessory({ kind, body, dark }: { kind: Archetype['accessory']; body: string; dark: string }) {
  switch (kind) {
    case 'antenna':
      return (
        <>
          <Voxel position={[0, 1.03, 0]} size={[0.03, 0.18, 0.03]} color={dark} />
          <Voxel position={[0, 1.15, 0]} size={[0.07, 0.07, 0.07]} color={body} />
        </>
      )
    case 'headband':
      return <Voxel position={[0, 0.95, 0]} size={[0.28, 0.05, 0.28]} color={dark} />
    case 'visor':
      return <Voxel position={[0, 0.92, 0.145]} size={[0.3, 0.09, 0.03]} color={VISOR_COLOR} />
    case 'cap':
      return (
        <>
          <Voxel position={[0, 1.025, 0]} size={[0.3, 0.07, 0.3]} color={dark} />
          <Voxel position={[0, 1.0, 0.18]} size={[0.32, 0.03, 0.1]} color={dark} />
        </>
      )
  }
}

export const HarnessAgent = memo(function HarnessAgent({
  harness,
  position,
  scale = 1,
  title,
  tooltip,
}: HarnessAgentProps) {
  const archetype = ARCHETYPES[harness]
  return (
    <group position={position} scale={scale}>
      {/* legs */}
      <Voxel position={[-0.09, 0.175, 0]} size={LEG_SIZE} color={archetype.dark} />
      <Voxel position={[0.09, 0.175, 0]} size={LEG_SIZE} color={archetype.dark} />
      {/* torso */}
      <Voxel position={[0, 0.56, 0]} size={BODY_SIZE} color={archetype.body} />
      {/* head */}
      <Voxel position={[0, 0.9, 0]} size={HEAD_SIZE} color={archetype.body} />
      {/* eyes (the pi visor covers them) */}
      {harness !== 'pi' && (
        <>
          <Voxel position={[-0.06, 0.915, 0.135]} size={EYE_SIZE} color={EYE_COLOR} />
          <Voxel position={[0.06, 0.915, 0.135]} size={EYE_SIZE} color={EYE_COLOR} />
        </>
      )}
      <Accessory kind={archetype.accessory} body={archetype.body} dark={archetype.dark} />
      {(title != null || tooltip != null) && (
        <Html position={[0, 2.3, 0]} center pointerEvents="none">
          <div className="pointer-events-none select-none rounded-lg border border-white/10 bg-black/35 px-3 py-2 shadow-lg backdrop-blur-md">
            {title != null && (
              <div className="font-mono text-[11px] font-semibold tracking-tight text-white/90">{title}</div>
            )}
            {tooltip != null && (
              <div className="mt-0.5 max-w-[220px] truncate text-[11px] text-white/60">{tooltip}</div>
            )}
          </div>
        </Html>
      )}
    </group>
  )
})
