'use client'

import { useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Grid, Html } from '@react-three/drei'
import { WarehouseEnvironment, WAREHOUSE_CONFIG } from './environments/warehouse'
import { HarnessAgent } from './HarnessAgent'
import { buildAgentLayout, SEAT_POSITIONS } from './layout'
import { loadSnapshot } from '@/lib/data'
import { useRange } from '@/lib/range-store'
import type { Snapshot } from '@/lib/types'

/**
 * Full-viewport hero: the voxel warehouse rendered behind the glass overlays.
 * Client-only (loaded via next/dynamic ssr:false from app/page.tsx) so the
 * local clock and /data/current.json fetch never touch the server.
 *
 * The scene is static — it renders pre-computed snapshot data and never calls
 * an LLM. Session characters take the hot-desk seats (SEAT_POSITIONS, the same
 * 16 slots the furniture uses). The rendering mode is derived from the selected
 * window's session count, never a user choice:
 *   - none   -> empty scene (env + grid + krabs remain)
 *   - <= 16  -> one character per session, tooltip = summary-or-fallback
 *   - > 16   -> one character per (repo x harness), tooltip = LLM rollup
 */

function localHour(): number {
  const d = new Date()
  return d.getHours() + d.getMinutes() / 60
}

/** Fixed anchor for the "+N more" overflow pill, right of the desk rows. */
const OVERFLOW_ANCHOR: [number, number, number] = [4.8, 2.4, 1.6]

export default function Scene() {
  // Local clock, refreshed every minute so daylight slowly follows the visitor.
  const [hour, setHour] = useState<number>(() => localHour())
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const range = useRange()

  useEffect(() => {
    const id = setInterval(() => setHour(localHour()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    loadSnapshot().then((snap) => {
      if (!cancelled) setSnapshot(snap)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const layout = useMemo(
    () =>
      buildAgentLayout({
        sessions: snapshot?.sessions ?? [],
        rollups: snapshot?.rollups ?? {},
        range,
        snapshotDate: snapshot?.snapshotDate ?? '',
      }),
    [snapshot, range],
  )

  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <Canvas
        shadows
        orthographic
        camera={{
          position: WAREHOUSE_CONFIG.camera.position,
          zoom: WAREHOUSE_CONFIG.camera.zoom,
          near: 0.1,
          far: 200,
        }}
        gl={{ antialias: true }}
        onCreated={({ camera }) => camera.lookAt(...WAREHOUSE_CONFIG.orbitTarget)}
      >
        <WarehouseEnvironment hour={hour} />
        <Grid
          position={[0, -0.1, 0]}
          args={[40, 40]}
          cellSize={1}
          cellThickness={0.4}
          cellColor="#2a2a3a"
          sectionSize={4}
          sectionThickness={0.8}
          sectionColor="#3a3a50"
          fadeDistance={40}
          fadeStrength={1}
          infiniteGrid
        />
        {layout.mode === 'collapsed' && layout.overflow > 0 && (
          <Html position={OVERFLOW_ANCHOR} center pointerEvents="none">
            <div className="pointer-events-none select-none rounded-lg border border-white/10 bg-black/35 px-3 py-2 shadow-lg backdrop-blur-md">
              <div className="font-mono text-[11px] font-semibold tracking-tight text-white/90">
                +{layout.overflow} more
              </div>
            </div>
          </Html>
        )}
        {layout.mode !== 'empty' &&
          layout.items.map((item) => (
            <HarnessAgent
              key={item.key}
              harness={item.harness}
              position={SEAT_POSITIONS[item.seatIndex]}
              title={item.title}
              tooltip={item.tooltip}
            />
          ))}
      </Canvas>
    </div>
  )
}
