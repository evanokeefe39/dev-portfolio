import React from 'react'
import { KrazyKrab } from './KrazyKrab'
import {
  SpiralShell, SpikyShell, CoralShell, CrystalShell, MushroomShell,
  TreasureShell, SkullShell, BonsaiShell, DiscoShell, VolcanoShell,
  IceCastleShell, BeehiveShell, AquariumShell, UfoShell, CactusShell,
  BoomboxShell, PumpkinShell, GlobeShell,
} from './shells'

export function RedKrab() {
  return <KrazyKrab
    path={[
      [1.5, -1.5], [1.5, 0.0], [0.0, 0.5], [-2.0, 0.5],
      [-2.0, 1.5], [0.0, 1.5], [1.5, 1.0], [1.5, -1.5],
    ]}
    speed={0.45} pause={0.6} scale={1.0} legRate={14} snapRate={3}
    bodyWidth={1.0} bodyDepth={1.0} clawScale={1.0} legLen={1.0} eyeStalk={1.0}
    bodyColor="#c44030" bodyLight="#d04838" legColor="#c44030" legDark="#b03828"
    clawColor="#d05040" clawTip="#e06050" eyeColor="#111111"
    shell={SpiralShell}
  />
}

export function PurplePunkKrab() {
  return <KrazyKrab
    path={[
      [-2.0, -1.8], [-0.5, -1.8], [0.5, -0.5], [1.5, -1.5],
      [2.0, 0.0], [0.5, 1.5], [-1.5, 1.0], [-2.0, -1.8],
    ]}
    speed={0.6} pause={0.3} scale={0.75} legRate={18} snapRate={5}
    bodyWidth={0.8} bodyDepth={0.9} clawScale={1.4} legLen={0.7} eyeStalk={0.6}
    bodyColor="#3a2050" bodyLight="#4a2860" legColor="#3a2050" legDark="#2a1840"
    clawColor="#5a3070" clawTip="#7a48a0" eyeColor="#ff2020"
    shell={SpikyShell}
  />
}

export function CoralKrab() {
  return <KrazyKrab
    path={[
      [0.0, -2.0], [2.0, -2.0], [2.0, 0.0], [1.0, 1.5],
      [-1.0, 1.5], [-2.0, 0.5], [-2.0, -1.0], [0.0, -2.0],
    ]}
    speed={0.3} pause={1.2} scale={1.15} legRate={10} snapRate={1.5}
    bodyWidth={1.4} bodyDepth={1.2} clawScale={0.7} legLen={1.3} eyeStalk={1.4}
    bodyColor="#c88060" bodyLight="#d89070" legColor="#c88060" legDark="#b07050"
    clawColor="#d8a080" clawTip="#e8b090" eyeColor="#1a3a1a"
    shell={CoralShell}
  />
}

export function CrystalKrab() {
  return <KrazyKrab
    path={[
      [-0.5, -2.2], [1.0, -1.5], [2.0, -0.5], [1.5, 1.0],
      [0.0, 2.0], [-1.5, 1.0], [-2.2, -0.5], [-0.5, -2.2],
    ]}
    speed={0.55} pause={0.8} scale={0.65} legRate={16} snapRate={4}
    bodyWidth={0.7} bodyDepth={0.7} clawScale={0.8} legLen={0.6} eyeStalk={1.8}
    bodyColor="#4060a0" bodyLight="#5070b0" legColor="#4060a0" legDark="#3050a0"
    clawColor="#5080c0" clawTip="#80c0ff" eyeColor="#80c0ff"
    shell={CrystalShell}
  />
}

export function MushroomKrab() {
  return <KrazyKrab
    path={[
      [2.0, 1.8], [0.5, 2.0], [-1.0, 1.0], [-2.2, 0.0],
      [-1.5, -1.5], [0.5, -1.0], [2.0, 0.0], [2.0, 1.8],
    ]}
    speed={0.35} pause={1.5} scale={0.9} legRate={8} snapRate={1}
    bodyWidth={1.3} bodyDepth={1.1} clawScale={0.5} legLen={0.8} eyeStalk={0.5}
    bodyColor="#a07050" bodyLight="#b08060" legColor="#a07050" legDark="#906040"
    clawColor="#b08060" clawTip="#c09070" eyeColor="#202020"
    shell={MushroomShell}
  />
}

export function TreasureKrab() {
  return <KrazyKrab
    path={[
      [-1.0, 1.5], [1.0, 1.5], [2.0, 0.5], [1.5, -1.0],
      [-0.5, -2.0], [-2.0, -1.5], [-2.2, 0.5], [-1.0, 1.5],
    ]}
    speed={0.4} pause={0.5} scale={0.8} legRate={12} snapRate={6}
    bodyWidth={1.1} bodyDepth={0.8} clawScale={1.8} legLen={0.9} eyeStalk={0.8}
    bodyColor="#c0a030" bodyLight="#d0b040" legColor="#c0a030" legDark="#a08020"
    clawColor="#d0b040" clawTip="#ffd700" eyeColor="#111111"
    shell={TreasureShell}
  />
}

export function SkullKrab() {
  return <KrazyKrab
    path={[
      [0.0, 0.0], [1.5, -0.5], [2.0, -2.0], [0.0, -2.2],
      [-2.0, -2.0], [-2.2, 0.0], [-1.0, 1.5], [0.0, 0.0],
    ]}
    speed={0.5} pause={0.4} scale={0.85} legRate={15} snapRate={2}
    bodyWidth={0.9} bodyDepth={1.3} clawScale={1.2} legLen={1.4} eyeStalk={1.6}
    bodyColor="#2a2a2a" bodyLight="#3a3a3a" legColor="#2a2a2a" legDark="#1a1a1a"
    clawColor="#3a3a3a" clawTip="#5a5a5a" eyeColor="#ff2020"
    shell={SkullShell}
  />
}

export function BonsaiKrab() {
  return <KrazyKrab
    path={[
      [1.0, -0.5], [2.0, 1.0], [0.5, 2.0], [-1.5, 2.0],
      [-2.2, 0.5], [-1.5, -1.5], [0.5, -2.2], [1.0, -0.5],
    ]}
    speed={0.25} pause={2.0} scale={1.0} legRate={9} snapRate={1.5}
    bodyWidth={1.2} bodyDepth={1.3} clawScale={0.6} legLen={1.1} eyeStalk={1.2}
    bodyColor="#607050" bodyLight="#708060" legColor="#607050" legDark="#506040"
    clawColor="#708060" clawTip="#90a080" eyeColor="#1a2a1a"
    shell={BonsaiShell}
  />
}

export function DiscoKrab() {
  return <KrazyKrab
    path={[
      [0.5, 0.0], [2.0, 0.5], [1.0, 2.0], [-0.5, 1.5],
      [-2.0, 2.0], [-1.5, 0.0], [-0.5, -2.0], [0.5, 0.0],
    ]}
    speed={0.7} pause={0.2} scale={0.7} legRate={20} snapRate={7}
    bodyWidth={0.85} bodyDepth={0.85} clawScale={0.9} legLen={0.7} eyeStalk={1.0}
    bodyColor="#808080" bodyLight="#a0a0a0" legColor="#808080" legDark="#606060"
    clawColor="#c0c0c0" clawTip="#ffffff" eyeColor="#ff00ff"
    shell={DiscoShell}
  />
}

export function VolcanoKrab() {
  return <KrazyKrab
    path={[
      [-1.0, -0.5], [0.5, -2.2], [2.2, -1.0], [1.5, 0.5],
      [2.2, 2.0], [0.0, 1.0], [-2.0, 1.5], [-1.0, -0.5],
    ]}
    speed={0.4} pause={0.8} scale={1.0} legRate={12} snapRate={2}
    bodyWidth={1.3} bodyDepth={1.0} clawScale={1.5} legLen={1.0} eyeStalk={0.7}
    bodyColor="#8a3020" bodyLight="#a04030" legColor="#8a3020" legDark="#6a2010"
    clawColor="#a04030" clawTip="#c06040" eyeColor="#ff4400"
    shell={VolcanoShell}
  />
}

export function IceKrab() {
  return <KrazyKrab
    path={[
      [1.5, 1.5], [-0.5, 2.0], [-2.2, 1.0], [-1.5, -1.0],
      [0.0, -2.2], [2.0, -1.5], [2.2, 0.5], [1.5, 1.5],
    ]}
    speed={0.35} pause={1.0} scale={0.85} legRate={11} snapRate={2}
    bodyWidth={0.9} bodyDepth={1.1} clawScale={1.1} legLen={1.2} eyeStalk={1.3}
    bodyColor="#90c0d0" bodyLight="#a0d0e0" legColor="#90c0d0" legDark="#80b0c0"
    clawColor="#b0d8e8" clawTip="#d0f0ff" eyeColor="#4080ff"
    shell={IceCastleShell}
  />
}

export function BeeKrab() {
  return <KrazyKrab
    path={[
      [-0.5, 1.0], [1.0, 0.5], [2.2, -0.5], [1.0, -2.0],
      [-1.0, -2.2], [-2.2, -0.5], [-1.5, 1.5], [-0.5, 1.0],
    ]}
    speed={0.5} pause={0.6} scale={0.75} legRate={13} snapRate={4}
    bodyWidth={1.1} bodyDepth={0.9} clawScale={0.6} legLen={0.8} eyeStalk={0.9}
    bodyColor="#c0a020" bodyLight="#d0b030" legColor="#c0a020" legDark="#a08010"
    clawColor="#d0b030" clawTip="#e0c040" eyeColor="#111111"
    shell={BeehiveShell}
  />
}

export function AquariumKrab() {
  return <KrazyKrab
    path={[
      [0.0, 1.5], [-1.5, 0.5], [-2.0, -1.5], [0.0, -1.0],
      [1.5, -2.0], [2.2, 0.0], [1.0, 1.5], [0.0, 1.5],
    ]}
    speed={0.3} pause={1.5} scale={0.95} legRate={9} snapRate={1}
    bodyWidth={1.5} bodyDepth={0.8} clawScale={0.4} legLen={1.5} eyeStalk={2.0}
    bodyColor="#5090a0" bodyLight="#60a0b0" legColor="#5090a0" legDark="#408090"
    clawColor="#60a0b0" clawTip="#80c0d0" eyeColor="#1a3a4a"
    shell={AquariumShell}
  />
}

export function UfoKrab() {
  return <KrazyKrab
    path={[
      [0.5, -1.0], [2.0, -2.0], [2.2, 0.5], [0.5, 2.0],
      [-1.5, 2.2], [-2.2, 0.0], [-1.0, -2.0], [0.5, -1.0],
    ]}
    speed={0.8} pause={0.15} scale={0.6} legRate={22} snapRate={8}
    bodyWidth={0.7} bodyDepth={0.7} clawScale={0.5} legLen={0.5} eyeStalk={2.2}
    bodyColor="#606068" bodyLight="#707078" legColor="#606068" legDark="#505058"
    clawColor="#808088" clawTip="#a0a0a8" eyeColor="#00ff00"
    shell={UfoShell}
  />
}

export function CactusKrab() {
  return <KrazyKrab
    path={[
      [-2.0, 0.0], [-0.5, -1.5], [1.5, -2.0], [2.2, -0.5],
      [1.5, 1.5], [-0.5, 2.2], [-2.2, 1.0], [-2.0, 0.0],
    ]}
    speed={0.2} pause={2.5} scale={0.9} legRate={7} snapRate={0.8}
    bodyWidth={1.0} bodyDepth={1.2} clawScale={0.7} legLen={1.0} eyeStalk={0.6}
    bodyColor="#5a7a40" bodyLight="#6a8a50" legColor="#5a7a40" legDark="#4a6a30"
    clawColor="#6a8a50" clawTip="#8aaa70" eyeColor="#1a2a0a"
    shell={CactusShell}
  />
}

export function BoomboxKrab() {
  return <KrazyKrab
    path={[
      [1.0, 1.0], [-1.0, 2.0], [-2.2, 0.5], [-1.0, -1.5],
      [0.5, -2.2], [2.2, -1.0], [2.0, 0.5], [1.0, 1.0],
    ]}
    speed={0.55} pause={0.4} scale={0.8} legRate={16} snapRate={5}
    bodyWidth={0.9} bodyDepth={1.0} clawScale={1.3} legLen={0.85} eyeStalk={1.0}
    bodyColor="#1a1a1a" bodyLight="#2a2a2a" legColor="#1a1a1a" legDark="#0a0a0a"
    clawColor="#2a2a2a" clawTip="#4a4a4a" eyeColor="#ff4040"
    shell={BoomboxShell}
  />
}


export function GlobeKrab() {
  return <KrazyKrab
    path={[
      [0.0, 0.5], [1.5, -0.5], [1.0, -2.2], [-1.0, -1.5],
      [-2.2, 0.0], [-1.5, 2.0], [0.5, 2.2], [0.0, 0.5],
    ]}
    speed={0.35} pause={1.0} scale={0.85} legRate={10} snapRate={2}
    bodyWidth={1.0} bodyDepth={1.0} clawScale={0.8} legLen={1.1} eyeStalk={1.3}
    bodyColor="#2a4a6a" bodyLight="#3a5a7a" legColor="#2a4a6a" legDark="#1a3a5a"
    clawColor="#3a5a7a" clawTip="#5a7a9a" eyeColor="#2060c0"
    shell={GlobeShell}
  />
}

export function ClassicKrabs() {
  return (
    <>
      <RedKrab />
      <PurplePunkKrab />
      <CoralKrab />
      <CrystalKrab />
      <MushroomKrab />
      <TreasureKrab />
      <SkullKrab />
      <BonsaiKrab />
      <DiscoKrab />
      <VolcanoKrab />
      <IceKrab />
      <BeeKrab />
      <AquariumKrab />
      <UfoKrab />
      <CactusKrab />
      <BoomboxKrab />
      <GlobeKrab />
    </>
  )
}
