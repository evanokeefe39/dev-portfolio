import React from 'react'
import {
  SpiralShell, SpikyShell, CoralShell, CrystalShell, MushroomShell,
  TreasureShell, SkullShell, BonsaiShell, DiscoShell, VolcanoShell,
  IceCastleShell, BeehiveShell, AquariumShell, UfoShell, CactusShell,
  BoomboxShell, GlobeShell,
} from './shells'

/* ── Trait types ── */

export interface PaletteTrait {
  name: string
  bodyColor: string
  bodyLight: string
  legColor: string
  legDark: string
  clawColor: string
  clawTip: string
  eyeColor: string
}

export interface ShellTrait {
  name: string
  shell: React.ReactNode
}

export interface BuildTrait {
  name: string
  bodyWidth: number
  bodyDepth: number
  clawScale: number
  legLen: number
  eyeStalk: number
}

export interface TemperamentTrait {
  name: string
  speed: number
  pause: number
  legRate: number
  snapRate: number
}

export interface SizeTrait {
  name: string
  scale: number
}

export interface KrabTraits {
  palette: PaletteTrait
  shell: ShellTrait
  build: BuildTrait
  temperament: TemperamentTrait
  size: SizeTrait
}

/* ── Trait pools ── */

export const PALETTES: PaletteTrait[] = [
  { name: 'crimson',  bodyColor: '#c44030', bodyLight: '#d04838', legColor: '#c44030', legDark: '#b03828', clawColor: '#d05040', clawTip: '#e06050', eyeColor: '#111111' },
  { name: 'violet',   bodyColor: '#6a30a0', bodyLight: '#7a40b0', legColor: '#6a30a0', legDark: '#5a2090', clawColor: '#8a50c0', clawTip: '#aa70e0', eyeColor: '#ff80ff' },
  { name: 'oceanic',  bodyColor: '#2080a0', bodyLight: '#2890b0', legColor: '#2080a0', legDark: '#106880', clawColor: '#30a0c0', clawTip: '#50c0e0', eyeColor: '#80e0ff' },
  { name: 'golden',   bodyColor: '#c0a030', bodyLight: '#d0b040', legColor: '#c0a030', legDark: '#a08020', clawColor: '#d0b040', clawTip: '#ffd700', eyeColor: '#111111' },
  { name: 'obsidian', bodyColor: '#2a2a2a', bodyLight: '#3a3a3a', legColor: '#2a2a2a', legDark: '#1a1a1a', clawColor: '#3a3a3a', clawTip: '#5a5a5a', eyeColor: '#ff2020' },
  { name: 'frosty',   bodyColor: '#90c0d0', bodyLight: '#a0d0e0', legColor: '#90c0d0', legDark: '#80b0c0', clawColor: '#b0d8e8', clawTip: '#d0f0ff', eyeColor: '#4080ff' },
  { name: 'mossy',    bodyColor: '#607050', bodyLight: '#708060', legColor: '#607050', legDark: '#506040', clawColor: '#708060', clawTip: '#90a080', eyeColor: '#1a2a1a' },
  { name: 'sandy',    bodyColor: '#c88060', bodyLight: '#d89070', legColor: '#c88060', legDark: '#b07050', clawColor: '#d8a080', clawTip: '#e8b090', eyeColor: '#4a2a1a' },
  { name: 'ember',    bodyColor: '#8a3020', bodyLight: '#a04030', legColor: '#8a3020', legDark: '#6a2010', clawColor: '#a04030', clawTip: '#c06040', eyeColor: '#ff4400' },
  { name: 'chrome',   bodyColor: '#808080', bodyLight: '#a0a0a0', legColor: '#808080', legDark: '#606060', clawColor: '#c0c0c0', clawTip: '#ffffff', eyeColor: '#ff00ff' },
  { name: 'midnight', bodyColor: '#1a1a3a', bodyLight: '#2a2a4a', legColor: '#1a1a3a', legDark: '#0a0a2a', clawColor: '#2a2a5a', clawTip: '#4a4a8a', eyeColor: '#8080ff' },
  { name: 'coral',    bodyColor: '#d06060', bodyLight: '#e07070', legColor: '#d06060', legDark: '#b04040', clawColor: '#e08080', clawTip: '#ffa0a0', eyeColor: '#1a1a1a' },
  { name: 'jade',     bodyColor: '#30806a', bodyLight: '#40907a', legColor: '#30806a', legDark: '#20705a', clawColor: '#50a08a', clawTip: '#70c0aa', eyeColor: '#e0ffe0' },
  { name: 'rust',     bodyColor: '#8a5030', bodyLight: '#9a6040', legColor: '#8a5030', legDark: '#6a3020', clawColor: '#a07050', clawTip: '#c09070', eyeColor: '#ffa040' },
  { name: 'arctic',   bodyColor: '#c0d0e0', bodyLight: '#d0e0f0', legColor: '#c0d0e0', legDark: '#a0b0c0', clawColor: '#e0f0ff', clawTip: '#ffffff', eyeColor: '#2060c0' },
  { name: 'toxic',    bodyColor: '#40a030', bodyLight: '#50b040', legColor: '#40a030', legDark: '#308020', clawColor: '#60c050', clawTip: '#80ff60', eyeColor: '#ff00ff' },
]

export const SHELLS: ShellTrait[] = [
  { name: 'spiral',    shell: SpiralShell },
  { name: 'spiked',    shell: SpikyShell },
  { name: 'coral',     shell: CoralShell },
  { name: 'crystal',   shell: CrystalShell },
  { name: 'mushroom',  shell: MushroomShell },
  { name: 'treasure',  shell: TreasureShell },
  { name: 'skull',     shell: SkullShell },
  { name: 'bonsai',    shell: BonsaiShell },
  { name: 'disco',     shell: DiscoShell },
  { name: 'volcano',   shell: VolcanoShell },
  { name: 'ice',       shell: IceCastleShell },
  { name: 'beehive',   shell: BeehiveShell },
  { name: 'aquarium',  shell: AquariumShell },
  { name: 'ufo',       shell: UfoShell },
  { name: 'cactus',    shell: CactusShell },
  { name: 'boombox',   shell: BoomboxShell },
  { name: 'globe',     shell: GlobeShell },
]

/**
 * Subdued shell subset for the data krabs (owner decision 2026-08-18). The
 * loud shells — treasure, skull, disco, volcano, ice, aquarium, ufo, boombox —
 * stay in `SHELLS` for ambient/other uses but are never drawn by a repo's data
 * krab. Ambient krabs (which use the full `generateTraits`) still see the full
 * pool; this constrains only the per-repo data krabs.
 */
export const DATA_KRAB_SHELLS: ShellTrait[] = [
  { name: 'spiral',    shell: SpiralShell },
  { name: 'spiked',    shell: SpikyShell },
  { name: 'coral',     shell: CoralShell },
  { name: 'crystal',   shell: CrystalShell },
  { name: 'mushroom',  shell: MushroomShell },
  { name: 'bonsai',    shell: BonsaiShell },
  { name: 'beehive',   shell: BeehiveShell },
  { name: 'cactus',    shell: CactusShell },
  { name: 'globe',     shell: GlobeShell },
]

export const BUILDS: BuildTrait[] = [
  { name: 'stocky',   bodyWidth: 1.3, bodyDepth: 1.1, clawScale: 1.4, legLen: 0.8, eyeStalk: 0.6 },
  { name: 'lanky',    bodyWidth: 0.8, bodyDepth: 1.2, clawScale: 0.8, legLen: 1.4, eyeStalk: 1.6 },
  { name: 'compact',  bodyWidth: 0.9, bodyDepth: 0.9, clawScale: 1.0, legLen: 0.7, eyeStalk: 0.8 },
  { name: 'hulking',  bodyWidth: 1.5, bodyDepth: 1.3, clawScale: 1.8, legLen: 1.1, eyeStalk: 0.7 },
  { name: 'spindly',  bodyWidth: 0.7, bodyDepth: 0.7, clawScale: 0.5, legLen: 1.5, eyeStalk: 2.0 },
  { name: 'balanced', bodyWidth: 1.0, bodyDepth: 1.0, clawScale: 1.0, legLen: 1.0, eyeStalk: 1.0 },
  { name: 'chunky',   bodyWidth: 1.4, bodyDepth: 1.0, clawScale: 1.2, legLen: 0.9, eyeStalk: 0.5 },
  { name: 'wispy',    bodyWidth: 0.7, bodyDepth: 0.8, clawScale: 0.6, legLen: 1.2, eyeStalk: 1.8 },
]

export const TEMPERAMENTS: TemperamentTrait[] = [
  { name: 'sprinter', speed: 0.75, pause: 0.2, legRate: 20, snapRate: 6 },
  { name: 'crawler',  speed: 0.25, pause: 1.8, legRate: 8,  snapRate: 1 },
  { name: 'twitchy',  speed: 0.55, pause: 0.3, legRate: 22, snapRate: 8 },
  { name: 'lazy',     speed: 0.20, pause: 2.5, legRate: 7,  snapRate: 0.8 },
  { name: 'frantic',  speed: 0.80, pause: 0.15, legRate: 24, snapRate: 7 },
  { name: 'steady',   speed: 0.40, pause: 0.8, legRate: 12, snapRate: 2 },
]

export const SIZES: SizeTrait[] = [
  { name: 'tiny',   scale: 0.5 },
  { name: 'small',  scale: 0.7 },
  { name: 'medium', scale: 0.9 },
  { name: 'large',  scale: 1.1 },
  { name: 'giant',  scale: 1.3 },
]

/* ── Seeded PRNG (mulberry32) ── */

export function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

/* ── Pick from pool using PRNG ── */

export function pickTrait<T>(pool: T[], rng: () => number): T {
  return pool[Math.floor(rng() * pool.length)]
}

/**
 * Deterministic string → 32-bit seed (FNV-1a hash). Used to seed a repo's krab
 * traits from its name so the same repo renders the same krab on every load
 * and across ranges. No dependencies; stable across engines.
 */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/* ── Generate traits from seed ── */

export function generateTraits(seed: number): KrabTraits & { name: string } {
  const rng = mulberry32(seed)
  const palette = pickTrait(PALETTES, rng)
  const shell = pickTrait(SHELLS, rng)
  const build = pickTrait(BUILDS, rng)
  const temperament = pickTrait(TEMPERAMENTS, rng)
  const size = pickTrait(SIZES, rng)
  const name = `${palette.name}-${shell.name}-${temperament.name}`
  return { palette, shell, build, temperament, size, name }
}

/* ── Generate a walk path from seed ── */

export function generatePath(seed: number): [number, number][] {
  const rng = mulberry32(seed + 9999)
  const count = 5 + Math.floor(rng() * 4) // 5-8 waypoints
  const points: [number, number][] = []
  for (let i = 0; i < count; i++) {
    points.push([
      (rng() * 4.4) - 2.2,  // x: -2.2 to 2.2
      (rng() * 4.4) - 2.2,  // z: -2.2 to 2.2
    ])
  }
  return points
}
