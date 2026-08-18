import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Voxel } from '../Voxel'
import { stepKrab, type KrabStepState } from './walk'

export interface KrabConfig {
  path: [number, number][]
  speed: number
  pause: number
  scale: number
  legRate: number
  snapRate: number
  bodyColor: string
  bodyLight: string
  legColor: string
  legDark: string
  clawColor: string
  clawTip: string
  eyeColor: string
  shell: React.ReactNode
  // proportion overrides (default 1.0)
  bodyWidth?: number    // wider/narrower body
  bodyDepth?: number    // longer/shorter body
  clawScale?: number    // bigger/smaller claws
  legLen?: number       // longer/shorter legs
  eyeStalk?: number     // taller/shorter eye stalks
}

export function KrazyKrab({ path, speed, pause, scale, legRate, snapRate,
  bodyColor, bodyLight, legColor, legDark, clawColor, clawTip, eyeColor, shell,
  bodyWidth: bw = 1, bodyDepth: bd = 1, clawScale: cs = 1, legLen: ll = 1, eyeStalk: es = 1,
}: KrabConfig) {
  const groupRef = useRef<THREE.Group>(null!)
  const leftClaw = useRef<THREE.Group>(null!)
  const rightClaw = useRef<THREE.Group>(null!)
  const legs = [
    useRef<THREE.Group>(null!), useRef<THREE.Group>(null!), useRef<THREE.Group>(null!),
    useRef<THREE.Group>(null!), useRef<THREE.Group>(null!), useRef<THREE.Group>(null!),
  ]

  const state = useRef<KrabStepState>({ pathIndex: 0, progress: 0, pausing: 0, time: 0, activity: 1 })

  const pathLengths = useMemo(() => {
    return path.map((_, i) => {
      const next = path[(i + 1) % path.length]
      const cur = path[i]
      return Math.sqrt((next[0] - cur[0]) ** 2 + (next[1] - cur[1]) ** 2)
    })
  }, [path])

  useFrame((_, delta) => {
    const pose = stepKrab(state.current, path, pathLengths, { speed, pause, legRate, snapRate }, delta)

    if (groupRef.current) {
      groupRef.current.position.set(pose.x, 0, pose.z)
      groupRef.current.rotation.y = pose.rotationY
    }

    for (let i = 0; i < 6; i++) {
      // Legs 0-2 sit on the left, 3-5 on the right: mirror the swing so the
      // gait alternates (original behavior), the pure pose stays unmirrored.
      if (legs[i].current) legs[i].current.rotation.z = i < 3 ? pose.legSwings[i] : -pose.legSwings[i]
    }
    if (leftClaw.current) leftClaw.current.rotation.y = pose.clawSnap
    if (rightClaw.current) rightClaw.current.rotation.y = -pose.clawSnap
  })

  return (
    <group ref={groupRef} scale={[scale, scale, scale]}>
      {/* body */}
      <Voxel position={[0, 0.22, 0]} size={[0.4 * bw, 0.18, 0.3 * bd]} color={bodyColor} />
      <Voxel position={[0, 0.28, 0]} size={[0.36 * bw, 0.12, 0.26 * bd]} color={bodyLight} />

      {/* eyes on stalks */}
      <Voxel position={[-0.12 * bw, 0.33 + 0.06 * es, -0.12 * bd]} size={[0.04, 0.1 * es, 0.04]} color={bodyColor} />
      <Voxel position={[0.12 * bw, 0.33 + 0.06 * es, -0.12 * bd]}  size={[0.04, 0.1 * es, 0.04]} color={bodyColor} />
      <Voxel position={[-0.12 * bw, 0.36 + 0.1 * es, -0.12 * bd]} size={[0.06, 0.06, 0.06]} color={eyeColor} />
      <Voxel position={[0.12 * bw, 0.36 + 0.1 * es, -0.12 * bd]}  size={[0.06, 0.06, 0.06]} color={eyeColor} />
      <Voxel position={[-0.13 * bw, 0.38 + 0.1 * es, -0.14 * bd]} size={[0.02, 0.02, 0.02]} color="#ffffff" />
      <Voxel position={[0.11 * bw, 0.38 + 0.1 * es, -0.14 * bd]}  size={[0.02, 0.02, 0.02]} color="#ffffff" />

      {/* shell (varies per krab) */}
      {shell}

      {/* legs */}
      {[-0.08 * bd, 0.0, 0.08 * bd].map((zOff, i) => (
        <group key={`ll${i}`} ref={legs[i]} position={[-0.2 * bw, 0.18, zOff]}>
          <Voxel position={[-0.08 * ll, -0.04, 0]} size={[0.14 * ll, 0.04, 0.05]} color={legColor} />
          <Voxel position={[-0.16 * ll, -0.06 * ll, 0]} size={[0.04, 0.1 * ll, 0.04]} color={legDark} />
        </group>
      ))}
      {[-0.08 * bd, 0.0, 0.08 * bd].map((zOff, i) => (
        <group key={`rl${i}`} ref={legs[i + 3]} position={[0.2 * bw, 0.18, zOff]}>
          <Voxel position={[0.08 * ll, -0.04, 0]} size={[0.14 * ll, 0.04, 0.05]} color={legColor} />
          <Voxel position={[0.16 * ll, -0.06 * ll, 0]} size={[0.04, 0.1 * ll, 0.04]} color={legDark} />
        </group>
      ))}

      {/* claws */}
      <group ref={leftClaw} position={[-0.22 * bw, 0.24, -0.18 * bd]}>
        <Voxel position={[-0.08 * cs, 0, -0.04]} size={[0.14 * cs, 0.06 * cs, 0.06 * cs]} color={bodyColor} />
        <Voxel position={[-0.18 * cs, 0.03 * cs, -0.04]} size={[0.1 * cs, 0.04 * cs, 0.08 * cs]} color={clawColor} />
        <Voxel position={[-0.18 * cs, -0.03 * cs, -0.04]} size={[0.1 * cs, 0.04 * cs, 0.08 * cs]} color={clawColor} />
        <Voxel position={[-0.24 * cs, 0.02 * cs, -0.04]} size={[0.04 * cs, 0.02 * cs, 0.06 * cs]} color={clawTip} />
        <Voxel position={[-0.24 * cs, -0.02 * cs, -0.04]} size={[0.04 * cs, 0.02 * cs, 0.06 * cs]} color={clawTip} />
      </group>
      <group ref={rightClaw} position={[0.22 * bw, 0.24, -0.18 * bd]}>
        <Voxel position={[0.08 * cs, 0, -0.04]} size={[0.14 * cs, 0.06 * cs, 0.06 * cs]} color={bodyColor} />
        <Voxel position={[0.18 * cs, 0.03 * cs, -0.04]} size={[0.1 * cs, 0.04 * cs, 0.08 * cs]} color={clawColor} />
        <Voxel position={[0.18 * cs, -0.03 * cs, -0.04]} size={[0.1 * cs, 0.04 * cs, 0.08 * cs]} color={clawColor} />
        <Voxel position={[0.24 * cs, 0.02 * cs, -0.04]} size={[0.04 * cs, 0.02 * cs, 0.06 * cs]} color={clawTip} />
        <Voxel position={[0.24 * cs, -0.02 * cs, -0.04]} size={[0.04 * cs, 0.02 * cs, 0.06 * cs]} color={clawTip} />
      </group>
    </group>
  )
}
