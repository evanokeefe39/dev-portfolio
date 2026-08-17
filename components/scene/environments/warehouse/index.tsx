import React from 'react'
import { EffectComposer, Noise, Vignette, Scanline, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { Floor, Walls, Windows, SupportBeams, Mezzanine } from './Room'
import { HotDesks, DeskChairs, LoungeArea, BackWallCabinets, MezzanineOffice, Kitchen } from './Furniture'
import { PendantLights, Ductwork, Whiteboard, WarehousePlants, IndustrialShelf } from './Decor'
import { Daylight } from './Daylight'
import { KrabGeneration } from '../../krabs/generator'

export function WarehouseEnvironment({ hour = 10 }: { hour?: number }) {

  return (
    <>
      <Daylight hour={hour} />

      {/* Room structure */}
      <Floor />
      <Walls />
      <Windows />
      <SupportBeams />
      <Mezzanine />

      {/* Furniture */}
      <HotDesks />
      <DeskChairs />
      <LoungeArea />
      <BackWallCabinets />
      <MezzanineOffice />
      <Kitchen />

      {/* Decor */}
      <PendantLights />
      <Ductwork />
      <Whiteboard />
      <WarehousePlants />

      {/* Krabs */}
      <KrabGeneration count={15} seed={77} />

      {/* Post-processing -- GodRays removed (caused WebGL errors and washed out shadows) */}
      <EffectComposer>
        <Noise opacity={0.003} blendFunction={BlendFunction.ADD} />
        <Scanline density={2} blendFunction={BlendFunction.OVERLAY} opacity={0.03} />
        <ChromaticAberration offset={[0.0003, 0.0003]} />
        <Vignette eskil={false} offset={0.3} darkness={0.15} />
      </EffectComposer>
    </>
  )
}

export const WAREHOUSE_CONFIG = {
  background: '#e8e0d0',
  camera: { position: [12, 12, 12] as [number, number, number], zoom: 35 },
  orbitTarget: [0, 1, 0] as [number, number, number],
}
