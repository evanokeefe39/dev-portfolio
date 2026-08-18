import React, { useMemo } from 'react'
import { KrazyKrab } from './KrazyKrab'
import { generateTraits } from './traits'

// Two idle krabs perched on lounge couch 2 (base at [-5.45, 0.18, 4.0],
// seat top y = 0.54, footprint x ∈ [-5.35, -5.15], z ∈ [3.2, 4.8]).
// They are idle: no horizontal movement by construction, so clipping into
// desks or couch 1 (the spotlight couch) is impossible.
const COUCH_SEATS: [number, number, number][] = [
  [-5.25, 0.54, 3.6],
  [-5.25, 0.54, 4.7],
]
// Any two distinct seeds → different palette/shell/build per krab.
const AMBIENT_SEEDS = [11, 23]

export function AmbientCouchKrabs(): React.JSX.Element {
  return (
    <>
      {COUCH_SEATS.map((position, i) => (
        <AmbientCouchKrab key={i} position={position} seed={AMBIENT_SEEDS[i]} />
      ))}
    </>
  )
}

function AmbientCouchKrab({ position, seed }: { position: [number, number, number]; seed: number }) {
  const config = useMemo(() => {
    const traits = generateTraits(seed)
    return {
      // path is required by KrabConfig but never stepped while idle.
      path: [[0, 0]] as [number, number][],
      speed: traits.temperament.speed,
      pause: traits.temperament.pause,
      scale: traits.size.scale * 0.65,
      legRate: traits.temperament.legRate,
      snapRate: traits.temperament.snapRate,
      bodyColor: traits.palette.bodyColor,
      bodyLight: traits.palette.bodyLight,
      legColor: traits.palette.legColor,
      legDark: traits.palette.legDark,
      clawColor: traits.palette.clawColor,
      clawTip: traits.palette.clawTip,
      eyeColor: traits.palette.eyeColor,
      shell: traits.shell.shell,
      bodyWidth: traits.build.bodyWidth,
      bodyDepth: traits.build.bodyDepth,
      clawScale: traits.build.clawScale,
      legLen: traits.build.legLen,
      eyeStalk: traits.build.eyeStalk,
      idle: true,
    }
  }, [seed])

  return (
    // Facing +x (into the room): rotation.y = -Math.PI/2 per contract.
    <group position={position} rotation={[0, -Math.PI / 2, 0]}>
      <KrazyKrab {...config} />
    </group>
  )
}
