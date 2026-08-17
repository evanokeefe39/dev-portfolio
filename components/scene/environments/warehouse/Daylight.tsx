import React, { useMemo, useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Simulates indoor daylight for an enclosed room with windows on 3 walls.
 * +X axis = northeast. Sun rises from +X, peaks overhead, sets toward -X.
 *
 * Wall window normals (facing inward):
 *   Back wall  (z=-6): faces +Z (southeast)
 *   Left wall  (x=-6): faces +X (northeast)
 *   Right wall (z=+6): faces -Z (northwest)
 */

function lerpColor(a: string, b: string, t: number): string {
  const parse = (c: string) => [
    parseInt(c.slice(1, 3), 16),
    parseInt(c.slice(3, 5), 16),
    parseInt(c.slice(5, 7), 16),
  ]
  const ca = parse(a)
  const cb = parse(b)
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t)
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t)
  const b_ = Math.round(ca[2] + (cb[2] - ca[2]) * t)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b_.toString(16).padStart(2, '0')}`
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

interface DaylightParams {
  sunDir: [number, number, number]
  sunColor: string
  sunIntensity: number
  ambientColor: string
  ambientIntensity: number
  bgColor: string
  backWallExposure: number
  leftWallExposure: number
  rightWallExposure: number
  sunMeshPos: [number, number, number]
  vignetteStrength: number
}

function computeDaylight(hour: number): DaylightParams {
  const sunAngle = ((hour - 6) / 12) * Math.PI
  const sunElevation = Math.sin(sunAngle)
  const sunHorizontal = Math.cos(sunAngle)

  // Sun arcs from -Z (morning) through overhead to +Z (evening), always from -X side.
  // Light comes through the left wall (x=-6) windows for most of the day,
  // casting Crittall grid shadows across the lounge/couch area.
  const sunDir: [number, number, number] = [
    0.6,
    Math.max(0.05, sunElevation),
    sunHorizontal * -0.7,
  ]

  const len = Math.sqrt(sunDir[0] ** 2 + sunDir[1] ** 2 + sunDir[2] ** 2)
  sunDir[0] /= len
  sunDir[1] /= len
  sunDir[2] /= len

  const sunDist = 10
  const dirLightPos: [number, number, number] = [
    -sunDir[0] * sunDist,
    sunDir[1] * sunDist,
    -sunDir[2] * sunDist,
  ]

  const backNormal = [0, 0, 1]
  const leftNormal = [1, 0, 0]
  const rightNormal = [0, 0, -1]

  const horizLen = Math.sqrt(sunDir[0] ** 2 + sunDir[2] ** 2)
  const horizDir = horizLen > 0 ? [sunDir[0] / horizLen, sunDir[2] / horizLen] : [0, 0]

  const dotBack = Math.max(0, horizDir[0] * backNormal[0] + horizDir[1] * backNormal[2])
  const dotLeft = Math.max(0, horizDir[0] * leftNormal[0] + horizDir[1] * leftNormal[2])
  const dotRight = Math.max(0, horizDir[0] * rightNormal[0] + horizDir[1] * rightNormal[2])

  const elevFactor = Math.max(0, sunElevation)
  const isNight = hour < 5.5 || hour > 18.5
  const dawnDusk = (hour >= 5.5 && hour < 7) || (hour > 17 && hour <= 18.5)

  let sunColor: string
  let ambientColor: string
  let bgColor: string

  if (isNight) {
    sunColor = '#1a2040'
    ambientColor = '#151520'
    bgColor = '#1a1a28'
  } else if (hour < 7) {
    const t = (hour - 5.5) / 1.5
    sunColor = lerpColor('#ff8040', '#ffb870', t)
    ambientColor = lerpColor('#2a2030', '#c0a898', t)
    bgColor = lerpColor('#3a2828', '#d8c8b8', t)
  } else if (hour < 9) {
    const t = (hour - 7) / 2
    sunColor = lerpColor('#ffb870', '#ffe8c0', t)
    ambientColor = lerpColor('#c0a898', '#d8d4cc', t)
    bgColor = lerpColor('#d8c8b8', '#e8e0d0', t)
  } else if (hour < 16) {
    sunColor = '#ffe8c0'
    ambientColor = '#d8d4cc'
    bgColor = '#e8e0d0'
  } else if (hour < 17) {
    const t = (hour - 16)
    sunColor = lerpColor('#ffe8c0', '#ffb870', t)
    ambientColor = lerpColor('#d8d4cc', '#c8b8a0', t)
    bgColor = lerpColor('#e8e0d0', '#e0d0c0', t)
  } else if (hour <= 18.5) {
    const t = (hour - 17) / 1.5
    sunColor = lerpColor('#ffb870', '#ff6030', t)
    ambientColor = lerpColor('#c8b8a0', '#2a2030', t)
    bgColor = lerpColor('#e0d0c0', '#3a2828', t)
  } else {
    sunColor = '#1a2040'
    ambientColor = '#151520'
    bgColor = '#1a1a28'
  }

  const sunIntensity = isNight ? 0 : elevFactor * (dawnDusk ? 0.6 : 1.4)
  const ambientIntensity = isNight ? 0.05 : lerp(0.2, 0.45, elevFactor)

  const sunMeshPos: [number, number, number] = [
    Math.max(-8, Math.min(8, -sunDir[0] * 12)),
    Math.max(1.5, Math.min(3.5, sunDir[1] * 3 + 2)),
    Math.max(-8, Math.min(8, -sunDir[2] * 12)),
  ]

  return {
    sunDir: dirLightPos,
    sunColor,
    sunIntensity,
    ambientColor,
    ambientIntensity,
    bgColor,
    backWallExposure: dotBack * elevFactor,
    leftWallExposure: dotLeft * elevFactor,
    rightWallExposure: dotRight * elevFactor,
    sunMeshPos,
    vignetteStrength: isNight ? 0.4 : 0.15,
  }
}

export function Daylight({ hour }: { hour: number }) {
  const d = useMemo(() => computeDaylight(hour), [hour])
  const lightRef = useRef<THREE.DirectionalLight>(null!)
  const targetRef = useRef<THREE.Object3D>(null!)
  const { gl } = useThree()

  // Imperatively update the light and force renderer-level shadow map recalculation
  useEffect(() => {
    const light = lightRef.current
    const target = targetRef.current
    if (!light || !target) return

    light.position.set(d.sunDir[0], d.sunDir[1], d.sunDir[2])
    light.intensity = d.sunIntensity
    light.color.set(d.sunColor)

    target.position.set(0, 0, 0)
    light.target = target
    light.target.updateMatrixWorld()
    light.updateMatrixWorld()

    light.shadow.camera.left = -10
    light.shadow.camera.right = 10
    light.shadow.camera.top = 10
    light.shadow.camera.bottom = -10
    light.shadow.camera.near = 0.1
    light.shadow.camera.far = 30
    light.shadow.camera.updateProjectionMatrix()

    // Force renderer to re-render ALL shadow maps
    gl.shadowMap.needsUpdate = true
  }, [d, gl])

  const baseIntensity = 6.0

  return (
    <>
      <color attach="background" args={[d.bgColor]} />

      <ambientLight intensity={d.ambientIntensity} color={d.ambientColor} />
      {/* Hemisphere light simulates indoor bounce — sky color from windows, ground bounce from floor */}
      <hemisphereLight
        args={[d.sunColor, '#a09080', d.ambientIntensity * 0.4]}
      />

      {/* Target object must be in scene for directional light shadow orientation */}
      <object3D ref={targetRef} position={[0, 0, 0]} />
      <directionalLight
        ref={lightRef}
        position={d.sunDir}
        intensity={d.sunIntensity}
        color={d.sunColor}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
      />

      {/* Back wall window (z=-5) */}
      <pointLight
        position={[1.5, 2.5, -5.0]}
        intensity={baseIntensity * Math.max(0.1, d.backWallExposure)}
        color={d.sunColor}
        distance={16}
        decay={1.0}
      />

      {/* Left wall window (x=-5) */}
      <pointLight
        position={[-5.0, 2.5, 0.5]}
        intensity={baseIntensity * 1.2 * Math.max(0.1, d.leftWallExposure)}
        color={d.sunColor}
        distance={16}
        decay={1.0}
      />

      {/* Right wall window (z=+5) */}
      <pointLight
        position={[0.5, 2.5, 5.0]}
        intensity={baseIntensity * Math.max(0.1, d.rightWallExposure)}
        color={d.sunColor}
        distance={16}
        decay={1.0}
      />

      {/* Shadow-only roof — blocks direct sun, invisible to camera */}
      <mesh position={[0, 4.95, 0]} castShadow receiveShadow={false}>
        <boxGeometry args={[12.2, 0.1, 12.2]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>

      {/* Shadow-only front wall — blocks light from camera side, invisible */}
      <mesh position={[5.95, 2.5, 0]} castShadow receiveShadow={false}>
        <boxGeometry args={[0.1, 5, 12.2]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
    </>
  )
}

export function getSunMeshPosition(hour: number): [number, number, number] {
  return computeDaylight(hour).sunMeshPos
}

export function getSunColor(hour: number): string {
  return computeDaylight(hour).sunColor
}
