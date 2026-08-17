import React, { useMemo } from 'react'
import * as THREE from 'three'

// Module-level caches -- shared across all Voxel instances, persist for app lifetime
const geometryCache = new Map<string, THREE.BoxGeometry>()
const materialCache = new Map<string, THREE.MeshLambertMaterial>()

function getGeometry(size: [number, number, number]): THREE.BoxGeometry {
  const key = `${size[0]},${size[1]},${size[2]}`
  let geo = geometryCache.get(key)
  if (!geo) {
    geo = new THREE.BoxGeometry(size[0], size[1], size[2])
    geometryCache.set(key, geo)
  }
  return geo
}

function getMaterial(color: string, transparent?: boolean, opacity?: number): THREE.MeshLambertMaterial {
  const t = transparent ?? false
  const o = opacity ?? 1
  const key = `${color}|${t}|${o}`
  let mat = materialCache.get(key)
  if (!mat) {
    const opts: THREE.MeshLambertMaterialParameters = { color }
    if (t) { opts.transparent = true; opts.opacity = o }
    mat = new THREE.MeshLambertMaterial(opts)
    materialCache.set(key, mat)
  }
  return mat
}

export interface VoxelProps {
  position: [number, number, number]
  size?: [number, number, number]
  color: string
  castShadow?: boolean
  transparent?: boolean
  opacity?: number
}

export function Voxel({ position, size = [1, 1, 1], color, castShadow = true, transparent, opacity }: VoxelProps) {
  const geometry = useMemo(() => getGeometry(size), [size[0], size[1], size[2]])
  const material = useMemo(() => getMaterial(color, transparent, opacity), [color, transparent, opacity])

  return (
    <mesh position={position} castShadow={castShadow} receiveShadow geometry={geometry} material={material} />
  )
}
