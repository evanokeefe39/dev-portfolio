import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Voxel } from '../Voxel'

// A tiny krab that hops onto the swivel chair
export function ChairKrab() {
  const groupRef = useRef<THREE.Group>(null!)
  const state = useRef({ time: 0 })

  const cx = -1.4, cz = -0.95 // chair position

  useFrame((_, delta) => {
    const s = state.current
    s.time += delta
    if (!groupRef.current) return

    // orbit around chair, then hop up onto seat, then hop off - repeating cycle
    const cycle = s.time % 8 // 8 second cycle
    let x: number, y: number, z: number, rot: number

    if (cycle < 3) {
      // circling the chair
      const a = (cycle / 3) * Math.PI * 2
      x = cx + Math.sin(a) * 0.6
      z = cz + Math.cos(a) * 0.6
      y = 0.0
      rot = a + Math.PI
    } else if (cycle < 4) {
      // hop up onto chair
      const t = cycle - 3
      x = cx
      z = cz
      y = t * 0.48
      // bounce arc
      y += Math.sin(t * Math.PI) * 0.15
      rot = 0
    } else if (cycle < 6.5) {
      // sitting on chair, spinning with it
      const spinT = cycle - 4
      x = cx + Math.sin(spinT * 1.2) * 0.08
      z = cz + Math.cos(spinT * 1.2) * 0.08
      y = 0.48
      rot = spinT * 1.2
    } else {
      // hop off
      const t = (cycle - 6.5) / 1.5
      const a = Math.PI * 0.5
      x = cx + Math.sin(a) * 0.6 * t
      z = cz + Math.cos(a) * 0.6 * t
      y = 0.48 * (1 - t) + Math.sin(t * Math.PI) * 0.2
      rot = a
    }

    groupRef.current.position.set(x, y, z)
    groupRef.current.rotation.y = rot

    // jittery idle leg wiggle
    const wiggle = Math.sin(s.time * 16) * 0.15
    groupRef.current.rotation.z = wiggle * 0.05
  })

  return (
    <group ref={groupRef} scale={[0.5, 0.5, 0.5]}>
      {/* tiny body */}
      <Voxel position={[0, 0.22, 0]} size={[0.4, 0.18, 0.3]} color="#2080a0" />
      <Voxel position={[0, 0.28, 0]} size={[0.36, 0.12, 0.26]} color="#2890b0" />
      {/* eyes */}
      <Voxel position={[-0.12, 0.36, -0.12]} size={[0.04, 0.12, 0.04]} color="#2080a0" />
      <Voxel position={[0.12, 0.36, -0.12]}  size={[0.04, 0.12, 0.04]} color="#2080a0" />
      <Voxel position={[-0.12, 0.44, -0.12]} size={[0.06, 0.06, 0.06]} color="#111111" />
      <Voxel position={[0.12, 0.44, -0.12]}  size={[0.06, 0.06, 0.06]} color="#111111" />
      <Voxel position={[-0.13, 0.46, -0.14]} size={[0.02, 0.02, 0.02]} color="#ffffff" />
      <Voxel position={[0.11, 0.46, -0.14]}  size={[0.02, 0.02, 0.02]} color="#ffffff" />
      {/* tiny round shell */}
      <Voxel position={[0, 0.38, 0.02]} size={[0.3, 0.14, 0.26]} color="#40b8d0" />
      <Voxel position={[0, 0.48, 0.02]} size={[0.24, 0.12, 0.2]} color="#50c8e0" />
      <Voxel position={[0, 0.56, 0.02]} size={[0.16, 0.08, 0.14]} color="#60d8f0" />
      {/* shell spots */}
      <Voxel position={[0.08, 0.44, -0.1]}  size={[0.05, 0.05, 0.02]} color="#80e0ff" />
      <Voxel position={[-0.06, 0.52, -0.06]} size={[0.04, 0.04, 0.02]} color="#80e0ff" />
      {/* legs */}
      {[-0.06, 0.02, 0.1].map((zo, i) => (
        <React.Fragment key={`cl${i}`}>
          <Voxel position={[-0.24, 0.15, zo]} size={[0.1, 0.04, 0.04]} color="#2080a0" />
          <Voxel position={[0.24, 0.15, zo]}  size={[0.1, 0.04, 0.04]} color="#2080a0" />
        </React.Fragment>
      ))}
      {/* claws */}
      <Voxel position={[-0.24, 0.24, -0.14]} size={[0.1, 0.06, 0.06]} color="#2090b0" />
      <Voxel position={[-0.32, 0.26, -0.14]} size={[0.06, 0.03, 0.07]} color="#30a0c0" />
      <Voxel position={[-0.32, 0.22, -0.14]} size={[0.06, 0.03, 0.07]} color="#30a0c0" />
      <Voxel position={[0.24, 0.24, -0.14]}  size={[0.1, 0.06, 0.06]} color="#2090b0" />
      <Voxel position={[0.32, 0.26, -0.14]}  size={[0.06, 0.03, 0.07]} color="#30a0c0" />
      <Voxel position={[0.32, 0.22, -0.14]}  size={[0.06, 0.03, 0.07]} color="#30a0c0" />
    </group>
  )
}
