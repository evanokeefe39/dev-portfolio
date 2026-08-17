import React, { useMemo } from 'react'
import { KrazyKrab } from './KrazyKrab'
import { generateTraits, generatePath } from './traits'

export function GeneratedKrab({ seed }: { seed: number }) {
  const config = useMemo(() => {
    const traits = generateTraits(seed)
    const path = generatePath(seed)
    return {
      name: traits.name,
      path,
      speed: traits.temperament.speed,
      pause: traits.temperament.pause,
      scale: traits.size.scale,
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
    }
  }, [seed])

  return <KrazyKrab {...config} />
}

export function KrabGeneration({ count, seed }: { count: number; seed: number }) {
  const seeds = useMemo(() => {
    return Array.from({ length: count }, (_, i) => seed * 1000 + i)
  }, [count, seed])

  return (
    <>
      {seeds.map((s) => (
        <GeneratedKrab key={s} seed={s} />
      ))}
    </>
  )
}
