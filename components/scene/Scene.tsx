'use client'

import { useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Grid, Html, Stats } from '@react-three/drei'
import { WarehouseEnvironment, WAREHOUSE_CONFIG } from './environments/warehouse'
import { SessionKrab } from './SessionKrab'
import { buildKrabLayout, SEAT_POSITIONS } from './layout'
import { useRange } from '@/lib/range-store'
import { ensureRangeSessions, useSnapshot } from '@/lib/snapshot-store'

/**
 * Full-viewport hero: the voxel warehouse rendered behind the glass overlays.
 * Client-only (loaded via next/dynamic ssr:false from app/page.tsx) so the
 * local clock and data fetches never touch the server. /data/7d.json loads
 * eagerly (range aggregates + 7d-windowed sessions); 30d/90d/1y/all session
 * slices load lazily in the background — while a longer-range slice is still
 * loading the 7d layout stays visible, then the scene recomputes (repo mode)
 * when the slice lands.
 *
 * The scene is static — it renders pre-computed snapshot data and never calls
 * an LLM. Krab labels are hover-gated: a tooltip pill appears only while the
 * pointer is over a krab. At 7d each session is one krab on the hot-desk
 * seats (SEAT_POSITIONS); above 7d sessions collapse to per-repo aggregate
 * krabs. Any overflow shows as a "+N more" pill. An empty window renders an
 * empty scene.
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
  const range = useRange()
  const { snapshot, rangeSessions } = useSnapshot()

  useEffect(() => {
    const id = setInterval(() => setHour(localHour()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Load the lazy per-range session slice once a longer range is selected;
  // the eager 7d layout stays visible until the slice lands.
  useEffect(() => {
    if (range !== '7d') ensureRangeSessions(range)
  }, [range])

  const layout = useMemo(() => {
    const sliceReady = range === '7d' || rangeSessions[range] !== undefined
    const layoutRange = sliceReady ? range : '7d'
    const sessions = sliceReady
      ? range === '7d'
        ? (snapshot?.sessions ?? [])
        : (rangeSessions[range] ?? [])
      : (snapshot?.sessions ?? [])
    return buildKrabLayout({
      sessions,
      range: layoutRange,
      snapshotDate: snapshot?.snapshotDate ?? '',
    })
  }, [snapshot, range, rangeSessions])

  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <Canvas
        shadows
        // dpr 1: iGPU fill-rate bound; 1.5x retina costs 2.25x pixels through the post stack.
        dpr={1}
        style={{ pointerEvents: 'auto' }}
        orthographic
        camera={{
          position: WAREHOUSE_CONFIG.camera.position,
          zoom: WAREHOUSE_CONFIG.camera.zoom,
          near: 0.1,
          far: 200,
        }}
        // antialias off: the EffectComposer multisamples its own composite,
        // so canvas MSAA would only double the fill cost on retina DPR.
        gl={{ antialias: false }}
        onCreated={({ camera }) => camera.lookAt(...WAREHOUSE_CONFIG.orbitTarget)}
      >
        {process.env.NODE_ENV === 'development' && <Stats showPanel={0} />}
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
        {layout.mode !== 'empty' && layout.overflow > 0 && (
          <Html position={OVERFLOW_ANCHOR} center pointerEvents="none" wrapperClass="pointer-events-none">
            <div className="pointer-events-none select-none rounded-lg border border-white/10 bg-black/35 px-3 py-2 shadow-lg backdrop-blur-md">
              <div className="font-mono text-[11px] font-semibold tracking-tight text-white/90">
                +{layout.overflow} more
              </div>
            </div>
          </Html>
        )}
        {layout.mode !== 'empty' &&
          layout.items.map((item) => (
            <SessionKrab
              key={item.key}
              harness={item.harness}
              position={SEAT_POSITIONS[item.seatIndex]}
              scale={item.scale}
              title={item.tooltipTitle}
              body={item.tooltipBody}
            />
          ))}
      </Canvas>
    </div>
  )
}
