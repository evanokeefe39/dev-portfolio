import React, { createContext, useContext, useState, useCallback } from 'react'
import { Mesh } from 'three'
import { GodRays } from '@react-three/postprocessing'

const SunMeshContext = createContext<Mesh | null>(null)

export function SunMeshProvider({
  children,
  position = [2, 4, -8],
  color = '#ffe0a0',
}: {
  children: React.ReactNode
  position?: [number, number, number]
  color?: string
}) {
  const [sunMesh, setSunMesh] = useState<Mesh | null>(null)
  const sunRef = useCallback((node: Mesh | null) => {
    if (node) setSunMesh(node)
  }, [])

  return (
    <SunMeshContext.Provider value={sunMesh}>
      <mesh ref={sunRef} position={position} visible={false}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
      {children}
    </SunMeshContext.Provider>
  )
}

export function SunGodRays() {
  const sunMesh = useContext(SunMeshContext)
  if (!sunMesh) return null
  return (
    <GodRays
      sun={sunMesh}
      samples={30}
      density={0.96}
      decay={0.93}
      weight={0.4}
      exposure={0.6}
      clampMax={1}
      blur
    />
  )
}
