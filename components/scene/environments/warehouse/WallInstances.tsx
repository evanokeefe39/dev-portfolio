import React, { useRef, useEffect, useMemo } from 'react'
import * as THREE from 'three'

/* ── Constants ── */

const BRICK_W = 0.24
const BRICK_H = 0.11
const MORTAR_GAP = 0.015
const BRICK_DEPTH = 0.1
const PLASTER_DEPTH = 0.03
const PLASTER_OFFSET = 0.06 // offset toward camera from brick surface

const BRICK_COLORS = [
  '#6a4535', '#7a5545', '#946858', '#8a5c4c', '#7e5040', '#926050', '#885848', // standard reds/browns
  '#5e3a2a', '#704838', '#a07060', // darker sooty + lighter sandy
  '#9a7868', '#b09080', // pale weathered bricks
  '#684030', '#7c5848', // deep burnt
]
const PLASTER = ['#f0ece4', '#ece8e0', '#e8e4dc', '#e4e0d6', '#e0dcd4'] // brighter whites

/* ── Shared math ── */

function hash(a: number, b: number, c: number) {
  let h = (a * 374761 + b * 668265 + c * 119473) | 0
  h = ((h >> 16) ^ h) * 0x45d9f3b | 0
  return (((h >> 16) ^ h) >>> 0) % 1000
}

function noise2d(x: number, y: number) {
  let h = (Math.floor(x * 73.1) * 374761 + Math.floor(y * 91.3) * 668265) | 0
  h = ((h >> 16) ^ h) * 0x45d9f3b | 0
  return (((h >> 16) ^ h) >>> 0) / 4294967296
}

/* ── Zone system ── */

type WinRect = { x1: number; y1: number; x2: number; y2: number }

interface BrickZone {
  cx: number; cy: number
  rx: number; ry: number
  dripX?: number
  dripTop?: number
  dripBottom?: number
}

function isInZone(bx: number, by: number, zone: BrickZone): boolean {
  const dx = (bx - zone.cx) / zone.rx
  const dy = (by - zone.cy) / zone.ry
  const dist = dx * dx + dy * dy
  const edgeNoise = noise2d(bx * 5, by * 7) * 0.6
  if (dist < 1.0 + edgeNoise) return true

  if (zone.dripX !== undefined && zone.dripTop !== undefined) {
    const dripW = 0.15 + noise2d(bx * 3, by * 11) * 0.12
    if (Math.abs(bx - zone.dripX) < dripW && by > zone.cy && by < zone.dripTop) {
      const t = (by - zone.cy) / (zone.dripTop - zone.cy)
      return noise2d(bx * 9, by * 13) > t * 0.6
    }
  }

  if (zone.dripX !== undefined && zone.dripBottom !== undefined) {
    const dripW = 0.15 + noise2d(bx * 3, by * 11) * 0.12
    if (Math.abs(bx - zone.dripX) < dripW && by < zone.cy && by > zone.dripBottom) {
      const t = (zone.cy - by) / (zone.cy - zone.dripBottom)
      return noise2d(bx * 9, by * 13) > t * 0.6
    }
  }

  return false
}

// Distance to nearest zone edge (for transition band). Returns 0 at center, 1 at edge, >1 outside.
function distToZoneEdge(bx: number, by: number, zones: BrickZone[]): number {
  let minDist = Infinity
  for (const zone of zones) {
    const dx = (bx - zone.cx) / zone.rx
    const dy = (by - zone.cy) / zone.ry
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < minDist) minDist = dist
  }
  return minDist
}

function isInAnyZone(bx: number, by: number, zones: BrickZone[]): boolean {
  for (const z of zones) {
    if (isInZone(bx, by, z)) return true
  }
  return false
}

/* ── Zone definitions ── */

const BACK_ZONES: BrickZone[] = [
  { cx: 0.3, cy: 0.6, rx: 0.4, ry: 0.4 },
  { cx: 11.7, cy: 0.5, rx: 0.35, ry: 0.4 },
]

const LEFT_ZONES: BrickZone[] = [
  { cx: 0.4, cy: 1.2, rx: 0.6, ry: 1.3 },
  { cx: 0.3, cy: 2.0, rx: 0.3, ry: 0.4, dripX: 0.25, dripTop: 3.5 },
  { cx: 11.6, cy: 1.0, rx: 0.5, ry: 1.0 },
  { cx: 11.5, cy: 1.8, rx: 0.25, ry: 0.3, dripX: 11.6, dripTop: 3.0 },
  { cx: 4.0, cy: 0.8, rx: 0.9, ry: 0.5 },
  { cx: 8.0, cy: 0.6, rx: 0.7, ry: 0.4 },
]

const RIGHT_ZONES: BrickZone[] = [
  { cx: 0.35, cy: 0.9, rx: 0.5, ry: 0.8 },
  { cx: 0.3, cy: 1.5, rx: 0.25, ry: 0.3, dripX: 0.25, dripTop: 2.8 },
  { cx: 11.6, cy: 1.5, rx: 0.5, ry: 1.5 },
  { cx: 11.5, cy: 2.5, rx: 0.3, ry: 0.3, dripX: 11.6, dripTop: 4.0 },
  { cx: 5.2, cy: 3.8, rx: 0.4, ry: 0.3, dripX: 5.1, dripBottom: 2.0 },
  { cx: 6.8, cy: 3.7, rx: 0.35, ry: 0.25, dripX: 6.9, dripBottom: 2.2 },
  { cx: 5.8, cy: 1.2, rx: 0.5, ry: 0.5 },
]

/* ── Window definitions (wall-local coords: 0-12 horizontal, 0-5 vertical) ── */

const BACK_WINDOWS: WinRect[] = [
  { x1: 4.5, y1: 1, x2: 7.5, y2: 4 },
  { x1: 8.5, y1: 1, x2: 11, y2: 4 },
]

const LEFT_WINDOWS: WinRect[] = [
  { x1: 4, y1: 1, x2: 9, y2: 4 },
]

const RIGHT_WINDOWS: WinRect[] = [
  { x1: 1, y1: 1, x2: 5, y2: 4 },
  { x1: 7, y1: 1, x2: 11, y2: 4 },
]

/* ── Wall configs ── */

interface WallConfig {
  wallId: number
  windows: WinRect[]
  zones: BrickZone[]
  // Convert wall-local (u, v) to world (x, y, z) for brick surface
  getWorldPos: (u: number, v: number) => [number, number, number]
  // Convert wall-local (u, v) to world (x, y, z) for plaster surface (offset toward camera)
  getPlasterPos: (u: number, v: number) => [number, number, number]
  // Size of a brick for this wall orientation
  brickSize: [number, number, number]
  // Size of a plaster tile for this wall orientation
  plasterSize: [number, number, number]
}

const WALLS: WallConfig[] = [
  {
    // Back wall (z = -5.95)
    wallId: 0,
    windows: BACK_WINDOWS,
    zones: BACK_ZONES,
    getWorldPos: (u, v) => [u - 6, v, -5.95],
    getPlasterPos: (u, v) => [u - 6, v, -5.95 + PLASTER_OFFSET],
    brickSize: [BRICK_W, BRICK_H, BRICK_DEPTH],
    plasterSize: [BRICK_W, BRICK_H, PLASTER_DEPTH],
  },
  {
    // Left wall (x = -5.95)
    wallId: 1,
    windows: LEFT_WINDOWS,
    zones: LEFT_ZONES,
    getWorldPos: (u, v) => [-5.95, v, u - 6],
    getPlasterPos: (u, v) => [-5.95 + PLASTER_OFFSET, v, u - 6],
    brickSize: [BRICK_DEPTH, BRICK_H, BRICK_W],
    plasterSize: [PLASTER_DEPTH, BRICK_H, BRICK_W],
  },
  {
    // Right wall (z = 5.95)
    wallId: 2,
    windows: RIGHT_WINDOWS,
    zones: RIGHT_ZONES,
    getWorldPos: (u, v) => [u - 6, v, 5.95],
    getPlasterPos: (u, v) => [u - 6, v, 5.95 - PLASTER_OFFSET],
    brickSize: [BRICK_W, BRICK_H, BRICK_DEPTH],
    plasterSize: [BRICK_W, BRICK_H, PLASTER_DEPTH],
  },
]

/* ── Brick clipping at window edges ── */

interface ClippedBrick {
  cx: number // clipped center x (wall-local)
  cy: number // clipped center y (wall-local)
  scaleU: number // width scale factor (1.0 = full brick)
  scaleV: number // height scale factor
}

function clipBrickToWindows(
  bx: number, by: number, bw: number, bh: number, windows: WinRect[]
): ClippedBrick | null {
  let left = bx
  let right = bx + bw
  let bottom = by
  let top = by + bh

  for (const w of windows) {
    // Check if brick overlaps this window at all
    if (right <= w.x1 || left >= w.x2 || top <= w.y1 || bottom >= w.y2) continue

    // Brick overlaps window — determine which edge to clip
    const overlapLeft = right - w.x1
    const overlapRight = w.x2 - left
    const overlapBottom = top - w.y1
    const overlapTop = w.y2 - bottom

    // If fully inside window, skip entirely
    if (left >= w.x1 && right <= w.x2 && bottom >= w.y1 && top <= w.y2) return null

    // Clip from the side with smallest overlap
    const minOverlap = Math.min(
      left < w.x1 ? Infinity : overlapRight,
      right > w.x2 ? Infinity : overlapLeft,
      bottom < w.y1 ? Infinity : overlapTop,
      top > w.y2 ? Infinity : overlapBottom,
    )

    if (overlapLeft === minOverlap && left < w.x1) {
      right = w.x1
    } else if (overlapRight === minOverlap && right > w.x2) {
      left = w.x2
    } else if (overlapBottom === minOverlap && bottom < w.y1) {
      top = w.y1
    } else if (overlapTop === minOverlap && top > w.y2) {
      bottom = w.y2
    } else {
      return null // ambiguous, skip
    }
  }

  const clippedW = right - left
  const clippedH = top - bottom
  if (clippedW < bw * 0.2 || clippedH < bh * 0.2) return null // too small

  return {
    cx: (left + right) / 2,
    cy: (bottom + top) / 2,
    scaleU: clippedW / bw,
    scaleV: clippedH / bh,
  }
}

/* ── Color helpers ── */

function hexToRGB(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255]
}

function darkenRGB(r: number, g: number, b: number, amount: number): [number, number, number] {
  return [r * (1 - amount), g * (1 - amount), b * (1 - amount)]
}

function lerpRGB(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
  t: number
): [number, number, number] {
  return [r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t]
}

/* ── Instance data computation ── */

interface InstanceData {
  matrices: Float32Array
  colors: Float32Array
  count: number
}

function computeAllInstances() {
  const brickInstances: { pos: [number, number, number]; scale: [number, number, number]; color: [number, number, number] }[] = []
  const plasterInstances: { pos: [number, number, number]; scale: [number, number, number]; color: [number, number, number] }[] = []
  const crackInstances: { pos: [number, number, number]; scale: [number, number, number]; rotation: number }[] = []

  const cols = Math.ceil(12 / (BRICK_W + MORTAR_GAP))
  const rows = Math.ceil(5 / (BRICK_H + MORTAR_GAP))

  const dampColor = hexToRGB('#5a4a3a') // damp brick tint for bottom rows

  for (const wall of WALLS) {
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const offset = r % 2 === 0 ? 0 : BRICK_W / 2
        const bx = c * (BRICK_W + MORTAR_GAP) + offset
        const by = r * (BRICK_H + MORTAR_GAP)

        if (bx < 0 || bx + BRICK_W > 12.1 || by < 0 || by + BRICK_H > 5.1) continue

        const bcx = bx + BRICK_W / 2
        const bcy = by + BRICK_H / 2

        // Clip brick to window edges
        const clipped = clipBrickToWindows(bx, by, BRICK_W, BRICK_H, wall.windows)
        if (clipped === null) continue

        // Brick color with damp tint near floor
        const baseColor = hexToRGB(BRICK_COLORS[hash(c, r, wall.wallId) % BRICK_COLORS.length])
        let [br, bg, bb] = baseColor
        // Rising damp: darken bottom 2 rows
        if (r < 3) {
          const dampT = (3 - r) / 3 * 0.15
          ;[br, bg, bb] = lerpRGB(br, bg, bb, dampColor[0], dampColor[1], dampColor[2], dampT)
        }
        // Per-brick variation for contrast between neighbours
        const variation = (hash(c, r, wall.wallId + 100) / 1000 - 0.5) * 0.12
        br = Math.max(0, Math.min(1, br + variation))
        bg = Math.max(0, Math.min(1, bg + variation * 0.7))
        bb = Math.max(0, Math.min(1, bb + variation * 0.5))

        const worldPos = wall.getWorldPos(clipped.cx, clipped.cy)
        brickInstances.push({
          pos: worldPos,
          scale: [
            wall.brickSize[0] * (wall.brickSize[0] > 0.1 ? clipped.scaleU : 1),
            wall.brickSize[1] * clipped.scaleV,
            wall.brickSize[2] * (wall.brickSize[2] > 0.1 ? clipped.scaleU : 1),
          ],
          color: [br, bg, bb],
        })

        // Plaster layer: skip if in exposed zone
        const inZone = isInAnyZone(bcx, bcy, wall.zones)
        if (!inZone) {
          const zoneDist = distToZoneEdge(bcx, bcy, wall.zones)
          const plasterColor = hexToRGB(PLASTER[hash(c, r, wall.wallId + 50) % PLASTER.length])
          let [pr, pg, pb] = plasterColor

          let extraOffset = 0
          const isTransition = zoneDist < 1.4

          if (isTransition) {
            // Transition band: darken and tint toward brown
            const t = Math.max(0, 1 - (zoneDist - 0.7) / 0.7) // 0 at dist=1.4, 1 at dist=0.7
            const brownTint = hexToRGB('#b0a090')
            ;[pr, pg, pb] = lerpRGB(pr, pg, pb, brownTint[0], brownTint[1], brownTint[2], t * 0.4)
            // Darken
            ;[pr, pg, pb] = darkenRGB(pr, pg, pb, t * 0.12)
            // Extra z-offset for lifting effect
            extraOffset = t * 0.012 * noise2d(bcx * 7, bcy * 11)

            // Spawn crack lines
            if (zoneDist < 1.2 && noise2d(bcx * 13, bcy * 17) > 0.55) {
              const crackPos = wall.getPlasterPos(clipped.cx, clipped.cy)
              crackInstances.push({
                pos: crackPos,
                scale: [
                  wall.wallId === 1 ? 0.002 : (noise2d(bcx * 3, bcy * 5) > 0.5 ? 0.002 : BRICK_W * 0.4),
                  noise2d(bcx * 3, bcy * 5) > 0.5 ? BRICK_H * 0.8 : 0.002,
                  wall.wallId === 1 ? BRICK_W * 0.4 : 0.002,
                ],
                rotation: (noise2d(bcx * 19, bcy * 23) - 0.5) * 0.3,
              })
            }
          }

          // Adjust plaster position with extra offset for lifting
          const plasterPos = wall.getPlasterPos(clipped.cx, clipped.cy)
          if (wall.wallId === 0) plasterPos[2] += extraOffset // back wall: +z
          else if (wall.wallId === 1) plasterPos[0] += extraOffset // left wall: +x
          else plasterPos[2] -= extraOffset // right wall: -z

          plasterInstances.push({
            pos: plasterPos,
            scale: [
              wall.plasterSize[0] * (wall.plasterSize[0] > 0.1 ? clipped.scaleU : 1),
              wall.plasterSize[1] * clipped.scaleV,
              wall.plasterSize[2] * (wall.plasterSize[2] > 0.1 ? clipped.scaleU : 1),
            ],
            color: [pr, pg, pb],
          })
        }
      }
    }
  }

  return { brickInstances, plasterInstances, crackInstances }
}

function buildInstanceData(
  instances: { pos: [number, number, number]; scale: [number, number, number]; color: [number, number, number] }[]
): InstanceData {
  const count = instances.length
  const matrices = new Float32Array(count * 16)
  const colors = new Float32Array(count * 3)
  const mat = new THREE.Matrix4()
  const scaleVec = new THREE.Vector3()
  const posVec = new THREE.Vector3()
  const quat = new THREE.Quaternion()

  for (let i = 0; i < count; i++) {
    const inst = instances[i]
    posVec.set(inst.pos[0], inst.pos[1], inst.pos[2])
    scaleVec.set(inst.scale[0], inst.scale[1], inst.scale[2])
    mat.compose(posVec, quat, scaleVec)
    mat.toArray(matrices, i * 16)
    colors[i * 3] = inst.color[0]
    colors[i * 3 + 1] = inst.color[1]
    colors[i * 3 + 2] = inst.color[2]
  }

  return { matrices, colors, count }
}

function buildCrackData(
  cracks: { pos: [number, number, number]; scale: [number, number, number]; rotation: number }[]
): InstanceData {
  const count = Math.min(cracks.length, 400)
  const matrices = new Float32Array(count * 16)
  const colors = new Float32Array(count * 3)
  const mat = new THREE.Matrix4()
  const scaleVec = new THREE.Vector3()
  const posVec = new THREE.Vector3()
  const quat = new THREE.Quaternion()

  const crackColor = hexToRGB('#2a2420')

  for (let i = 0; i < count; i++) {
    const crack = cracks[i]
    posVec.set(crack.pos[0], crack.pos[1], crack.pos[2])
    scaleVec.set(crack.scale[0], crack.scale[1], crack.scale[2])
    // Slight rotation for organic look
    quat.setFromEuler(new THREE.Euler(0, 0, crack.rotation))
    mat.compose(posVec, quat, scaleVec)
    mat.toArray(matrices, i * 16)
    colors[i * 3] = crackColor[0]
    colors[i * 3 + 1] = crackColor[1]
    colors[i * 3 + 2] = crackColor[2]
  }

  return { matrices, colors, count }
}

/* ── InstancedMesh component ── */

function WallLayer({
  data,
  baseGeomArgs,
  castShadow = true,
}: {
  data: InstanceData
  baseGeomArgs: [number, number, number]
  castShadow?: boolean
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null)

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh || data.count === 0) return

    const instanceMatrix = new THREE.InstancedBufferAttribute(data.matrices, 16)
    mesh.instanceMatrix = instanceMatrix
    mesh.instanceMatrix.needsUpdate = true

    const colorAttr = new THREE.InstancedBufferAttribute(data.colors, 3)
    mesh.instanceColor = colorAttr
    mesh.instanceColor.needsUpdate = true
  }, [data])

  if (data.count === 0) return null

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, data.count]}
      castShadow={castShadow}
      receiveShadow
      frustumCulled={false}
    >
      <boxGeometry args={baseGeomArgs} />
      <meshLambertMaterial />
    </instancedMesh>
  )
}

/* ── Mortar backing: panels behind bricks so gaps show mortar, not void ── */
/* Split around window openings to avoid blocking glass */

function MortarPanel({ pos, size }: { pos: [number, number, number]; size: [number, number, number] }) {
  return (
    <mesh position={pos} receiveShadow>
      <boxGeometry args={size} />
      <meshLambertMaterial color="#8a8078" side={THREE.DoubleSide} />
    </mesh>
  )
}

function MortarBacking() {
  // Each wall is 12 wide (wall-local 0-12) x 5 tall. Windows cut holes.
  // We render solid rectangles for each non-window region.
  // Wall-local coords: u = horizontal (0-12), v = vertical (0-5)

  const panels: React.ReactNode[] = []
  let key = 0

  function addPanels(
    windows: WinRect[],
    toWorld: (u1: number, v1: number, u2: number, v2: number) => { pos: [number, number, number]; size: [number, number, number] }
  ) {
    // Below all windows (full width)
    const minWinY = windows.length > 0 ? Math.min(...windows.map(w => w.y1)) : 5
    if (minWinY > 0) {
      const { pos, size } = toWorld(0, 0, 12, minWinY)
      panels.push(<MortarPanel key={key++} pos={pos} size={size} />)
    }

    // Above all windows (full width)
    const maxWinY = windows.length > 0 ? Math.max(...windows.map(w => w.y2)) : 0
    if (maxWinY < 5) {
      const { pos, size } = toWorld(0, maxWinY, 12, 5)
      panels.push(<MortarPanel key={key++} pos={pos} size={size} />)
    }

    // Between and beside windows at window height
    if (windows.length > 0) {
      const sorted = [...windows].sort((a, b) => a.x1 - b.x1)
      // Left of first window
      if (sorted[0].x1 > 0) {
        const { pos, size } = toWorld(0, minWinY, sorted[0].x1, maxWinY)
        panels.push(<MortarPanel key={key++} pos={pos} size={size} />)
      }
      // Between windows
      for (let i = 0; i < sorted.length - 1; i++) {
        const { pos, size } = toWorld(sorted[i].x2, minWinY, sorted[i + 1].x1, maxWinY)
        panels.push(<MortarPanel key={key++} pos={pos} size={size} />)
      }
      // Right of last window
      const last = sorted[sorted.length - 1]
      if (last.x2 < 12) {
        const { pos, size } = toWorld(last.x2, minWinY, 12, maxWinY)
        panels.push(<MortarPanel key={key++} pos={pos} size={size} />)
      }
    }
  }

  // Back wall (z = -5.96)
  addPanels(BACK_WINDOWS, (u1, v1, u2, v2) => ({
    pos: [(u1 + u2) / 2 - 6, (v1 + v2) / 2, -5.96],
    size: [u2 - u1, v2 - v1, 0.02],
  }))

  // Left wall (x = -5.96)
  addPanels(LEFT_WINDOWS, (u1, v1, u2, v2) => ({
    pos: [-5.96, (v1 + v2) / 2, (u1 + u2) / 2 - 6],
    size: [0.02, v2 - v1, u2 - u1],
  }))

  // Right wall (z = 5.96)
  addPanels(RIGHT_WINDOWS, (u1, v1, u2, v2) => ({
    pos: [(u1 + u2) / 2 - 6, (v1 + v2) / 2, 5.96],
    size: [u2 - u1, v2 - v1, 0.02],
  }))

  return <>{panels}</>
}

/* ── Main component ── */

export function BrickWallInstances() {
  const { brickData, plasterData, crackData } = useMemo(() => {
    const { brickInstances, plasterInstances, crackInstances } = computeAllInstances()
    return {
      brickData: buildInstanceData(brickInstances),
      plasterData: buildInstanceData(plasterInstances),
      crackData: buildCrackData(crackInstances),
    }
  }, [])

  return (
    <>
      <MortarBacking />
      <WallLayer data={brickData} baseGeomArgs={[1, 1, 1]} />
      <WallLayer data={plasterData} baseGeomArgs={[1, 1, 1]} />
      <WallLayer data={crackData} baseGeomArgs={[1, 1, 1]} castShadow={false} />
    </>
  )
}
