'use client'

import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Grid, Html } from '@react-three/drei'
import { WarehouseEnvironment, WAREHOUSE_CONFIG } from './environments/warehouse'
import { loadSnapshot } from '@/lib/data'
import type { ActivityItem } from '@/lib/types'

/**
 * Full-viewport hero: the voxel warehouse rendered behind the glass overlays.
 * Client-only (loaded via next/dynamic ssr:false from app/page.tsx) so the
 * local clock and /data/current.json fetch never touch the server.
 */

function localHour(): number {
  const d = new Date()
  return d.getHours() + d.getMinutes() / 60
}

/** Anchor points for the floating activity pills, spread across the warehouse. */
const LABEL_ANCHORS: [number, number, number][] = [
  [0.5, 2.3, -0.8], // over the hot desks
  [3.2, 2.3, 2.0], // center-right, above the walkway
  [-2.0, 2.3, -2.4], // front of the mezzanine
  [-1.2, 2.3, 3.0], // lounge corner
  [3.4, 2.3, -2.6], // right of the desk rows
]

function formatLocDelta(a: ActivityItem): { added: string; removed: string } {
  const added = a.linesAdded > 0 ? `+${a.linesAdded}` : ''
  const removed = a.linesRemoved > 0 ? `−${a.linesRemoved}` : ''
  return { added, removed }
}

/** Floating glass pills anchored in the scene via drei <Html>. */
function SessionLabels({ activities }: { activities: ActivityItem[] }) {
  const items = activities.slice(0, 5)
  return (
    <>
      {items.map((a, i) => {
        const { added, removed } = formatLocDelta(a)
        return (
          <Html key={`${a.repo}-${a.ts}`} position={LABEL_ANCHORS[i % LABEL_ANCHORS.length]} center pointerEvents="none">
            <div className="pointer-events-none select-none rounded-lg border border-white/10 bg-black/35 px-3 py-2 shadow-lg backdrop-blur-md">
              <div className="font-mono text-[11px] font-semibold tracking-tight text-white/90">
                {a.repo}
              </div>
              <div className="mt-0.5 max-w-[220px] truncate text-[11px] text-white/60">
                {a.message}
              </div>
              {(added || removed) && (
                <div className="mt-1 font-mono text-[10px]">
                  {added && <span className="text-emerald-300">{added}</span>}
                  {added && removed && <span className="text-white/30"> / </span>}
                  {removed && <span className="text-rose-300">{removed}</span>}
                </div>
              )}
            </div>
          </Html>
        )
      })}
    </>
  )
}

export default function Scene() {
  // Local clock, refreshed every minute so daylight slowly follows the visitor.
  const [hour, setHour] = useState<number>(() => localHour())
  const [activities, setActivities] = useState<ActivityItem[] | null>(null)

  useEffect(() => {
    const id = setInterval(() => setHour(localHour()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    loadSnapshot().then((snapshot) => {
      if (!cancelled) setActivities(snapshot?.recentActivity ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [])

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
        {activities && activities.length > 0 && <SessionLabels activities={activities} />}
      </Canvas>
    </div>
  )
}
