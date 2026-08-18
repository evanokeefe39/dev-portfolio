import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { Voxel } from '../../Voxel'
import { FiddleLeafFig } from '../../FiddleLeafFig'

const DESK_POSITIONS = [
  { cx: 1.0, cz: -1.5 },
  { cx: 1.0, cz: 2.5 },
] as const

const DESK_W = 4.4
const DESK_D = 1.2

const LAPTOP_COLORS = ['#4488cc', '#44aa88', '#6688cc', '#44aacc', '#5588bb', '#4488aa', '#5599cc', '#4499bb',
                       '#4488cc', '#44aa88', '#6688cc', '#44aacc', '#5588bb', '#4488aa', '#5599cc', '#4499bb']
const CUP_COLORS = ['#e04040', '#3090d0', '#40b060', '#d08030', '#c05080', '#2080c0', '#d0a020', '#60a0a0',
                   '#e04040', '#3090d0', '#40b060', '#d08030', '#c05080', '#2080c0', '#d0a020', '#60a0a0']
const WORKSTATION_INDICES = [0, 1, 2, 3, 4, 5, 6, 7] as const

/* ── HotDesks / DeskChairs ──
   Instance matrices are computed at module level from the same constants and
   formulas as the original per-<Voxel> loops. Each box size is baked into a
   shared geometry and every instance is a translation-only matrix (scale 1,
   no rotation), so world layouts stay arithmetically identical. */

const DESK_TOP_MATRICES: THREE.Matrix4[] = []
const DESK_LEG_MATRICES: THREE.Matrix4[] = []
const LAPTOP_BASE_MATRICES: THREE.Matrix4[] = []
const MONITOR_MATRICES: THREE.Matrix4[] = []
const SCREEN_MATRICES: THREE.Matrix4[] = []
const SCREEN_INSTANCE_COLORS: THREE.Color[] = []
const CUP_MATRICES: THREE.Matrix4[] = []
const CUP_INSTANCE_COLORS: THREE.Color[] = []
const CHAIR_LEG_MATRICES: THREE.Matrix4[] = []
const CHAIR_SEAT_MATRICES: THREE.Matrix4[] = []

function translationMatrix(x: number, y: number, z: number): THREE.Matrix4 {
  return new THREE.Matrix4().makeTranslation(x, y, z)
}

DESK_POSITIONS.forEach((desk, di) => {
  DESK_TOP_MATRICES.push(translationMatrix(desk.cx, 0.65, desk.cz))

  for (const lx of [-DESK_W / 2 + 0.15, DESK_W / 2 - 0.15]) {
    for (const lz of [-DESK_D / 2 + 0.1, DESK_D / 2 - 0.1]) {
      DESK_LEG_MATRICES.push(translationMatrix(desk.cx + lx, 0.32, desk.cz + lz))
    }
  }

  WORKSTATION_INDICES.forEach((wi) => {
    const side = wi < 4 ? -1 : 1
    const col = wi % 4
    const dx = desk.cx - 1.5 + col * 1.0
    const dz = desk.cz + side * 0.35
    const idx = di * 8 + wi
    const facing = -side

    LAPTOP_BASE_MATRICES.push(translationMatrix(dx, 0.71, dz))
    MONITOR_MATRICES.push(translationMatrix(dx, 0.82, dz + facing * 0.14))
    SCREEN_MATRICES.push(translationMatrix(dx, 0.82, dz + facing * 0.13))
    SCREEN_INSTANCE_COLORS.push(new THREE.Color(LAPTOP_COLORS[idx % LAPTOP_COLORS.length]))
    CUP_MATRICES.push(translationMatrix(dx + 0.28, 0.72, dz - facing * 0.1))
    CUP_INSTANCE_COLORS.push(new THREE.Color(CUP_COLORS[idx % CUP_COLORS.length]))
  })
})

DESK_POSITIONS.forEach((desk) => {
  WORKSTATION_INDICES.forEach((wi) => {
    const side = wi < 4 ? -1 : 1
    const col = wi % 4
    const dx = desk.cx - 1.5 + col * 1.0
    const dz = desk.cz + side * 0.85

    CHAIR_LEG_MATRICES.push(translationMatrix(dx - 0.12, 0.2, dz - 0.12))
    CHAIR_LEG_MATRICES.push(translationMatrix(dx + 0.12, 0.2, dz - 0.12))
    CHAIR_LEG_MATRICES.push(translationMatrix(dx - 0.12, 0.2, dz + 0.12))
    CHAIR_LEG_MATRICES.push(translationMatrix(dx + 0.12, 0.2, dz + 0.12))
    CHAIR_SEAT_MATRICES.push(translationMatrix(dx, 0.42, dz))
  })
})

/* ── Shared geometry & materials (one BoxGeometry + MeshLambertMaterial per group) ── */

const DESK_TOP_GEO = new THREE.BoxGeometry(DESK_W, 0.06, DESK_D)
const DESK_TOP_MAT = new THREE.MeshLambertMaterial({ color: '#d4c4a0' })
const DESK_LEG_GEO = new THREE.BoxGeometry(0.06, 0.62, 0.06)
const DESK_LEG_MAT = new THREE.MeshLambertMaterial({ color: '#4a4a4a' })
const LAPTOP_BASE_GEO = new THREE.BoxGeometry(0.4, 0.02, 0.3)
const LAPTOP_BASE_MAT = new THREE.MeshLambertMaterial({ color: '#2a2a2a' })
const MONITOR_GEO = new THREE.BoxGeometry(0.38, 0.22, 0.02)
const MONITOR_MAT = new THREE.MeshLambertMaterial({ color: '#3a3a3a' })
const SCREEN_GEO = new THREE.BoxGeometry(0.32, 0.17, 0.01)
const SCREEN_MAT = new THREE.MeshLambertMaterial({ color: '#ffffff' })
const CUP_GEO = new THREE.BoxGeometry(0.06, 0.08, 0.06)
const CUP_MAT = new THREE.MeshLambertMaterial({ color: '#ffffff' })
const CHAIR_LEG_GEO = new THREE.BoxGeometry(0.04, 0.4, 0.04)
const CHAIR_LEG_MAT = new THREE.MeshLambertMaterial({ color: '#6a4428' })
const CHAIR_SEAT_GEO = new THREE.BoxGeometry(0.32, 0.04, 0.32)
const CHAIR_SEAT_MAT = new THREE.MeshLambertMaterial({ color: '#d4c4a0' })

/* ── Instanced layer: mirrors the WallLayer pattern (useEffect + setMatrixAt) ── */

function InstancedFurniture({
  matrices,
  colors,
  geometry,
  material,
}: {
  matrices: THREE.Matrix4[]
  colors?: THREE.Color[]
  geometry: THREE.BoxGeometry
  material: THREE.MeshLambertMaterial
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null)

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    for (let i = 0; i < matrices.length; i++) {
      mesh.setMatrixAt(i, matrices[i])
      if (colors) mesh.setColorAt(i, colors[i])
    }
    mesh.instanceMatrix.needsUpdate = true
    const instanceColor = mesh.instanceColor
    if (instanceColor) instanceColor.needsUpdate = true
  }, [matrices, colors])

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, matrices.length]}
      castShadow
      receiveShadow
      frustumCulled={false}
    />
  )
}

export const HotDesks = React.memo(function HotDesks() {
  return (
    <>
      <InstancedFurniture matrices={DESK_TOP_MATRICES} geometry={DESK_TOP_GEO} material={DESK_TOP_MAT} />
      <InstancedFurniture matrices={DESK_LEG_MATRICES} geometry={DESK_LEG_GEO} material={DESK_LEG_MAT} />
      <InstancedFurniture matrices={LAPTOP_BASE_MATRICES} geometry={LAPTOP_BASE_GEO} material={LAPTOP_BASE_MAT} />
      <InstancedFurniture matrices={MONITOR_MATRICES} geometry={MONITOR_GEO} material={MONITOR_MAT} />
      <InstancedFurniture matrices={SCREEN_MATRICES} colors={SCREEN_INSTANCE_COLORS} geometry={SCREEN_GEO} material={SCREEN_MAT} />
      <InstancedFurniture matrices={CUP_MATRICES} colors={CUP_INSTANCE_COLORS} geometry={CUP_GEO} material={CUP_MAT} />
    </>
  )
})

export const DeskChairs = React.memo(function DeskChairs() {
  return (
    <>
      <InstancedFurniture matrices={CHAIR_LEG_MATRICES} geometry={CHAIR_LEG_GEO} material={CHAIR_LEG_MAT} />
      <InstancedFurniture matrices={CHAIR_SEAT_MATRICES} geometry={CHAIR_SEAT_GEO} material={CHAIR_SEAT_MAT} />
    </>
  )
})

// Shared speaker driver geometries
const WOOFER_GEO = new THREE.CylinderGeometry(0.18, 0.18, 0.015, 32)
const WOOFER_CONE_GEO = new THREE.CylinderGeometry(0.14, 0.14, 0.01, 32)
const WOOFER_CAP_GEO = new THREE.CylinderGeometry(0.05, 0.05, 0.008, 16)
const MID_GEO = new THREE.CylinderGeometry(0.07, 0.07, 0.015, 24)
const MID_CONE_GEO = new THREE.CylinderGeometry(0.04, 0.04, 0.01, 24)
const MID_CAP_GEO = new THREE.CylinderGeometry(0.015, 0.015, 0.005, 16)
const TWEET_GEO = new THREE.CylinderGeometry(0.025, 0.025, 0.015, 16)
const TWEET_DOME_GEO = new THREE.SphereGeometry(0.012, 16, 16)
const DRIVER_BLACK = new THREE.MeshLambertMaterial({ color: '#1a1a1a' })
const DRIVER_DARK = new THREE.MeshLambertMaterial({ color: '#2a2a2a' })
const DRIVER_MID = new THREE.MeshLambertMaterial({ color: '#3a3a3a' })
const SPEAKER_ROT: [number, number, number] = [0, 0, Math.PI / 2]

const SpeakerCabinet = React.memo(function SpeakerCabinet({ z, midZ, tweetZ }: { z: number; midZ: number; tweetZ: number }) {
  return (
    <>
      <Voxel position={[-5.55, 0.455, z]} size={[0.55, 0.83, 0.5]} color="#6a4428" />
      <Voxel position={[-5.55, 0.885, z]} size={[0.58, 0.03, 0.53]} color="#5a3a20" />
      <Voxel position={[-5.55, 0.02, z]} size={[0.58, 0.04, 0.53]} color="#4a3018" />
      <Voxel position={[-5.26, 0.455, z]} size={[0.02, 0.77, 0.44]} color="#3a6a8a" />
      {/* Bass woofer */}
      <mesh position={[-5.24, 0.28, z]} rotation={SPEAKER_ROT} geometry={WOOFER_GEO} material={DRIVER_BLACK} />
      <mesh position={[-5.23, 0.28, z]} rotation={SPEAKER_ROT} geometry={WOOFER_CONE_GEO} material={DRIVER_DARK} />
      <mesh position={[-5.22, 0.28, z]} rotation={SPEAKER_ROT} geometry={WOOFER_CAP_GEO} material={DRIVER_MID} />
      {/* Midrange */}
      <mesh position={[-5.24, 0.64, midZ]} rotation={SPEAKER_ROT} geometry={MID_GEO} material={DRIVER_BLACK} />
      <mesh position={[-5.23, 0.64, midZ]} rotation={SPEAKER_ROT} geometry={MID_CONE_GEO} material={DRIVER_DARK} />
      <mesh position={[-5.22, 0.64, midZ]} rotation={SPEAKER_ROT} geometry={MID_CAP_GEO} material={DRIVER_MID} />
      {/* Tweeter */}
      <mesh position={[-5.24, 0.64, tweetZ]} rotation={SPEAKER_ROT} geometry={TWEET_GEO} material={DRIVER_BLACK} />
      <mesh position={[-5.23, 0.64, tweetZ]} rotation={SPEAKER_ROT} geometry={TWEET_DOME_GEO} material={DRIVER_DARK} />
    </>
  )
})

export const LoungeArea = React.memo(function LoungeArea() {
  const green = '#2a4a30'
  const greenLight = '#3a5a40'
  const cream = '#d4c8a8'
  const wood = '#6a4428'
  // Corner: left wall x=-5.95, right wall z=+5.95

  return (
    <>
      {/* ── Rug ── */}
      <Voxel position={[-4.5, 0.01, 4.5]} size={[2.6, 0.02, 2.6]} color="#6a4030" />
      <Voxel position={[-4.5, 0.015, 4.5]} size={[2.2, 0.02, 2.2]} color="#4a2818" />
      <Voxel position={[-4.5, 0.018, 4.5]} size={[1.8, 0.02, 1.8]} color="#5a3420" />
      <Voxel position={[-4.5, 0.012, 5.85]} size={[2.2, 0.01, 0.1]} color="#c8b890" />
      <Voxel position={[-4.5, 0.012, 3.15]} size={[2.2, 0.01, 0.1]} color="#c8b890" />

      {/* ── Fiddle Leaf Fig in the corner ── */}
      <FiddleLeafFig position={[-5.4, 0, 5.4]} maturity={0.9} scale={1.2} seed={42} />

      {/* ── Couch 1: against right wall (z=5.5) ── */}
      <Voxel position={[-4.2, 0.18, 5.45]} size={[2.0, 0.36, 0.7]} color={green} />
      <Voxel position={[-4.2, 0.45, 5.7]} size={[2.0, 0.3, 0.15]} color={green} />
      <Voxel position={[-3.15, 0.35, 5.45]} size={[0.15, 0.14, 0.65]} color={green} />
      <Voxel position={[-5.1, 0.35, 5.45]} size={[0.15, 0.14, 0.65]} color={green} />
      {/* thin cushions */}
      <Voxel position={[-4.6, 0.38, 5.35]} size={[0.6, 0.03, 0.5]} color={greenLight} />
      <Voxel position={[-3.8, 0.38, 5.35]} size={[0.6, 0.03, 0.5]} color={greenLight} />
      {/* thin pillows */}
      <Voxel position={[-4.9, 0.42, 5.55]} size={[0.22, 0.12, 0.08]} color={cream} />
      <Voxel position={[-3.4, 0.42, 5.55]} size={[0.22, 0.12, 0.08]} color="#c8a850" />

      {/* ── Couch 2: against left wall (x=-5.5) ── */}
      <Voxel position={[-5.45, 0.18, 4.0]} size={[0.7, 0.36, 2.0]} color={green} />
      <Voxel position={[-5.7, 0.45, 4.0]} size={[0.15, 0.3, 2.0]} color={green} />
      <Voxel position={[-5.45, 0.35, 4.95]} size={[0.65, 0.14, 0.15]} color={green} />
      <Voxel position={[-5.45, 0.35, 3.05]} size={[0.65, 0.14, 0.15]} color={green} />
      {/* thin cushions */}
      <Voxel position={[-5.35, 0.38, 4.4]} size={[0.5, 0.03, 0.6]} color={greenLight} />
      <Voxel position={[-5.35, 0.38, 3.6]} size={[0.5, 0.03, 0.6]} color={greenLight} />
      {/* thin pillows */}
      <Voxel position={[-5.45, 0.42, 4.7]} size={[0.08, 0.12, 0.22]} color="#8b4020" />
      <Voxel position={[-5.45, 0.42, 3.3]} size={[0.08, 0.12, 0.22]} color={cream} />

      {/* ── Floating shelves above couch 2 (left wall only) ── */}
      <Voxel position={[-5.88, 1.3, 4.0]} size={[0.2, 0.04, 1.8]} color={wood} />
      <Voxel position={[-5.88, 1.8, 4.0]} size={[0.2, 0.04, 1.4]} color={wood} />
      <Voxel position={[-5.85, 1.35, 4.5]} size={[0.08, 0.14, 0.12]} color="#6a4a2a" />
      <Voxel position={[-5.85, 1.35, 4.2]} size={[0.08, 0.12, 0.12]} color="#4a2a4a" />
      <Voxel position={[-5.84, 1.35, 3.6]} size={[0.08, 0.1, 0.08]} color="#a0683a" />
      <Voxel position={[-5.84, 1.42, 3.6]} size={[0.1, 0.04, 0.1]} color="#3a8025" />

      {/* ── Side table next to couch 1 arm (closest to camera, x=-3.15) ── */}
      <Voxel position={[-3.0, 0.25, 5.3]} size={[0.4, 0.04, 0.4]} color={wood} />
      <Voxel position={[-3.0, 0.12, 5.3]} size={[0.04, 0.24, 0.04]} color={wood} />
      {/* mug on side table */}
      <Voxel position={[-2.9, 0.29, 5.35]} size={[0.06, 0.08, 0.06]} color="#d4c8a0" />

      {/* ── Coffee table ── */}
      <Voxel position={[-4.5, 0.26, 4.2]} size={[0.9, 0.04, 0.6]} color="#5a3a20" />
      <Voxel position={[-4.85, 0.13, 4.42]} size={[0.04, 0.26, 0.04]} color="#2a2a2a" />
      <Voxel position={[-4.15, 0.13, 4.42]} size={[0.04, 0.26, 0.04]} color="#2a2a2a" />
      <Voxel position={[-4.85, 0.13, 3.98]} size={[0.04, 0.26, 0.04]} color="#2a2a2a" />
      <Voxel position={[-4.15, 0.13, 3.98]} size={[0.04, 0.26, 0.04]} color="#2a2a2a" />
      <Voxel position={[-4.7, 0.3, 4.25]} size={[0.2, 0.04, 0.15]} color="#8b2020" />
      <Voxel position={[-4.7, 0.34, 4.25]} size={[0.18, 0.03, 0.14]} color="#2a4a6a" />
      <Voxel position={[-4.3, 0.3, 4.1]} size={[0.06, 0.08, 0.06]} color={cream} />
      <Voxel position={[-4.3, 0.35, 4.1]} size={[0.02, 0.04, 0.02]} color="#ffa020" />

      {/* ── Floor lamp at end of couch 2 (low z end) ── */}
      <Voxel position={[-5.3, 0.04, 2.9]} size={[0.2, 0.08, 0.2]} color="#2a2a2a" />
      <Voxel position={[-5.3, 0.6, 2.9]} size={[0.04, 1.1, 0.04]} color="#c8a850" />
      <Voxel position={[-5.3, 1.2, 2.9]} size={[0.22, 0.18, 0.22]} color={cream} />
      <pointLight position={[-5.3, 1.1, 2.9]} intensity={0.8} color="#ffcc66" distance={4} decay={2} />

      {/* ── Open record shelving — 2 levels: ground, mid, top ── */}
      {/* Metal frame — vertical posts */}
      <Voxel position={[-5.75, 0.32, -0.25]} size={[0.04, 0.64, 0.04]} color="#3a3a3a" />
      <Voxel position={[-5.35, 0.32, -0.25]} size={[0.04, 0.64, 0.04]} color="#3a3a3a" />
      <Voxel position={[-5.75, 0.32, 1.25]} size={[0.04, 0.64, 0.04]} color="#3a3a3a" />
      <Voxel position={[-5.35, 0.32, 1.25]} size={[0.04, 0.64, 0.04]} color="#3a3a3a" />

      {/* Bottom shelf (ground) */}
      <Voxel position={[-5.55, 0.02, 0.5]} size={[0.44, 0.04, 1.54]} color="#6a4428" />
      {/* Mid shelf */}
      <Voxel position={[-5.55, 0.34, 0.5]} size={[0.44, 0.04, 1.54]} color="#6a4428" />
      {/* Top shelf */}
      <Voxel position={[-5.55, 0.66, 0.5]} size={[0.44, 0.04, 1.54]} color="#6a4428" />

      {/* ── Bottom level: records ── */}
      {[
        { dz: -0.15, color: '#1a1a3a' }, { dz: -0.02, color: '#e8e0d0' },
        { dz: 0.11, color: '#d08030' }, { dz: 0.24, color: '#3a1a1a' },
        { dz: 0.37, color: '#2a3a2a' }, { dz: 0.50, color: '#8a3020' },
        { dz: 0.63, color: '#1a3a1a' }, { dz: 0.76, color: '#e0d0b0' },
        { dz: 0.89, color: '#4a2a4a' }, { dz: 1.02, color: '#1a1a3a' },
      ].map(({ dz, color }, i) => (
        <Voxel key={`rec-b-${i}`} position={[-5.55, 0.18, dz]} size={[0.3, 0.28, 0.1]} color={color} />
      ))}

      {/* ── Mid level: records ── */}
      {[
        { dz: -0.15, color: '#d04040' }, { dz: -0.02, color: '#2a2a4a' },
        { dz: 0.11, color: '#e8d8c0' }, { dz: 0.24, color: '#1a4a3a' },
        { dz: 0.37, color: '#c8a040' }, { dz: 0.50, color: '#3a2a1a' },
        { dz: 0.63, color: '#e0e0e0' }, { dz: 0.76, color: '#2a1a3a' },
        { dz: 0.89, color: '#d08840' }, { dz: 1.02, color: '#1a3a5a' },
      ].map(({ dz, color }, i) => (
        <Voxel key={`rec-m-${i}`} position={[-5.55, 0.5, dz]} size={[0.3, 0.28, 0.1]} color={color} />
      ))}

      {/* ── Top shelf: turntable + amp ── */}
      {/* Turntable — brushed steel */}
      <Voxel position={[-5.55, 0.71, 0.1]} size={[0.4, 0.04, 0.5]} color="#b0b0b0" />
      <Voxel position={[-5.55, 0.74, 0.04]} size={[0.3, 0.015, 0.3]} color="#a0a0a0" />
      <Voxel position={[-5.55, 0.75, 0.04]} size={[0.26, 0.005, 0.26]} color="#2a2a2a" />
      <Voxel position={[-5.55, 0.76, 0.04]} size={[0.04, 0.01, 0.04]} color="#c0c0c0" />
      {/* Tonearm */}
      <Voxel position={[-5.4, 0.74, 0.28]} size={[0.05, 0.03, 0.05]} color="#909090" />
      <Voxel position={[-5.46, 0.76, 0.16]} size={[0.02, 0.015, 0.18]} color="#c8c8c8" />
      <Voxel position={[-5.46, 0.76, 0.06]} size={[0.03, 0.01, 0.04]} color="#a0a0a0" />

      {/* Amplifier — brushed steel */}
      <Voxel position={[-5.55, 0.71, 0.7]} size={[0.38, 0.08, 0.2]} color="#a8a8a8" />
      <Voxel position={[-5.34, 0.71, 0.7]} size={[0.02, 0.08, 0.2]} color="#b8b8b8" />
      <Voxel position={[-5.33, 0.72, 0.64]} size={[0.01, 0.03, 0.03]} color="#2a2a2a" />
      <Voxel position={[-5.33, 0.72, 0.7]} size={[0.01, 0.03, 0.03]} color="#2a2a2a" />
      <Voxel position={[-5.33, 0.72, 0.76]} size={[0.01, 0.03, 0.03]} color="#2a2a2a" />
      <Voxel position={[-5.33, 0.74, 0.62]} size={[0.005, 0.01, 0.01]} color="#40ff40" />
      <Voxel position={[-5.33, 0.74, 0.7]} size={[0.005, 0.015, 0.08]} color="#1a1a1a" />
      <Voxel position={[-5.325, 0.74, 0.69]} size={[0.002, 0.01, 0.04]} color="#40a0ff" />

      {/* A couple records leaning on top */}
      <Voxel position={[-5.55, 0.74, 1.05]} size={[0.3, 0.26, 0.08]} color="#c8a040" />
      <Voxel position={[-5.55, 0.74, 1.15]} size={[0.3, 0.24, 0.08]} color="#1a1a3a" />

      {/* Speakers */}
      <SpeakerCabinet z={-0.65} midZ={-0.75} tweetZ={-0.54} />
      <SpeakerCabinet z={1.65} midZ={1.55} tweetZ={1.76} />
    </>
  )
})

/* ── Storage cabinets along back wall ── */

function StorageCabinet({ x, z, color, height, faceZ }: { x: number; z: number; color: string; height: number; faceZ: number }) {
  const dark = '#2a2a2a'
  const cy = height / 2
  const cabinetW = 0.7
  const cabinetD = 0.5
  const doorOff = faceZ * (cabinetD / 2 + 0.005)
  const handleOff = faceZ * (cabinetD / 2 + 0.015)

  return (
    <>
      {/* Main body */}
      <Voxel position={[x, cy, z]} size={[cabinetW, height, cabinetD]} color={color} />
      {/* Top edge trim */}
      <Voxel position={[x, height + 0.01, z]} size={[cabinetW + 0.02, 0.02, cabinetD + 0.02]} color={dark} />
      {/* Base trim */}
      <Voxel position={[x, 0.03, z]} size={[cabinetW + 0.02, 0.06, cabinetD + 0.02]} color={dark} />
      {/* Door split line */}
      <Voxel position={[x, cy, z + doorOff]} size={[0.01, height - 0.1, 0.01]} color={dark} />
      {/* Left door handle */}
      <Voxel position={[x - 0.06, cy + 0.05, z + handleOff]} size={[0.03, 0.12, 0.02]} color={dark} />
      {/* Right door handle */}
      <Voxel position={[x + 0.06, cy + 0.05, z + handleOff]} size={[0.03, 0.12, 0.02]} color={dark} />
    </>
  )
}

function OfficePrinter({ x, z }: { x: number; z: number }) {
  const body = '#e8e4e0'
  const dark = '#2a2a2a'
  const accent = '#3a3a3a'

  return (
    <>
      {/* Base unit / paper trays */}
      <Voxel position={[x, 0.15, z]} size={[0.8, 0.3, 0.65]} color={body} />
      {/* Feet */}
      <Voxel position={[x - 0.3, 0.02, z - 0.25]} size={[0.08, 0.04, 0.08]} color={dark} />
      <Voxel position={[x + 0.3, 0.02, z - 0.25]} size={[0.08, 0.04, 0.08]} color={dark} />
      <Voxel position={[x - 0.3, 0.02, z + 0.25]} size={[0.08, 0.04, 0.08]} color={dark} />
      <Voxel position={[x + 0.3, 0.02, z + 0.25]} size={[0.08, 0.04, 0.08]} color={dark} />
      {/* Paper tray slot lines */}
      <Voxel position={[x, 0.1, z - 0.33]} size={[0.6, 0.01, 0.01]} color={accent} />
      <Voxel position={[x, 0.2, z - 0.33]} size={[0.6, 0.01, 0.01]} color={accent} />

      {/* Main print engine body */}
      <Voxel position={[x, 0.46, z]} size={[0.85, 0.32, 0.7]} color={body} />
      {/* Dark accent strip around middle */}
      <Voxel position={[x, 0.42, z - 0.35]} size={[0.86, 0.04, 0.01]} color={accent} />

      {/* Top output tray (recessed) */}
      <Voxel position={[x, 0.63, z]} size={[0.82, 0.02, 0.65]} color={body} />
      {/* Output tray cavity */}
      <Voxel position={[x, 0.66, z + 0.05]} size={[0.6, 0.04, 0.4]} color="#d0ccc8" />
      {/* Paper in output tray */}
      <Voxel position={[x, 0.665, z + 0.05]} size={[0.5, 0.02, 0.35]} color="#f5f5f0" />

      {/* ADF / scanner lid on top */}
      <Voxel position={[x, 0.72, z]} size={[0.85, 0.06, 0.7]} color={body} />
      <Voxel position={[x, 0.76, z]} size={[0.83, 0.02, 0.68]} color="#d8d4d0" />

      {/* Control panel (front-right, angled) */}
      <Voxel position={[x + 0.25, 0.7, z - 0.32]} size={[0.25, 0.06, 0.08]} color={dark} />
      {/* Screen */}
      <Voxel position={[x + 0.25, 0.705, z - 0.33]} size={[0.16, 0.03, 0.01]} color="#2060a0" />
      {/* Buttons */}
      <Voxel position={[x + 0.14, 0.705, z - 0.33]} size={[0.03, 0.02, 0.01]} color="#40a040" />
    </>
  )
}

export const BackWallCabinets = React.memo(function BackWallCabinets() {
  // Along right wall (z=+5.95), backs near wall
  const wallZ = 5.55

  return (
    <>
      <StorageCabinet x={-0.2} z={wallZ} color="#5a6a70" height={1.05} faceZ={-1} />
      {/* Small pot plant on top of cabinet */}
      <Voxel position={[-0.1, 1.1, wallZ]} size={[0.12, 0.1, 0.12]} color="#6a5a4a" />
      <Voxel position={[-0.1, 1.18, wallZ]} size={[0.1, 0.06, 0.1]} color="#3a7030" />
      <Voxel position={[-0.1, 1.23, wallZ + 0.04]} size={[0.06, 0.06, 0.06]} color="#4a8840" />
      <OfficePrinter x={0.9} z={wallZ} />
      <SupplyShelf x={2.9} z={wallZ} />
    </>
  )
})

function SupplyShelf({ x, z }: { x: number; z: number }) {
  const frame = '#3a3a3a'
  const shelf = '#4a4a4a'
  const shelfW = 2.8
  const shelfD = 0.45
  const shelfH = 0.8

  return (
    <>
      {/* Vertical posts */}
      <Voxel position={[x - shelfW / 2, shelfH / 2, z]} size={[0.05, shelfH, 0.05]} color={frame} />
      <Voxel position={[x, shelfH / 2, z]} size={[0.05, shelfH, 0.05]} color={frame} />
      <Voxel position={[x + shelfW / 2, shelfH / 2, z]} size={[0.05, shelfH, 0.05]} color={frame} />
      {/* Back posts */}
      <Voxel position={[x - shelfW / 2, shelfH / 2, z + shelfD / 2]} size={[0.05, shelfH, 0.05]} color={frame} />
      <Voxel position={[x + shelfW / 2, shelfH / 2, z + shelfD / 2]} size={[0.05, shelfH, 0.05]} color={frame} />

      {/* 3 shelf levels + top */}
      <Voxel position={[x, 0.02, z]} size={[shelfW, 0.04, shelfD]} color={shelf} />
      <Voxel position={[x, 0.28, z]} size={[shelfW, 0.04, shelfD]} color={shelf} />
      <Voxel position={[x, 0.54, z]} size={[shelfW, 0.04, shelfD]} color={shelf} />
      <Voxel position={[x, shelfH, z]} size={[shelfW, 0.04, shelfD]} color={shelf} />

      {/* ── Bottom shelf: reams of paper ── */}
      {/* Left stack of 3 reams */}
      <Voxel position={[x - 1.0, 0.09, z]} size={[0.3, 0.1, 0.22]} color="#f0ede8" />
      <Voxel position={[x - 1.0, 0.15, z]} size={[0.3, 0.02, 0.22]} color="#e8e4e0" />
      <Voxel position={[x - 1.0, 0.19, z]} size={[0.3, 0.06, 0.22]} color="#f0ede8" />
      {/* Reams beside */}
      <Voxel position={[x - 0.6, 0.09, z]} size={[0.3, 0.1, 0.22]} color="#f2efea" />
      <Voxel position={[x - 0.6, 0.15, z]} size={[0.3, 0.02, 0.22]} color="#eae6e0" />
      <Voxel position={[x - 0.6, 0.19, z]} size={[0.3, 0.06, 0.22]} color="#f0ede8" />
      {/* Ream on its side */}
      <Voxel position={[x - 0.2, 0.09, z + 0.02]} size={[0.22, 0.1, 0.3]} color="#f0ede8" />
      {/* Right side: more paper + a box of envelopes */}
      <Voxel position={[x + 0.2, 0.09, z]} size={[0.3, 0.1, 0.22]} color="#f2efea" />
      <Voxel position={[x + 0.2, 0.15, z]} size={[0.3, 0.02, 0.22]} color="#e8e4e0" />
      <Voxel position={[x + 0.6, 0.09, z]} size={[0.3, 0.1, 0.22]} color="#f0ede8" />
      {/* Box of envelopes */}
      <Voxel position={[x + 1.0, 0.1, z]} size={[0.3, 0.12, 0.25]} color="#c8b890" />
      <Voxel position={[x + 1.0, 0.12, z - 0.13]} size={[0.26, 0.06, 0.01]} color="#e0dcd0" />

      {/* ── Middle shelf: arch lever files ── */}
      {[-1.1, -0.98, -0.86, -0.74, -0.62, -0.50, -0.38, -0.26, -0.14, -0.02, 0.1, 0.22, 0.34, 0.46].map((dx, i) => {
        const colors = ['#1a3a6a', '#6a1a1a', '#1a5a2a', '#4a2a6a', '#1a3a6a', '#6a1a1a', '#1a5a2a',
                        '#3a2a1a', '#1a3a6a', '#6a1a1a', '#1a5a2a', '#4a2a6a', '#6a1a1a', '#1a3a6a']
        return (
          <React.Fragment key={`alf-${i}`}>
            <Voxel position={[x + dx, 0.42, z]} size={[0.08, 0.24, 0.32]} color={colors[i]} />
            <Voxel position={[x + dx, 0.44, z - 0.165]} size={[0.06, 0.08, 0.01]} color="#e0dcd0" />
          </React.Fragment>
        )
      })}
      {/* Gap then a couple loose files leaning */}
      <Voxel position={[x + 0.66, 0.41, z]} size={[0.08, 0.22, 0.32]} color="#4a2a6a" />
      {/* Right section: document trays stacked */}
      <Voxel position={[x + 0.95, 0.33, z - 0.02]} size={[0.35, 0.04, 0.28]} color="#2a2a2a" />
      <Voxel position={[x + 0.95, 0.40, z - 0.02]} size={[0.35, 0.04, 0.28]} color="#2a2a2a" />
      <Voxel position={[x + 0.95, 0.47, z - 0.02]} size={[0.35, 0.04, 0.28]} color="#2a2a2a" />
      {/* Papers in trays */}
      <Voxel position={[x + 0.95, 0.36, z - 0.02]} size={[0.3, 0.02, 0.24]} color="#f5f5f0" />
      <Voxel position={[x + 0.95, 0.43, z - 0.02]} size={[0.3, 0.02, 0.24]} color="#f5f5f0" />

      {/* ── Top shelf: general office supplies ── */}
      {/* Pen/pencil cup */}
      <Voxel position={[x - 1.1, 0.6, z - 0.05]} size={[0.08, 0.1, 0.08]} color="#505050" />
      <Voxel position={[x - 1.1, 0.67, z - 0.06]} size={[0.01, 0.06, 0.01]} color="#d0a020" />
      <Voxel position={[x - 1.09, 0.68, z - 0.04]} size={[0.01, 0.08, 0.01]} color="#3060c0" />
      <Voxel position={[x - 1.11, 0.67, z - 0.03]} size={[0.01, 0.05, 0.01]} color="#c03030" />
      {/* Tape dispenser */}
      <Voxel position={[x - 0.85, 0.59, z - 0.05]} size={[0.1, 0.06, 0.06]} color="#2a2a2a" />
      <Voxel position={[x - 0.80, 0.6, z - 0.05]} size={[0.03, 0.04, 0.05]} color="#c8b870" />
      {/* Stapler */}
      <Voxel position={[x - 0.6, 0.575, z - 0.04]} size={[0.14, 0.03, 0.04]} color="#c03030" />
      {/* Box of binder clips */}
      <Voxel position={[x - 0.35, 0.6, z - 0.04]} size={[0.12, 0.08, 0.1]} color="#e0dcd0" />
      {/* Sticky notes stacks */}
      <Voxel position={[x - 0.1, 0.58, z - 0.04]} size={[0.1, 0.04, 0.1]} color="#f0e040" />
      <Voxel position={[x - 0.1, 0.61, z - 0.04]} size={[0.1, 0.02, 0.1]} color="#40c0f0" />
      <Voxel position={[x + 0.05, 0.58, z - 0.04]} size={[0.1, 0.04, 0.1]} color="#f090a0" />
      {/* Scissors */}
      <Voxel position={[x + 0.25, 0.575, z - 0.04]} size={[0.12, 0.02, 0.03]} color="#808080" />
      <Voxel position={[x + 0.25, 0.575, z - 0.06]} size={[0.06, 0.02, 0.02]} color="#d06020" />
      {/* Hole punch */}
      <Voxel position={[x + 0.5, 0.58, z - 0.04]} size={[0.12, 0.06, 0.1]} color="#2a2a2a" />
      {/* Box of labels */}
      <Voxel position={[x + 0.75, 0.6, z]} size={[0.16, 0.08, 0.2]} color="#c8a060" />
      {/* Second pen cup */}
      <Voxel position={[x + 1.0, 0.6, z - 0.05]} size={[0.08, 0.1, 0.08]} color="#6a4a2a" />
      <Voxel position={[x + 1.0, 0.67, z - 0.05]} size={[0.01, 0.07, 0.01]} color="#2a2a2a" />
      <Voxel position={[x + 1.01, 0.68, z - 0.04]} size={[0.01, 0.06, 0.01]} color="#d0a020" />
    </>
  )
}

/* ── Mezzanine Boss Office ── */
// Platform extends x=-5.93 to x=-0.5, z=-5.93 to z=-2.3
// Front railing at z≈-2.3, right railing at x≈-0.5
// Back wall at z=-5.93, left wall at x=-5.95
// Stairs arrive at right edge (x≈-0.5), z≈-5.2
//
// All furniture uses <group position> for easy repositioning.
// Move any piece by changing its group's position prop.

export const MezzanineOffice = React.memo(function MezzanineOffice() {
  const platY = 2.5
  const deskH = 0.72
  const wood = '#5a3a20'
  const woodDark = '#3a2410'
  const leather = '#2a1a10'
  const leatherLight = '#3a2a18'
  const metal = '#3a3a3a'

  return (
    <>
      {/* ═══ BOSS DESK + CHAIR + MONITORS ═══
          Single group — move/rotate the whole workstation.
          Origin at center of desk surface. Person sits at +z side, facing -z.
          Rotate group Y to change which way the boss faces. */}
      <group position={[-4.7, platY, -2.7]} rotation={[0, Math.PI, 0]}>
        {/* Desk surface */}
        <Voxel position={[0, deskH, 0]} size={[2.0, 0.05, 0.8]} color={wood} />
        {/* Front edge trim (faces person at +z) */}
        <Voxel position={[0, deskH - 0.01, 0.38]} size={[2.02, 0.07, 0.04]} color={woodDark} />
        {/* Legs */}
        <Voxel position={[-0.9, deskH / 2, -0.3]} size={[0.05, deskH, 0.05]} color={metal} />
        <Voxel position={[0.9, deskH / 2, -0.3]} size={[0.05, deskH, 0.05]} color={metal} />
        <Voxel position={[-0.9, deskH / 2, 0.3]} size={[0.05, deskH, 0.05]} color={metal} />
        <Voxel position={[0.9, deskH / 2, 0.3]} size={[0.05, deskH, 0.05]} color={metal} />

        {/* Monitor 1 — left, angled right */}
        <group position={[-0.3, deskH, -0.2]} rotation={[0, 0.15, 0]}>
          <Voxel position={[0, 0.22, 0]} size={[0.55, 0.35, 0.03]} color="#1a1a1a" />
          <Voxel position={[0, 0.20, 0.01]} size={[0.50, 0.30, 0.01]} color="#2a3a4a" />
          <Voxel position={[0, 0.03, 0]} size={[0.08, 0.06, 0.04]} color="#1a1a1a" />
          <Voxel position={[0, 0.01, 0]} size={[0.18, 0.02, 0.10]} color="#1a1a1a" />
        </group>
        {/* Monitor 2 — right, angled left */}
        <group position={[0.3, deskH, -0.2]} rotation={[0, -0.15, 0]}>
          <Voxel position={[0, 0.22, 0]} size={[0.55, 0.35, 0.03]} color="#1a1a1a" />
          <Voxel position={[0, 0.20, 0.01]} size={[0.50, 0.30, 0.01]} color="#2a3a4a" />
          <Voxel position={[0, 0.03, 0]} size={[0.08, 0.06, 0.04]} color="#1a1a1a" />
          <Voxel position={[0, 0.01, 0]} size={[0.18, 0.02, 0.10]} color="#1a1a1a" />
        </group>

        {/* Keyboard & mouse */}
        <Voxel position={[0, deskH + 0.02, 0.1]} size={[0.35, 0.015, 0.12]} color="#2a2a2a" />
        <Voxel position={[0.35, deskH + 0.02, 0.12]} size={[0.06, 0.02, 0.1]} color="#2a2a2a" />
        {/* Coffee mug */}
        <Voxel position={[-0.75, deskH + 0.05, 0.15]} size={[0.07, 0.09, 0.07]} color="#d4c8a0" />
        {/* Notepad + pen */}
        <Voxel position={[-0.75, deskH + 0.02, -0.1]} size={[0.18, 0.02, 0.24]} color="#f0ede8" />
        <Voxel position={[-0.7, deskH + 0.035, -0.07]} size={[0.12, 0.01, 0.015]} color="#1a1a3a" />

        {/* Desk lamp (far left) */}
        <Voxel position={[-0.85, deskH + 0.02, -0.25]} size={[0.12, 0.04, 0.12]} color="#2a2a2a" />
        <Voxel position={[-0.85, deskH + 0.18, -0.25]} size={[0.03, 0.3, 0.03]} color="#2a2a2a" />
        <Voxel position={[-0.77, deskH + 0.32, -0.2]} size={[0.14, 0.06, 0.1]} color="#2a2a2a" />
        <pointLight position={[-0.77, deskH + 0.28, -0.15]} intensity={0.6} color="#ffe0b0" distance={2.5} decay={2} />

        {/* Executive chair (behind desk, person faces -z toward monitors) */}
        <group position={[0, 0, 0.75]}>
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (i / 5) * Math.PI * 2
            return (
              <Voxel key={`cbase-${i}`}
                position={[Math.cos(a) * 0.2, 0.04, Math.sin(a) * 0.2]}
                size={[0.04, 0.03, 0.04]} color={metal} />
            )
          })}
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (i / 5) * Math.PI * 2
            return (
              <Voxel key={`cwheel-${i}`}
                position={[Math.cos(a) * 0.22, 0.015, Math.sin(a) * 0.22]}
                size={[0.03, 0.03, 0.03]} color="#1a1a1a" />
            )
          })}
          <Voxel position={[0, 0.2, 0]} size={[0.06, 0.35, 0.06]} color={metal} />
          <Voxel position={[0, 0.4, 0]} size={[0.42, 0.06, 0.42]} color={leather} />
          <Voxel position={[0, 0.42, 0]} size={[0.38, 0.03, 0.38]} color={leatherLight} />
          <Voxel position={[0, 0.65, 0.18]} size={[0.38, 0.45, 0.06]} color={leather} />
          <Voxel position={[0, 0.65, 0.17]} size={[0.32, 0.38, 0.03]} color={leatherLight} />
          <Voxel position={[0, 0.92, 0.18]} size={[0.28, 0.1, 0.06]} color={leather} />
          <Voxel position={[-0.22, 0.52, 0.05]} size={[0.04, 0.2, 0.04]} color={metal} />
          <Voxel position={[0.22, 0.52, 0.05]} size={[0.04, 0.2, 0.04]} color={metal} />
          <Voxel position={[-0.22, 0.62, 0.02]} size={[0.06, 0.03, 0.2]} color={leather} />
          <Voxel position={[0.22, 0.62, 0.02]} size={[0.06, 0.03, 0.2]} color={leather} />
        </group>
      </group>

      {/* ═══ MEETING TABLE + CHAIRS ═══
          Near apex of front railing + right railing.
          Move this group to reposition all meeting furniture. */}
      <group position={[-1.7, platY, -3.6]}>
        {/* Oval table — stretched in X */}
        <mesh position={[-0.2, 0.68, 0]} scale={[1.69, 0.05, 1.3]} castShadow receiveShadow>
          <cylinderGeometry args={[0.5, 0.5, 1, 24]} />
          <meshLambertMaterial color={wood} />
        </mesh>
        {/* Pedestal leg */}
        <Voxel position={[-0.2, 0.34, 0]} size={[0.15, 0.68, 0.15]} color={metal} />
        {/* Base plate */}
        <mesh position={[-0.2, 0.02, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.04, 16]} />
          <meshLambertMaterial color={metal} />
        </mesh>
        {/* Notepads */}
        <Voxel position={[-0.35, 0.73, 0.15]} size={[0.16, 0.02, 0.22]} color="#f0ede8" />
        <Voxel position={[0.1, 0.73, -0.2]} size={[0.16, 0.02, 0.22]} color="#f0ede8" />
        {/* Water glasses */}
        <Voxel position={[0.2, 0.75, 0.25]} size={[0.04, 0.08, 0.04]} color="#b8d0d8" transparent opacity={0.4} />
        <Voxel position={[-0.55, 0.75, -0.15]} size={[0.04, 0.08, 0.04]} color="#b8d0d8" transparent opacity={0.4} />

        {/* 4 chairs around table */}
        {[
          { x: -0.2, z: 0.95, rot: 0 },
          { x: -0.2, z: -0.95, rot: Math.PI },
          { x: 0.65, z: 0, rot: Math.PI / 2 },
          { x: -1.05, z: 0, rot: -Math.PI / 2 },
        ].map(({ x, z, rot }, i) => (
          <group key={`mc-${i}`} position={[x, 0, z]} rotation={[0, rot, 0]}>
            <Voxel position={[-0.12, 0.2, -0.12]} size={[0.03, 0.4, 0.03]} color={metal} />
            <Voxel position={[0.12, 0.2, -0.12]} size={[0.03, 0.4, 0.03]} color={metal} />
            <Voxel position={[-0.12, 0.2, 0.12]} size={[0.03, 0.4, 0.03]} color={metal} />
            <Voxel position={[0.12, 0.2, 0.12]} size={[0.03, 0.4, 0.03]} color={metal} />
            <Voxel position={[0, 0.42, 0]} size={[0.32, 0.04, 0.32]} color={leather} />
            <Voxel position={[0, 0.62, 0.14]} size={[0.3, 0.35, 0.03]} color={leather} />
          </group>
        ))}
      </group>

      {/* ═══ LOW L-SHAPED OPEN SHELVES (back-left corner) ═══
          Origin at inner corner where walls meet.
          Back wall arm: flush with back wall, runs +X, touches left wall.
          Left wall arm: flush with left wall, runs +Z, butts into back wall arm. */}
      <group position={[-5.80, platY, -5.8]}>
        {(() => {
          const frame = '#3a3a3a'
          const shelf = '#4a4a4a'
          const h = 0.55
          const d = 0.4
          const bw = 1.0   // back wall arm length along X
          const lw = 1.12  // left wall arm length along Z
          return (
            <>
              {/* ── Back wall arm (runs +X, back at z=0 against wall) ── */}
              <Voxel position={[0, h / 2, 0]} size={[0.04, h, 0.04]} color={frame} />
              <Voxel position={[bw / 2, h / 2, 0]} size={[0.04, h, 0.04]} color={frame} />
              <Voxel position={[bw, h / 2, 0]} size={[0.04, h, 0.04]} color={frame} />
              <Voxel position={[bw, h / 2, d]} size={[0.04, h, 0.04]} color={frame} />
              <Voxel position={[bw / 2, 0.02, d / 2]} size={[bw, 0.03, d]} color={shelf} />
              <Voxel position={[bw / 2, h / 2, d / 2]} size={[bw, 0.03, d]} color={shelf} />
              <Voxel position={[bw / 2, h, d / 2]} size={[bw, 0.03, d]} color={shelf} />

              {/* ── Left wall arm (runs +Z, back at x=0 against wall) ── */}
              <Voxel position={[0, h / 2, lw]} size={[0.04, h, 0.04]} color={frame} />
              <Voxel position={[d, h / 2, lw]} size={[0.04, h, 0.04]} color={frame} />
              <Voxel position={[d / 2, 0.02, lw / 2]} size={[d, 0.03, lw]} color={shelf} />
              <Voxel position={[d / 2, h / 2, lw / 2]} size={[d, 0.03, lw]} color={shelf} />
              <Voxel position={[d / 2, h, lw / 2]} size={[d, 0.03, lw]} color={shelf} />

              {/* Items on back wall arm */}
              <Voxel position={[0.2, 0.1, d / 2]} size={[0.25, 0.12, 0.22]} color="#f0ede8" />
              <Voxel position={[0.55, 0.1, d / 2]} size={[0.2, 0.14, 0.2]} color="#1a3a6a" />
              <Voxel position={[0.8, 0.1, d / 2]} size={[0.18, 0.1, 0.18]} color="#6a1a1a" />
              <Voxel position={[0.3, h / 2 + 0.06, d / 2]} size={[0.14, 0.1, 0.14]} color="#4a5a6a" />
              <Voxel position={[0.7, h / 2 + 0.06, d / 2]} size={[0.12, 0.08, 0.12]} color="#3a7030" />
              {/* Items on left wall arm */}
              <Voxel position={[d / 2, 0.1, 0.4]} size={[0.2, 0.14, 0.25]} color="#4a2a4a" />
              <Voxel position={[d / 2, 0.1, 0.8]} size={[0.22, 0.1, 0.2]} color="#2a4a2a" />
            </>
          )
        })()}
      </group>

      {/* ═══ FIDDLE LEAF FIG (right side of whiteboard, back wall) ═══ */}
      <FiddleLeafFig position={[-4.55, platY, -5.65]} maturity={0.5} scale={0.7} seed={77} potHeightScale={2} />
    </>
  )
})

/* ── Kitchen (under mezzanine) ── */
// Mezzanine deck at y=2.5, platform spans x=-5.93...-0.5, z=-5.93...-2.3
// Back wall at z=-5.93, left wall at x=-5.95
// Kitchen runs along back wall from x=-5.5 to x=-1.5, all at floor level

export const Kitchen = React.memo(function Kitchen() {
  const counterH = 0.88
  const counterD = 0.6
  const counterColor = '#c0b8a8' // light stone countertop
  const cabinetColor = '#2a3a3a' // dark teal-green cabinets
  const cabinetDark = '#1e2e2e'
  const cabinetLight = '#354848'
  const metal = '#6a6a6a'
  const metalDark = '#4a4a4a'
  const white = '#e8e8e8'
  const wallZ = -5.7 // counter backs against wall, offset slightly
  const counterZ = wallZ + counterD / 2

  return (
    <>
      {/* ═══ BACK WALL COUNTER RUN ═══
          Runs from x=-5.3 to x=-1.8 against back wall */}

      {/* Counter top — continuous slab */}
      <Voxel position={[-3.55, counterH, counterZ]} size={[3.5, 0.04, counterD]} color={counterColor} />
      {/* Front edge strip */}
      <Voxel position={[-3.55, counterH - 0.01, counterZ + counterD / 2 - 0.02]} size={[3.5, 0.06, 0.03]} color="#b0a898" />

      {/* ── Base cabinets ── */}
      {/* Plinth / kickboard */}
      <Voxel position={[-3.55, 0.06, counterZ + 0.05]} size={[3.5, 0.1, counterD - 0.1]} color={cabinetDark} />

      {/* Cabinet 1: under-sink (x ~ -5.0) */}
      <Voxel position={[-5.0, 0.46, counterZ]} size={[0.58, 0.68, counterD - 0.06]} color={cabinetColor} />
      {/* Double door lines */}
      <Voxel position={[-5.0, 0.46, counterZ + counterD / 2 - 0.01]} size={[0.02, 0.58, 0.02]} color={cabinetDark} />
      {/* Door handles */}
      <Voxel position={[-5.08, 0.55, counterZ + counterD / 2]} size={[0.02, 0.1, 0.02]} color={metal} />
      <Voxel position={[-4.92, 0.55, counterZ + counterD / 2]} size={[0.02, 0.1, 0.02]} color={metal} />

      {/* Cabinet 2: dishwasher (x ~ -4.35) */}
      <Voxel position={[-4.35, 0.46, counterZ]} size={[0.58, 0.68, counterD - 0.06]} color="#d0d0d0" />
      {/* Dishwasher front panel */}
      <Voxel position={[-4.35, 0.46, counterZ + counterD / 2 - 0.01]} size={[0.54, 0.64, 0.02]} color={white} />
      {/* Handle bar */}
      <Voxel position={[-4.35, 0.72, counterZ + counterD / 2 + 0.01]} size={[0.4, 0.03, 0.03]} color={metalDark} />
      {/* Control strip */}
      <Voxel position={[-4.35, 0.82, counterZ + counterD / 2 - 0.01]} size={[0.5, 0.04, 0.01]} color="#2a2a2a" />
      {/* Indicator lights */}
      <Voxel position={[-4.45, 0.82, counterZ + counterD / 2]} size={[0.02, 0.02, 0.01]} color="#40c060" />
      <Voxel position={[-4.40, 0.82, counterZ + counterD / 2]} size={[0.02, 0.02, 0.01]} color="#3090d0" />

      {/* Cabinet 3: drawers (x ~ -3.7) */}
      <Voxel position={[-3.7, 0.46, counterZ]} size={[0.58, 0.68, counterD - 0.06]} color={cabinetColor} />
      {/* 3 drawer fronts */}
      <Voxel position={[-3.7, 0.2, counterZ + counterD / 2 - 0.01]} size={[0.52, 0.18, 0.02]} color={cabinetLight} />
      <Voxel position={[-3.7, 0.45, counterZ + counterD / 2 - 0.01]} size={[0.52, 0.18, 0.02]} color={cabinetLight} />
      <Voxel position={[-3.7, 0.7, counterZ + counterD / 2 - 0.01]} size={[0.52, 0.18, 0.02]} color={cabinetLight} />
      {/* Drawer handles */}
      <Voxel position={[-3.7, 0.2, counterZ + counterD / 2]} size={[0.12, 0.02, 0.02]} color={metal} />
      <Voxel position={[-3.7, 0.45, counterZ + counterD / 2]} size={[0.12, 0.02, 0.02]} color={metal} />
      <Voxel position={[-3.7, 0.7, counterZ + counterD / 2]} size={[0.12, 0.02, 0.02]} color={metal} />

      {/* Cabinet 4: double door (x ~ -3.05) */}
      <Voxel position={[-3.05, 0.46, counterZ]} size={[0.58, 0.68, counterD - 0.06]} color={cabinetColor} />
      <Voxel position={[-3.05, 0.46, counterZ + counterD / 2 - 0.01]} size={[0.02, 0.58, 0.02]} color={cabinetDark} />
      <Voxel position={[-3.13, 0.55, counterZ + counterD / 2]} size={[0.02, 0.1, 0.02]} color={metal} />
      <Voxel position={[-2.97, 0.55, counterZ + counterD / 2]} size={[0.02, 0.1, 0.02]} color={metal} />

      {/* Cabinet 5: single door (x ~ -2.4) */}
      <Voxel position={[-2.4, 0.46, counterZ]} size={[0.58, 0.68, counterD - 0.06]} color={cabinetColor} />
      <Voxel position={[-2.4, 0.55, counterZ + counterD / 2]} size={[0.02, 0.1, 0.02]} color={metal} />

      {/* ── Sink (on counter, x ~ -5.0) ── */}
      {/* Basin cutout (dark recessed rectangle) */}
      <Voxel position={[-5.0, counterH - 0.01, counterZ - 0.02]} size={[0.45, 0.04, 0.35]} color="#606060" />
      {/* Inner basin */}
      <Voxel position={[-5.0, counterH - 0.04, counterZ - 0.02]} size={[0.40, 0.04, 0.30]} color="#808080" />
      {/* Faucet base */}
      <Voxel position={[-5.0, counterH + 0.04, wallZ + 0.1]} size={[0.04, 0.08, 0.04]} color={metalDark} />
      {/* Faucet neck */}
      <Voxel position={[-5.0, counterH + 0.15, wallZ + 0.12]} size={[0.03, 0.2, 0.03]} color={metalDark} />
      {/* Faucet spout (arches over sink) */}
      <Voxel position={[-5.0, counterH + 0.24, wallZ + 0.18]} size={[0.03, 0.03, 0.1]} color={metalDark} />
      <Voxel position={[-5.0, counterH + 0.2, counterZ - 0.02]} size={[0.02, 0.06, 0.02]} color={metalDark} />

      {/* ── Coffee machine (on counter, x ~ -3.05) ── */}
      {/* Body */}
      <Voxel position={[-3.05, counterH + 0.16, counterZ - 0.05]} size={[0.28, 0.3, 0.35]} color="#1a1a1a" />
      {/* Top reservoir */}
      <Voxel position={[-3.05, counterH + 0.35, counterZ - 0.1]} size={[0.22, 0.08, 0.2]} color="#2a2a2a" />
      {/* Drip tray */}
      <Voxel position={[-3.05, counterH + 0.02, counterZ + 0.05]} size={[0.22, 0.02, 0.12]} color="#3a3a3a" />
      {/* Portafilter handle */}
      <Voxel position={[-3.05, counterH + 0.1, counterZ + 0.13]} size={[0.04, 0.04, 0.04]} color={metalDark} />
      <Voxel position={[-3.05, counterH + 0.06, counterZ + 0.16]} size={[0.1, 0.02, 0.02]} color="#5a3a20" />
      {/* Steam wand */}
      <Voxel position={[-2.92, counterH + 0.12, counterZ + 0.08]} size={[0.015, 0.12, 0.015]} color={metalDark} />
      {/* Cup on drip tray */}
      <Voxel position={[-3.05, counterH + 0.07, counterZ + 0.05]} size={[0.05, 0.06, 0.05]} color={white} />

      {/* ── Kettle (on counter near coffee machine) ── */}
      <Voxel position={[-2.6, counterH + 0.08, counterZ - 0.05]} size={[0.14, 0.14, 0.14]} color={metalDark} />
      <Voxel position={[-2.6, counterH + 0.16, counterZ - 0.05]} size={[0.1, 0.02, 0.1]} color="#3a3a3a" />
      {/* Handle */}
      <Voxel position={[-2.6, counterH + 0.12, counterZ + 0.05]} size={[0.02, 0.08, 0.04]} color="#2a2a2a" />
      {/* Base */}
      <Voxel position={[-2.6, counterH + 0.01, counterZ - 0.05]} size={[0.16, 0.02, 0.16]} color="#2a2a2a" />

      {/* ── Upper cupboards (mounted on back wall, below mezzanine) ── */}
      {/* Row of wall cabinets from x=-5.3 to x=-2.1, y=1.4 to y=2.2 */}
      {[
        { x: -5.0, w: 0.6 },
        { x: -4.35, w: 0.6 },
        { x: -3.7, w: 0.6 },
        { x: -3.05, w: 0.6 },
        { x: -2.4, w: 0.6 },
      ].map(({ x, w }, i) => (
        <React.Fragment key={`ucab-${i}`}>
          {/* Cabinet body */}
          <Voxel position={[x, 1.8, wallZ + 0.17]} size={[w, 0.7, 0.32]} color={cabinetColor} />
          {/* Door face */}
          <Voxel position={[x, 1.8, wallZ + 0.34]} size={[w - 0.04, 0.66, 0.02]} color={cabinetLight} />
          {/* Handle */}
          <Voxel position={[x, 1.55, wallZ + 0.36]} size={[0.1, 0.02, 0.02]} color={metal} />
        </React.Fragment>
      ))}

      {/* ── Fridge (left wall side, x ~ -5.55) ── */}
      <group position={[-5.55, 0, -4.5]} rotation={[0, Math.PI/2, 0]}>
        {/* Body */}
        <Voxel position={[0, 0.88, 0]} size={[0.7, 1.74, 0.65]} color={white} />
        {/* Side panels slightly darker */}
        <Voxel position={[-0.34, 0.88, 0]} size={[0.02, 1.7, 0.62]} color="#d0d0d0" />
        <Voxel position={[0.34, 0.88, 0]} size={[0.02, 1.7, 0.62]} color="#d0d0d0" />

        {/* Freezer door (top section) */}
        <Voxel position={[0, 1.52, 0.31]} size={[0.66, 0.44, 0.02]} color="#dcdcdc" />
        {/* Freezer handle */}
        <Voxel position={[0.2, 1.52, 0.34]} size={[0.02, 0.3, 0.03]} color={metalDark} />

        {/* Fridge door (bottom section) */}
        <Voxel position={[0, 0.65, 0.31]} size={[0.66, 1.08, 0.02]} color="#dcdcdc" />
        {/* Door line between sections */}
        <Voxel position={[0, 1.27, 0.32]} size={[0.66, 0.02, 0.02]} color="#b0b0b0" />
        {/* Fridge handle */}
        <Voxel position={[0.2, 0.75, 0.34]} size={[0.02, 0.4, 0.03]} color={metalDark} />

        {/* Top cap */}
        <Voxel position={[0, 1.76, 0]} size={[0.7, 0.02, 0.65]} color="#d0d0d0" />
      </group>

      {/* ── Backsplash tiles (between counter and upper cabinets) ── */}
      <Voxel position={[-3.55, 1.15, wallZ + 0.03]} size={[3.5, 0.5, 0.04]} color="#d8d0c0" />
      {/* Subtle tile grid lines */}
      {[-5.15, -4.85, -4.55, -4.25, -3.95, -3.65, -3.35, -3.05, -2.75, -2.45, -2.15].map((tx, i) => (
        <Voxel key={`tile-v-${i}`} position={[tx, 1.15, wallZ + 0.055]} size={[0.01, 0.5, 0.01]} color="#c8c0b0" />
      ))}
      {[1.0, 1.15, 1.3].map((ty, i) => (
        <Voxel key={`tile-h-${i}`} position={[-3.55, ty, wallZ + 0.055]} size={[3.5, 0.01, 0.01]} color="#c8c0b0" />
      ))}

      {/* ── Dish drying rack (on counter near sink) ── */}
      <Voxel position={[-4.55, counterH + 0.04, counterZ]} size={[0.3, 0.06, 0.3]} color={metalDark} />
      {/* Rack wires */}
      <Voxel position={[-4.55, counterH + 0.08, counterZ - 0.08]} size={[0.28, 0.02, 0.02]} color={metal} />
      <Voxel position={[-4.55, counterH + 0.08, counterZ + 0.02]} size={[0.28, 0.02, 0.02]} color={metal} />
      <Voxel position={[-4.55, counterH + 0.08, counterZ + 0.08]} size={[0.28, 0.02, 0.02]} color={metal} />

      {/* ── Kitchen bin (beside counter end) ── */}
      <Voxel position={[-1.95, 0.22, counterZ]} size={[0.22, 0.42, 0.22]} color="#3a3a3a" />
      <Voxel position={[-1.95, 0.44, counterZ]} size={[0.24, 0.02, 0.24]} color="#4a4a4a" />
      {/* Pedal */}
      <Voxel position={[-1.95, 0.04, counterZ + 0.13]} size={[0.08, 0.02, 0.04]} color="#4a4a4a" />

      {/* ── Mugs on shelf / counter accessories ── */}
      {/* Mug tree near kettle */}
      <Voxel position={[-2.25, counterH + 0.02, counterZ - 0.05]} size={[0.08, 0.04, 0.08]} color="#5a3a20" />
      <Voxel position={[-2.25, counterH + 0.14, counterZ - 0.05]} size={[0.02, 0.22, 0.02]} color="#5a3a20" />
      {/* Mugs hanging */}
      <Voxel position={[-2.22, counterH + 0.18, counterZ - 0.02]} size={[0.05, 0.06, 0.05]} color="#d04040" />
      <Voxel position={[-2.28, counterH + 0.18, counterZ - 0.08]} size={[0.05, 0.06, 0.05]} color="#3060b0" />
      <Voxel position={[-2.22, counterH + 0.1, counterZ - 0.08]} size={[0.05, 0.06, 0.05]} color="#d0a020" />

      {/* ── Eating table + stools (center of kitchen area) ── */}
      <group position={[-3.5, 0, -3.4]}>
        {/* Table top */}
        <Voxel position={[0, 0.72, 0]} size={[1.4, 0.04, 0.7]} color="#7a5a38" />
        {/* Legs — metal hairpin style */}
        <Voxel position={[-0.6, 0.36, -0.25]} size={[0.04, 0.72, 0.04]} color={metalDark} />
        <Voxel position={[0.6, 0.36, -0.25]} size={[0.04, 0.72, 0.04]} color={metalDark} />
        <Voxel position={[-0.6, 0.36, 0.25]} size={[0.04, 0.72, 0.04]} color={metalDark} />
        <Voxel position={[0.6, 0.36, 0.25]} size={[0.04, 0.72, 0.04]} color={metalDark} />

        {/* Stuff on table */}
        {/* Salt & pepper */}
        <Voxel position={[0.1, 0.78, 0]} size={[0.03, 0.06, 0.03]} color="#e0e0e0" />
        <Voxel position={[0.17, 0.78, 0]} size={[0.03, 0.06, 0.03]} color="#2a2a2a" />
        {/* Napkin holder */}
        <Voxel position={[-0.1, 0.77, 0]} size={[0.1, 0.06, 0.03]} color={metalDark} />

        {/* 4 stools — 2 per side */}
        {[
          { x: -0.35, z: -0.6 },
          { x: 0.35, z: -0.6 },
          { x: -0.35, z: 0.6 },
          { x: 0.35, z: 0.6 },
        ].map(({ x, z }, i) => (
          <React.Fragment key={`stool-${i}`}>
            {/* Legs */}
            <Voxel position={[x - 0.1, 0.24, z - 0.1]} size={[0.03, 0.48, 0.03]} color={metalDark} />
            <Voxel position={[x + 0.1, 0.24, z - 0.1]} size={[0.03, 0.48, 0.03]} color={metalDark} />
            <Voxel position={[x - 0.1, 0.24, z + 0.1]} size={[0.03, 0.48, 0.03]} color={metalDark} />
            <Voxel position={[x + 0.1, 0.24, z + 0.1]} size={[0.03, 0.48, 0.03]} color={metalDark} />
            {/* Foot ring */}
            <Voxel position={[x, 0.15, z]} size={[0.22, 0.02, 0.22]} color={metal} />
            {/* Seat */}
            <Voxel position={[x, 0.49, z]} size={[0.28, 0.04, 0.28]} color="#5a3a20" />
          </React.Fragment>
        ))}
      </group>

      {/* ── Overhead light strip under mezzanine ── */}
      <Voxel position={[-3.55, 2.42, counterZ]} size={[3.0, 0.03, 0.06]} color={white} />
      <pointLight position={[-3.55, 2.35, counterZ + 0.2]} intensity={0.8} color="#fff5e0" distance={3} decay={2} />
    </>
  )
})
