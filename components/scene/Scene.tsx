'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Canvas } from '@react-three/fiber'
import { CameraControls, CameraControlsImpl, Grid, Html, Stats } from '@react-three/drei'
import * as THREE from 'three'
import { WarehouseEnvironment, WAREHOUSE_CONFIG } from './environments/warehouse'
import { SessionKrab } from './SessionKrab'
import {
  aggregateReposByRepo,
  buildKrabLayout,
  COUCH_SPOTLIGHT_SEAT,
  filterWindow,
  repoTooltipBody,
  resolveFocus,
  SEAT_POSITIONS,
  sessionScale,
  type FocusTarget,
} from './layout'
import { clearSelection, useSelection } from '@/lib/selection-store'
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
 * The scene is explorable: drei <CameraControls> gives drag-to-pan, wheel /
 * pinch zoom (15-90) and clamped rotation. Selecting a repo from the stat
 * card flies the camera to its krab — a desk krab, or the couch spotlight
 * for an out-of-list repo — with a highlight ring + session panel above it;
 * deselecting returns to the home view. Card hover highlights the matching
 * krab without moving the camera. Krab labels are hover-gated. An empty
 * window renders an empty scene.
 */

function localHour(): number {
  const d = new Date()
  return d.getHours() + d.getMinutes() / 60
}

/** Fixed anchor for the "+N more" overflow pill, right of the desk rows. */
const OVERFLOW_ANCHOR: [number, number, number] = [4.8, 2.4, 1.6]

/** Home camera state (WAREHOUSE_CONFIG) restored on deselect. */
const HOME_POSITION = WAREHOUSE_CONFIG.camera.position
const HOME_TARGET = WAREHOUSE_CONFIG.orbitTarget

/** Focus-fit box around a seat: ~[2.5, 2, 2.5] world units + padding. */
const FOCUS_BOX_SIZE: [number, number, number] = [2.5, 2, 2.5]
const FOCUS_BOX_PADDING = 0.5

/** camera-controls pan boundary — generously around the room. */
const ROOM_BOUNDARY = new THREE.Box3(
  new THREE.Vector3(-12, 0, -10),
  new THREE.Vector3(12, 10, 10),
)

interface CameraRigProps {
  focus: FocusTarget
  controlsRef: RefObject<CameraControlsImpl | null>
  controlsReady: boolean
}

/**
 * Drives the shared camera-controls instance on focus changes. Lives inside
 * the Canvas. The first run is skipped so mounting never animates away from
 * the home view — position/zoom come from the Canvas camera prop and the home
 * target is pinned by the controls ref callback before the first frame.
 */
function CameraRig({ focus, controlsRef, controlsReady }: CameraRigProps) {
  const firstRun = useRef(true)

  useEffect(() => {
    const controls = controlsRef.current
    if (!controlsReady || controls === null) return
    // Mount-time guard: no fly-in — the camera is already at home.
    if (firstRun.current) {
      firstRun.current = false
      return
    }

    if (focus === null) {
      // Deselect → fly home and restore the default zoom. zoomTo drives the
      // same internal zoom state fitToBox uses (a direct camera.zoom write
      // would be reverted on the controls' next update).
      controls.setLookAt(...HOME_POSITION, ...HOME_TARGET, true)
      controls.zoomTo(WAREHOUSE_CONFIG.camera.zoom, true)
      return
    }

    const center =
      focus.kind === 'desk' ? SEAT_POSITIONS[focus.item.seatIndex] : COUCH_SPOTLIGHT_SEAT
    const box = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(center[0], center[1], center[2]),
      new THREE.Vector3(...FOCUS_BOX_SIZE),
    )
    box.expandByScalar(FOCUS_BOX_PADDING)
    controls.fitToBox(box, true)
  }, [focus, controlsReady, controlsRef])

  return null
}

export default function Scene() {
  // Local clock, refreshed every minute so daylight slowly follows the visitor.
  const [hour, setHour] = useState<number>(() => localHour())
  const range = useRange()
  const { snapshot, rangeSessions } = useSnapshot()
  const { selectedRepo, hoveredRepo } = useSelection()

  // C7: a range change clears the selection — a repo absent from the new
  // window must never leave the camera staring at an empty seat.
  useEffect(() => {
    clearSelection()
  }, [range])

  useEffect(() => {
    const id = setInterval(() => setHour(localHour()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Load the lazy per-range session slice once a longer range is selected;
  // the eager 7d layout stays visible until the slice lands.
  useEffect(() => {
    if (range !== '7d') ensureRangeSessions(range)
  }, [range])

  // Effective sessions: the eager 7d slice, or the lazy slice once it lands.
  // Layout AND repos derive from the SAME effective source, so focus
  // resolution at a non-7d range sees the slice's repos, not last week's.
  const { layout, repos } = useMemo(() => {
    const sliceReady = range === '7d' || rangeSessions[range] !== undefined
    const layoutRange = sliceReady ? range : '7d'
    const sessions = sliceReady
      ? range === '7d'
        ? (snapshot?.sessions ?? [])
        : (rangeSessions[range] ?? [])
      : (snapshot?.sessions ?? [])
    const snapshotDate = snapshot?.snapshotDate ?? ''
    return {
      layout: buildKrabLayout({ sessions, range: layoutRange, snapshotDate }),
      repos: aggregateReposByRepo(filterWindow(sessions, layoutRange, snapshotDate)),
    }
  }, [snapshot, range, rangeSessions])

  const focus = useMemo(
    () => resolveFocus(layout.items, repos, selectedRepo),
    [layout, repos, selectedRepo],
  )

  // Sessions for the focused desk krab's panel (items derive from repos, so
  // the focused item's repo is always present).
  const focusedSessions =
    focus?.kind === 'desk'
      ? (repos.find((r) => r.repo === focus.item.repo)?.sessions ?? [])
      : undefined

  // CameraControls instance + ready flag. The ref callback also pins the home
  // target and the room boundary before the first frame — the camera-controls
  // instance has no `target`/`boundary` props, only setTarget/setBoundary.
  const controlsRef = useRef<CameraControlsImpl | null>(null)
  const controlsInitialized = useRef(false)
  const [controlsReady, setControlsReady] = useState(false)
  const setControlsRef = useCallback((c: CameraControlsImpl | null) => {
    controlsRef.current = c
    if (c === null) {
      // StrictMode double-mounts: reset so a fresh instance re-initializes.
      controlsInitialized.current = false
      return
    }
    if (controlsInitialized.current) return
    controlsInitialized.current = true
    c.setTarget(...HOME_TARGET, false)
    c.setBoundary(ROOM_BOUNDARY)
    setControlsReady(true)
  }, [])

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
      >
        {process.env.NODE_ENV === 'development' && <Stats showPanel={0} />}
        <CameraRig focus={focus} controlsRef={controlsRef} controlsReady={controlsReady} />
        <CameraControls
          ref={setControlsRef}
          minPolarAngle={0.4}
          maxPolarAngle={1.35}
          minZoom={15}
          maxZoom={90}
          smoothTime={0.6}
          dampingFactor={0.08}
          mouseButtons={{
            left: CameraControlsImpl.ACTION.TRUCK,
            right: CameraControlsImpl.ACTION.ROTATE,
            middle: CameraControlsImpl.ACTION.DOLLY,
            wheel: CameraControlsImpl.ACTION.ZOOM,
          }}
          touches={{
            one: CameraControlsImpl.ACTION.TOUCH_TRUCK,
            two: CameraControlsImpl.ACTION.TOUCH_ZOOM_TRUCK,
            three: CameraControlsImpl.ACTION.TOUCH_TRUCK,
          }}
        />
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
              focused={focus?.kind === 'desk' && focus.item.repo === item.repo}
              highlighted={hoveredRepo === item.repo}
              sessions={
                focus?.kind === 'desk' && focus.item.repo === item.repo
                  ? focusedSessions
                  : undefined
              }
            />
          ))}
        {focus?.kind === 'couch' && (
          <group position={COUCH_SPOTLIGHT_SEAT} rotation={[0, -Math.PI / 2, 0]}>
            <SessionKrab
              harness={focus.repo.harness}
              position={[0, 0, 0]}
              scale={sessionScale(focus.repo.assistantMessages)}
              title={`${focus.repo.repo} · ${focus.repo.harness}`}
              body={repoTooltipBody(focus.repo)}
              focused
              highlighted={hoveredRepo === focus.repo.repo}
              sessions={focus.repo.sessions}
            />
          </group>
        )}
      </Canvas>
    </div>
  )
}
