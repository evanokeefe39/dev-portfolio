import React from 'react'
import { Voxel } from '../../Voxel'

const PENDANT_POSITIONS: [number, number, number][] = [
  [-0.2, 0, -1.5],
  [2.2, 0, -1.5],
  [-0.2, 0, 2.5],
  [2.2, 0, 2.5],
]

const SHADE_Y = 1.65
const CEILING_Y = 4.9
const ROD_LEN = CEILING_Y - SHADE_Y - 0.1
const ROD_CENTER_Y = SHADE_Y + 0.1 + ROD_LEN / 2

export const PendantLights = React.memo(function PendantLights() {
  return (
    <>
      {PENDANT_POSITIONS.map(([x, , z], i) => (
        <React.Fragment key={`pendant-${i}`}>
          <Voxel position={[x, ROD_CENTER_Y, z]} size={[0.02, ROD_LEN, 0.02]} color="#3a3a3a" />
          <Voxel position={[x, CEILING_Y, z]} size={[0.12, 0.04, 0.12]} color="#2a2a2a" />
          <Voxel position={[x, SHADE_Y, z]} size={[0.5, 0.08, 0.5]} color="#3a3a3a" />
          <Voxel position={[x, SHADE_Y + 0.06, z]} size={[0.35, 0.06, 0.35]} color="#3a3a3a" />
          <Voxel position={[x, SHADE_Y - 0.06, z]} size={[0.14, 0.1, 0.14]} color="#ffe8a0" />
          <pointLight
            position={[x, SHADE_Y - 0.15, z]}
            intensity={1.8}
            distance={5}
            color="#ffe0b0"
            decay={2}
          />
        </React.Fragment>
      ))}
    </>
  )
})

export function Ductwork() {
  return null
}

export const Whiteboard = React.memo(function Whiteboard() {
  return (
    <group position={[-3.0, 3.45, -5.83]}>
      <Voxel position={[0, 0, -0.02]} size={[1.5, 1.0, 0.06]} color="#e8e8e8" />
      <Voxel position={[-0.78, 0, 0]} size={[0.06, 1.1, 0.04]} color="#a0a0a0" />
      <Voxel position={[0.78, 0, 0]} size={[0.06, 1.1, 0.04]} color="#a0a0a0" />
      <Voxel position={[0, 0.53, 0]} size={[1.6, 0.06, 0.04]} color="#a0a0a0" />
      <Voxel position={[0, -0.53, 0]} size={[1.6, 0.06, 0.04]} color="#a0a0a0" />
      <Voxel position={[0, -0.55, 0.05]} size={[0.6, 0.04, 0.1]} color="#b0b0b0" />
      <Voxel position={[-0.2, 0.2, 0.01]} size={[0.5, 0.04, 0.02]} color="#d04040" />
      <Voxel position={[0.1, 0, 0.01]} size={[0.6, 0.04, 0.02]} color="#3070d0" />
      <Voxel position={[-0.1, -0.2, 0.01]} size={[0.4, 0.04, 0.02]} color="#30a050" />
    </group>
  )
})

const PLANT_POSITIONS: { pos: [number, number, number] }[] = [
  { pos: [5.3, 0, 5.5] },
  { pos: [-1, 0, 5.5] },
]

export const WarehousePlants = React.memo(function WarehousePlants() {
  return (
    <>
      {PLANT_POSITIONS.map(({ pos }, i) => (
        <React.Fragment key={`plant-${i}`}>
          <Voxel position={[pos[0], 0.15, pos[2]]} size={[0.4, 0.3, 0.4]} color="#808080" />
          <Voxel position={[pos[0], 0.32, pos[2]]} size={[0.35, 0.04, 0.35]} color="#4a3a2a" />
          <Voxel position={[pos[0], 0.8, pos[2]]} size={[0.08, 0.9, 0.08]} color="#6a5030" />
          <Voxel position={[pos[0], 1.4, pos[2]]} size={[0.5, 0.3, 0.5]} color="#3a8040" />
          <Voxel position={[pos[0] + 0.15, 1.6, pos[2] - 0.1]} size={[0.35, 0.25, 0.3]} color="#4a9050" />
          <Voxel position={[pos[0] - 0.1, 1.55, pos[2] + 0.15]} size={[0.3, 0.28, 0.35]} color="#358838" />
        </React.Fragment>
      ))}
    </>
  )
})

export const IndustrialShelf = React.memo(function IndustrialShelf() {
  const sx = -4.5
  const sz = 4

  return (
    <>
      <Voxel position={[sx - 0.35, 0.7, sz]} size={[0.06, 1.4, 0.06]} color="#3a3a3a" />
      <Voxel position={[sx + 0.35, 0.7, sz]} size={[0.06, 1.4, 0.06]} color="#3a3a3a" />
      <Voxel position={[sx, 0.3, sz]} size={[0.8, 0.04, 0.3]} color="#4a4a4a" />
      <Voxel position={[sx, 0.7, sz]} size={[0.8, 0.04, 0.3]} color="#4a4a4a" />
      <Voxel position={[sx, 1.1, sz]} size={[0.8, 0.04, 0.3]} color="#4a4a4a" />
      <Voxel position={[sx - 0.15, 0.4, sz]} size={[0.25, 0.15, 0.2]} color="#c8a060" />
      <Voxel position={[sx + 0.1, 0.78, sz]} size={[0.2, 0.1, 0.15]} color="#d04040" />
      <Voxel position={[sx + 0.1, 0.84, sz]} size={[0.18, 0.04, 0.15]} color="#3070d0" />
      <Voxel position={[sx - 0.2, 1.17, sz]} size={[0.12, 0.1, 0.12]} color="#707070" />
      <Voxel position={[sx - 0.2, 1.25, sz]} size={[0.1, 0.08, 0.1]} color="#40a050" />
    </>
  )
})
