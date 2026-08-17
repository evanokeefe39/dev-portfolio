import React from 'react'
import { Voxel } from '../../Voxel'
import { BrickWallInstances } from './WallInstances'


// Debug axis: Red=+X, Green=+Y, Blue=+Z (placed outside the room)
export function DebugAxis() {
  const ox = 8, oz = 8
  return (
    <>
      <Voxel position={[ox + 1, 0.02, oz]} size={[2, 0.04, 0.04]} color="#ff0000" />
      <Voxel position={[ox + 2.1, 0.02, oz]} size={[0.15, 0.15, 0.04]} color="#ff0000" />
      <Voxel position={[ox, 1, oz]} size={[0.04, 2, 0.04]} color="#00ff00" />
      <Voxel position={[ox, 0.02, oz + 1]} size={[0.04, 0.04, 2]} color="#0000ff" />
      <Voxel position={[ox, 0.02, oz + 2.1]} size={[0.04, 0.15, 0.15]} color="#0000ff" />
    </>
  )
}

export function Floor() {
  return (
    <Voxel position={[0, -0.05, 0]} size={[12, 0.08, 12]} color="#b0b0ae" />
  )
}

export function Walls() {
  return <BrickWallInstances />
}

/* ── Crittall-style steel windows ── */

const CrittallWindowRect = React.memo(function CrittallWindowRect({
  x1, y1, x2, y2, z, flip,
  cols, rows,
  openRows,
  openAngle = 0,
  openDir = 1,
}: {
  x1: number; y1: number; x2: number; y2: number
  z: number
  flip?: boolean
  cols: number; rows: number
  openRows?: [number, number] // [startRow, endRow) — rows that can open (awning section)
  openAngle?: number // radians, how far open (0 = closed, ~0.3 = partially open)
  openDir?: number // 1 = outward, -1 = inward
}) {
  const w = x2 - x1
  const h = y2 - y1
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2
  const bar = 0.025
  const frameColor = '#1a1a1a'
  const glassColor = '#b8d0d8'

  const paneW = (w - bar * (cols + 1)) / cols
  const paneH = (h - bar * (rows + 1)) / rows

  const elements: React.ReactNode[] = []
  const openPanes: React.ReactNode[] = []

  const isOpenable = (r: number) => openRows && r >= openRows[0] && r < openRows[1]

  // glass panes
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const px = x1 + bar + c * (paneW + bar) + paneW / 2
      const py = y1 + bar + r * (paneH + bar) + paneH / 2

      const pane = (
        <Voxel key={`p-${c}-${r}`}
          position={flip ? [z, py, px] : [px, py, z]}
          size={flip ? [0.03, paneH, paneW] : [paneW, paneH, 0.03]}
          color={glassColor}
          castShadow={false}
          transparent
          opacity={0.35}
        />
      )

      if (isOpenable(r)) {
        openPanes.push(pane)
      } else {
        elements.push(pane)
      }
    }
  }

  // horizontal bars
  for (let r = 0; r <= rows; r++) {
    const py = y1 + r * (paneH + bar) + bar / 2
    const hbar = (
      <Voxel key={`h-${r}`}
        position={flip ? [z, py, cx] : [cx, py, z]}
        size={flip ? [0.04, bar, w] : [w, bar, 0.04]}
        color={frameColor}
      />
    )
    if (openRows && r > openRows[0] && r < openRows[1]) {
      openPanes.push(hbar)
    } else {
      elements.push(hbar)
    }
  }

  // vertical bars
  for (let c = 0; c <= cols; c++) {
    const px = x1 + c * (paneW + bar) + bar / 2
    // Fixed vertical bars span full height; openable section bars are separate
    if (openRows) {
      // Fixed portion: above and below openable section
      const openY1 = y1 + openRows[0] * (paneH + bar)
      const openY2 = y1 + openRows[1] * (paneH + bar) + bar
      const belowH = openY1 - y1
      const aboveH = (y1 + h) - openY2
      if (belowH > 0.01) {
        elements.push(
          <Voxel key={`v-below-${c}`}
            position={flip ? [z, y1 + belowH / 2, px] : [px, y1 + belowH / 2, z]}
            size={flip ? [0.04, belowH, bar] : [bar, belowH, 0.04]}
            color={frameColor}
          />
        )
      }
      if (aboveH > 0.01) {
        elements.push(
          <Voxel key={`v-above-${c}`}
            position={flip ? [z, openY2 + aboveH / 2, px] : [px, openY2 + aboveH / 2, z]}
            size={flip ? [0.04, aboveH, bar] : [bar, aboveH, 0.04]}
            color={frameColor}
          />
        )
      }
      // Openable section vertical bars
      const openSectionH = openY2 - openY1
      openPanes.push(
        <Voxel key={`v-open-${c}`}
          position={flip ? [z, openY1 + openSectionH / 2, px] : [px, openY1 + openSectionH / 2, z]}
          size={flip ? [0.04, openSectionH, bar] : [bar, openSectionH, 0.04]}
          color={frameColor}
        />
      )
    } else {
      elements.push(
        <Voxel key={`v-${c}`}
          position={flip ? [z, cy, px] : [px, cy, z]}
          size={flip ? [0.04, h, bar] : [bar, h, 0.04]}
          color={frameColor}
        />
      )
    }
  }

  // Thicker frame bar around the openable section edge
  if (openRows) {
    const openY1 = y1 + openRows[0] * (paneH + bar)
    const openY2 = y1 + openRows[1] * (paneH + bar) + bar
    // Bottom edge of openable section (thicker frame)
    elements.push(
      <Voxel key="open-frame-bottom"
        position={flip ? [z, openY1, cx] : [cx, openY1, z]}
        size={flip ? [0.045, 0.035, w] : [w, 0.035, 0.045]}
        color={frameColor}
      />
    )
    // Top edge (pivot line)
    elements.push(
      <Voxel key="open-frame-top"
        position={flip ? [z, openY2, cx] : [cx, openY2, z]}
        size={flip ? [0.045, 0.035, w] : [w, 0.035, 0.045]}
        color={frameColor}
      />
    )
  }

  // Render openable section as a rotated group (pivots at top edge)
  if (openRows && openAngle > 0 && openPanes.length > 0) {
    const pivotY = y1 + openRows[1] * (paneH + bar) + bar

    return (
      <>
        {elements}
        <group
          position={flip ? [z, pivotY, cx] : [cx, pivotY, z]}
          rotation={flip ? [0, 0, 0] : [openAngle * openDir, 0, 0]}
        >
          <group position={flip ? [-(z), -(pivotY), -(cx)] : [-(cx), -(pivotY), -(z)]}>
            {openPanes}
          </group>
        </group>
      </>
    )
  }

  return <>{elements}{openPanes}</>
})

export const LeftWallWindow = React.memo(function LeftWallWindow({ z1, z2, y1, y2, cols, rows }: {
  z1: number; z2: number; y1: number; y2: number; cols: number; rows: number
}) {
  const w = z2 - z1
  const h = y2 - y1
  const cz = (z1 + z2) / 2
  const cy = (y1 + y2) / 2
  const bar = 0.025
  const frameColor = '#1a1a1a'
  const glassColor = '#b8d0d8'
  const paneW = (w - bar * (cols + 1)) / cols
  const paneH = (h - bar * (rows + 1)) / rows
  const elements: React.ReactNode[] = []
  const xPos = -5.93

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const pz = z1 + bar + c * (paneW + bar) + paneW / 2
      const py = y1 + bar + r * (paneH + bar) + paneH / 2
      elements.push(<Voxel key={`p-${c}-${r}`} position={[xPos, py, pz]} size={[0.03, paneH, paneW]} color={glassColor} castShadow={false} transparent opacity={0.35} />)
    }
  }
  for (let r = 0; r <= rows; r++) {
    const py = y1 + r * (paneH + bar) + bar / 2
    elements.push(<Voxel key={`h-${r}`} position={[xPos, py, cz]} size={[0.04, bar, w]} color={frameColor} />)
  }
  for (let c = 0; c <= cols; c++) {
    const pz = z1 + c * (paneW + bar) + bar / 2
    elements.push(<Voxel key={`v-${c}`} position={[xPos, cy, pz]} size={[0.04, h, bar]} color={frameColor} />)
  }
  return <>{elements}</>
})

/* ── Window winder mechanism ── */
function WindowWinder({ position, wallDir }: {
  position: [number, number, number]
  wallDir: 'x' | 'z'
}) {
  const [wx, wy, wz] = position
  const metal = '#4a4a4a'
  const brass = '#a08840'

  if (wallDir === 'z') {
    // Winder on an XY wall (back/right) — gear housing + handle face camera
    return (
      <>
        {/* Wall bracket */}
        <Voxel position={[wx, wy, wz]} size={[0.06, 0.06, 0.04]} color={metal} />
        {/* Gear housing */}
        <Voxel position={[wx, wy, wz + 0.03]} size={[0.04, 0.04, 0.03]} color={brass} />
        {/* Crank handle */}
        <Voxel position={[wx + 0.05, wy, wz + 0.04]} size={[0.06, 0.015, 0.015]} color={metal} />
        <Voxel position={[wx + 0.08, wy, wz + 0.04]} size={[0.015, 0.03, 0.015]} color={brass} />
        {/* Vertical rod up to window */}
        <Voxel position={[wx, wy + 0.25, wz]} size={[0.015, 0.45, 0.015]} color={metal} />
      </>
    )
  }
  // Winder on a ZY wall (left) — gear housing + handle face +x
  return (
    <>
      <Voxel position={[wx, wy, wz]} size={[0.04, 0.06, 0.06]} color={metal} />
      <Voxel position={[wx + 0.03, wy, wz]} size={[0.03, 0.04, 0.04]} color={brass} />
      <Voxel position={[wx + 0.04, wy, wz + 0.05]} size={[0.015, 0.015, 0.06]} color={metal} />
      <Voxel position={[wx + 0.04, wy, wz + 0.08]} size={[0.015, 0.03, 0.015]} color={brass} />
      <Voxel position={[wx, wy + 0.25, wz]} size={[0.015, 0.45, 0.015]} color={metal} />
    </>
  )
}

export function Windows() {
  return (
    <>
      {/* Back wall (z = -5.93) -- left window closed (collides with mezzanine), right has openable section */}
      <CrittallWindowRect x1={4.5 - 6} y1={1} x2={7.5 - 6} y2={4} z={-5.93} cols={7} rows={7} />
      <CrittallWindowRect x1={8.5 - 6} y1={1} x2={11 - 6} y2={4} z={-5.93}
        cols={6} rows={7} openRows={[2, 5]} openAngle={0.25} openDir={-1} />
      {/* Winder for back-right window */}
      <WindowWinder position={[2.3, 1.3, -5.88]} wallDir="z" />

      {/* Left wall window (x = -5.93) -- two openable sections, one slightly open */}
      <CrittallWindowRect x1={-2.0} y1={1} x2={0.5} y2={4} z={-5.93} flip
        cols={6} rows={7} openRows={[2, 5]} openAngle={0.15} openDir={-1} />
      <CrittallWindowRect x1={0.5} y1={1} x2={3.0} y2={4} z={-5.93} flip
        cols={6} rows={7} openRows={[2, 5]} openAngle={0} openDir={-1} />
      {/* Winders on wall beside each section */}
      <WindowWinder position={[-5.88, 1.3, -2.2]} wallDir="x" />
      <WindowWinder position={[-5.88, 1.3, 3.2]} wallDir="x" />

      {/* Right wall (z = 5.93) -- right window has openable section */}
      <CrittallWindowRect x1={1 - 6} y1={1} x2={5 - 6} y2={4} z={5.93} cols={10} rows={7} />
      <CrittallWindowRect x1={7 - 6} y1={1} x2={11 - 6} y2={4} z={5.93}
        cols={10} rows={7} openRows={[3, 6]} openAngle={0.2} openDir={1} />
      {/* Winder for right-side window */}
      <WindowWinder position={[0.8, 1.3, 5.88]} wallDir="z" />
    </>
  )
}

/* ── Red I-Beam support columns with weathering ── */

// Seeded hash for deterministic rust placement
function beamHash(a: number, b: number) {
  let h = (a * 374761 + b * 668265) | 0
  h = ((h >> 16) ^ h) * 0x45d9f3b | 0
  return (((h >> 16) ^ h) >>> 0) % 1000
}

const IBeam = React.memo(function IBeam({ x, z, idx }: { x: number; z: number; idx: number }) {
  const beamH = 5.0
  const cy = beamH / 2
  // Base red with per-beam variation
  const rv = (beamHash(idx, 0) / 1000 - 0.5) * 0.03
  const red = `rgb(${Math.round(160 + rv * 255)}, ${Math.round(48 + rv * 100)}, ${Math.round(40 + rv * 80)})`
  const redDark = '#802018'
  const redLight = '#b84038'
  const concrete = '#909090'
  const concreteDark = '#787878'

  // Rust colors
  const rustColors = ['#b87333', '#a0522d', '#8b4513', '#9a6030']
  const rustBase = rustColors[idx % rustColors.length]
  const rustLight = '#c08040'

  // Paint wear: lighter undercoat showing through
  const paintWear = '#c04840'

  return (
    <>
      {/* Concrete base -- two-tier plinth */}
      <Voxel position={[x, 0.0, z]}      size={[0.8, 0.1, 0.8]}  color={concrete} />
      <Voxel position={[x, 0.07, z]}     size={[0.7, 0.04, 0.7]} color={concreteDark} />
      {/* Steel base plate -- darkened with rust staining */}
      <Voxel position={[x, 0.11, z]}     size={[0.55, 0.04, 0.55]} color="#6a2818" />
      {/* Bolt heads with rust halos */}
      <Voxel position={[x - 0.18, 0.14, z - 0.18]} size={[0.04, 0.02, 0.04]} color="#1a1a1a" />
      <Voxel position={[x + 0.18, 0.14, z - 0.18]} size={[0.04, 0.02, 0.04]} color="#1a1a1a" />
      <Voxel position={[x - 0.18, 0.14, z + 0.18]} size={[0.04, 0.02, 0.04]} color="#1a1a1a" />
      <Voxel position={[x + 0.18, 0.14, z + 0.18]} size={[0.04, 0.02, 0.04]} color="#1a1a1a" />
      {/* Rust staining around bolts */}
      <Voxel position={[x - 0.18, 0.135, z - 0.18]} size={[0.07, 0.01, 0.07]} color={rustBase} />
      <Voxel position={[x + 0.18, 0.135, z + 0.18]} size={[0.06, 0.01, 0.06]} color={rustBase} />

      {/* I-beam bottom flange -- rust at base where moisture collects */}
      <Voxel position={[x, 0.17, z]}     size={[0.45, 0.08, 0.35]} color={red} />
      <Voxel position={[x - 0.15, 0.145, z]} size={[0.12, 0.02, 0.2]} color={rustBase} />
      {/* Bottom fillet */}
      <Voxel position={[x, 0.23, z]}     size={[0.2, 0.04, 0.35]}  color={redDark} />

      {/* I-beam web */}
      <Voxel position={[x, cy + 0.075, z]} size={[0.1, beamH - 0.35, 0.35]} color={red} />

      {/* Paint wear patches on web -- lighter undercoat visible */}
      <Voxel position={[x, 1.0 + idx * 0.3, z - 0.14]} size={[0.06, 0.15, 0.02]} color={paintWear} />
      <Voxel position={[x, 2.8 - idx * 0.2, z + 0.13]} size={[0.05, 0.1, 0.02]} color={paintWear} />

      {/* Rust patches on web */}
      <Voxel position={[x, 0.5 + idx * 0.15, z + 0.15]} size={[0.04, 0.08, 0.02]} color={rustLight} />
      <Voxel position={[x, 4.0 - idx * 0.1, z - 0.13]} size={[0.03, 0.06, 0.02]} color={rustBase} />

      {/* I-beam top flange */}
      <Voxel position={[x, beamH - 0.06, z]} size={[0.45, 0.08, 0.35]} color={red} />
      {/* Top fillet */}
      <Voxel position={[x, beamH - 0.12, z]} size={[0.2, 0.04, 0.35]}  color={redDark} />

      {/* Top cap plate */}
      <Voxel position={[x, beamH + 0.0, z]}  size={[0.5, 0.04, 0.4]}   color={redDark} />

      {/* Rivet lines on web */}
      <Voxel position={[x, 1.5, z - 0.16]}  size={[0.12, 0.03, 0.03]} color={redLight} />
      <Voxel position={[x, 3.5, z - 0.16]}  size={[0.12, 0.03, 0.03]} color={redLight} />
      <Voxel position={[x, 1.5, z + 0.16]}  size={[0.12, 0.03, 0.03]} color={redLight} />
      <Voxel position={[x, 3.5, z + 0.16]}  size={[0.12, 0.03, 0.03]} color={redLight} />
      {/* Rust streaks below rivets */}
      <Voxel position={[x, 1.35, z - 0.16]} size={[0.03, 0.1, 0.02]} color={rustLight} />
      <Voxel position={[x, 3.35, z + 0.16]} size={[0.02, 0.08, 0.02]} color={rustLight} />
    </>
  )
})

export const SupportBeams = React.memo(function SupportBeams() {
  return (
    <>
      <IBeam x={-2.0} z={-1.5} idx={0} />
      <IBeam x={-2.0} z={2.5} idx={1} />
      <IBeam x={4.0} z={-1.5} idx={2} />
      <IBeam x={4.0} z={2.5} idx={3} />
    </>
  )
})

/* ── Metal staircase + mezzanine platform ── */

export const Mezzanine = React.memo(function Mezzanine() {
  const metal = '#3a3a3a'
  const metalLight = '#4a4a4a'
  const metalDark = '#2a2a2a'
  const grate = '#484848'
  const platY = 2.5

  // Expanded platform for boss office + meeting area
  const pCenterX = -3.215
  const pCenterZ = -4.115
  const pWidth = 5.43
  const pDepth = 3.63

  // Stair config — stairs descend from right edge going +x
  const stepCount = 12
  const stepH = platY / stepCount
  const stepD = 0.32
  const stairW = 1.0
  const startX = pCenterX + pWidth / 2 + 0.15
  const stairZ = -5.2
  const totalRun = stepCount * stepD

  // Where stairs meet platform (right edge of platform)
  const stairJoinX = pCenterX + pWidth / 2

  // Railing post positions along front edge
  const frontPostOffsets = [-2.0, -1.0, 0.0, 1.0, 2.0]

  return (
    <>
      {/* ── Platform deck ── */}
      <Voxel position={[pCenterX, platY, pCenterZ]} size={[pWidth, 0.08, pDepth]} color={grate} />

      {/* Edge beams */}
      <Voxel position={[pCenterX, platY - 0.06, pCenterZ + pDepth / 2]} size={[pWidth, 0.08, 0.08]} color={metal} />
      <Voxel position={[pCenterX - pWidth / 2, platY - 0.06, pCenterZ]} size={[0.08, 0.08, pDepth]} color={metal} />
      <Voxel position={[pCenterX + pWidth / 2, platY - 0.06, pCenterZ]} size={[0.08, 0.08, pDepth]} color={metal} />
      {/* Mid-span beam for wider platform */}
      <Voxel position={[pCenterX, platY - 0.06, pCenterZ]} size={[0.06, 0.08, pDepth]} color={metalDark} />

      {/* Support columns — 4 columns for the larger platform */}
      <Voxel position={[pCenterX - 1.5, platY / 2, pCenterZ + pDepth / 2 - 0.1]} size={[0.1, platY, 0.1]} color={metal} />
      <Voxel position={[pCenterX + 1.5, platY / 2, pCenterZ + pDepth / 2 - 0.1]} size={[0.1, platY, 0.1]} color={metal} />
      {/* Additional front-centre column for the extended depth */}
      <Voxel position={[pCenterX, platY / 2, pCenterZ + pDepth / 2 - 0.1]} size={[0.1, platY, 0.1]} color={metal} />

      {/* Cross bracing under platform for structural look */}
      <Voxel position={[pCenterX, platY - 0.15, pCenterZ + pDepth / 4]} size={[pWidth - 0.5, 0.04, 0.04]} color={metalDark} />

      {/* ── Railing: front edge (overlooks the warehouse) ── */}
      {frontPostOffsets.map((dx, i) => (
        <Voxel key={`rp-front-${i}`}
          position={[pCenterX + dx, platY + 0.5, pCenterZ + pDepth / 2 + 0.04]}
          size={[0.04, 1.0, 0.04]} color={metal}
        />
      ))}
      <Voxel position={[pCenterX, platY + 0.95, pCenterZ + pDepth / 2 + 0.04]}
        size={[pWidth + 0.1, 0.05, 0.05]} color={metal} />
      <Voxel position={[pCenterX, platY + 0.5, pCenterZ + pDepth / 2 + 0.04]}
        size={[pWidth + 0.1, 0.04, 0.04]} color={metalLight} />

      {/* Right edge railing: front portion only (leave back open for stairs) */}
      {/* Stair opening is at z ~ -5.2 ± 0.5, so railing runs from front edge to stair gap */}
      {(() => {
        const rightX = stairJoinX + 0.04
        const frontZ = pCenterZ + pDepth / 2
        const stairGapZ = stairZ + stairW / 2  // z = -4.7
        const railLen = frontZ - stairGapZ
        const railMidZ = (frontZ + stairGapZ) / 2
        return (
          <>
            {/* Posts */}
            <Voxel position={[rightX, platY + 0.5, frontZ - 0.3]}
              size={[0.04, 1.0, 0.04]} color={metal} />
            <Voxel position={[rightX, platY + 0.5, stairGapZ + 0.1]}
              size={[0.04, 1.0, 0.04]} color={metal} />
            {/* Top rail */}
            <Voxel position={[rightX, platY + 0.95, railMidZ]}
              size={[0.05, 0.05, railLen + 0.1]} color={metal} />
            {/* Mid rail */}
            <Voxel position={[rightX, platY + 0.5, railMidZ]}
              size={[0.04, 0.04, railLen + 0.1]} color={metalLight} />
          </>
        )
      })()}

      {/* ── Staircase: descending from platform right edge, going +x ── */}
      {(() => {
        const steps: React.ReactNode[] = []

        for (let i = 0; i < stepCount; i++) {
          const sy = (stepCount - 1 - i) * stepH + stepH / 2
          const sx = startX + i * stepD
          steps.push(
            <Voxel key={`tread-${i}`}
              position={[sx + stepD / 2, sy, stairZ]}
              size={[stepD, 0.04, stairW]}
              color={grate}
            />
          )
        }

        // Stringer + handrail angle
        const angle = -Math.atan2(platY, totalRun) // negative because descending in +x
        const diagLen = Math.sqrt(totalRun * totalRun + platY * platY)
        const midX = startX + totalRun / 2
        const midY = platY / 2
        const railZ = stairZ + stairW / 2 + 0.06

        // Back stringer (single angled bar)
        steps.push(
          <group key="str-back" position={[midX, midY, stairZ - stairW / 2 - 0.03]} rotation={[0, 0, angle]}>
            <mesh castShadow receiveShadow><boxGeometry args={[diagLen, 0.08, 0.04]} /><meshLambertMaterial color={metal} /></mesh>
          </group>
        )
        // Front stringer
        steps.push(
          <group key="str-front" position={[midX, midY, stairZ + stairW / 2 + 0.03]} rotation={[0, 0, angle]}>
            <mesh castShadow receiveShadow><boxGeometry args={[diagLen, 0.08, 0.04]} /><meshLambertMaterial color={metal} /></mesh>
          </group>
        )

        // Handrail posts on front side
        for (let i = 0; i <= stepCount; i += 3) {
          const py = (stepCount - i) * stepH
          const px = startX + i * stepD
          steps.push(
            <Voxel key={`hrp-${i}`}
              position={[px, py + 0.5, railZ]}
              size={[0.04, 1.0, 0.04]}
              color={metal}
            />
          )
        }

        // Handrail top bar (single angled bar)
        steps.push(
          <group key="hr-top" position={[midX, midY + 0.95, railZ]} rotation={[0, 0, angle]}>
            <mesh castShadow receiveShadow><boxGeometry args={[diagLen + 0.1, 0.05, 0.05]} /><meshLambertMaterial color={metal} /></mesh>
          </group>
        )
        // Handrail mid bar (single angled bar)
        steps.push(
          <group key="hr-mid" position={[midX, midY + 0.5, railZ]} rotation={[0, 0, angle]}>
            <mesh castShadow receiveShadow><boxGeometry args={[diagLen + 0.1, 0.04, 0.04]} /><meshLambertMaterial color={metalLight} /></mesh>
          </group>
        )

        return steps
      })()}
    </>
  )
})
