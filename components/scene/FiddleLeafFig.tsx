import React, { useMemo } from 'react'
import { mulberry32 } from './krabs/traits'

/* ── Primitives ── */

const LEAF_COLORS = ['#1e5a14', '#2a6a1c', '#205010', '#2d5e18', '#3a7030', '#1a4a0e']
const MIDRIB_COLOR = '#4a8a30'
const TRUNK_COLOR = '#6a5030'
const TRUNK_LIGHT = '#7a6040'
const TRUNK_DARK = '#5a4020'

function Leaf({ length, width, color, rotation }: {
  length: number
  width: number
  color: string
  rotation: [number, number, number]
}) {
  return (
    <group rotation={rotation}>
      {/* leaf blade -- very thin, flat paddle shape */}
      <mesh position={[0, length / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, length, width * 0.06]} />
        <meshLambertMaterial color={color} />
      </mesh>
      {/* midrib -- thin raised line */}
      <mesh position={[0, length / 2, 0]}>
        <boxGeometry args={[width * 0.08, length * 0.85, width * 0.1]} />
        <meshLambertMaterial color={MIDRIB_COLOR} />
      </mesh>
      {/* petiole (leaf stem) connecting to branch */}
      <mesh position={[0, -0.01, 0]} castShadow>
        <boxGeometry args={[width * 0.08, 0.04, width * 0.08]} />
        <meshLambertMaterial color={TRUNK_LIGHT} />
      </mesh>
    </group>
  )
}

// Multi-segment branch: primary stem + optional secondary kink for organic look
function Branch({ length, thickness, color, rotation, kinkAngle, children }: {
  length: number
  thickness: number
  color: string
  rotation: [number, number, number]
  kinkAngle?: number // slight bend mid-branch
  children?: React.ReactNode
}) {
  const seg1Len = kinkAngle ? length * 0.55 : length
  const seg2Len = kinkAngle ? length * 0.45 : 0

  return (
    <group rotation={rotation}>
      {/* node at branch junction (slight thickening) */}
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[thickness * 1.6, thickness * 1.6, thickness * 1.6]} />
        <meshLambertMaterial color={color} />
      </mesh>
      {/* primary segment */}
      <mesh position={[0, seg1Len / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[thickness, seg1Len, thickness]} />
        <meshLambertMaterial color={color} />
      </mesh>
      {kinkAngle ? (
        // secondary segment with slight bend
        <group position={[0, seg1Len, 0]} rotation={[kinkAngle, 0, 0]}>
          <mesh position={[0, seg2Len / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[thickness * 0.9, seg2Len, thickness * 0.9]} />
            <meshLambertMaterial color={color} />
          </mesh>
          <group position={[0, seg2Len, 0]}>
            {children}
          </group>
        </group>
      ) : (
        <group position={[0, length, 0]}>
          {children}
        </group>
      )}
    </group>
  )
}

/* ── Pot ── */

function Pot({ size, style, color, heightScale = 1 }: {
  size: number
  style: 'concrete' | 'terracotta'
  color?: string
  heightScale?: number
}) {
  const s = size
  const h = heightScale
  const c = color || (style === 'concrete' ? '#808080' : '#a0683a')
  const rim = style === 'concrete' ? '#707070' : '#8b5a2a'
  return (
    <>
      <mesh position={[0, s * 0.3 * h, 0]} castShadow receiveShadow>
        <boxGeometry args={[s * 1.1, s * 0.6 * h, s * 1.1]} />
        <meshLambertMaterial color={c} />
      </mesh>
      <mesh position={[0, s * 0.6 * h + s * 0.02, 0]} castShadow>
        <boxGeometry args={[s * 1.0, s * 0.08, s * 1.0]} />
        <meshLambertMaterial color={rim} />
      </mesh>
      <mesh position={[0, s * 0.6 * h + s * 0.02, 0]}>
        <boxGeometry args={[s * 0.8, s * 0.06, s * 0.8]} />
        <meshLambertMaterial color="#4a3a2a" />
      </mesh>
    </>
  )
}

/* ── Multi-segment trunk ── */

function Trunk({ height, baseThickness, segments, rng }: {
  height: number
  baseThickness: number
  segments: number
  rng: () => number
}) {
  const segs: React.ReactNode[] = []
  const segHeight = height / segments

  for (let i = 0; i < segments; i++) {
    // taper: thicker at base, thinner at top
    const t = i / segments
    const thick = baseThickness * (1 - t * 0.4)
    // slight random offset for organic wobble
    const ox = (rng() - 0.5) * 0.015
    const oz = (rng() - 0.5) * 0.015
    const color = i % 2 === 0 ? TRUNK_COLOR : TRUNK_LIGHT

    segs.push(
      <mesh key={`trunk-${i}`}
        position={[ox, segHeight * i + segHeight / 2, oz]}
        castShadow receiveShadow
      >
        <boxGeometry args={[thick, segHeight + 0.005, thick]} />
        <meshLambertMaterial color={color} />
      </mesh>
    )
  }

  return <>{segs}</>
}

/* ── Main Component ── */

export interface FiddleLeafFigProps {
  position: [number, number, number]
  maturity?: number
  scale?: number
  potColor?: string
  potStyle?: 'concrete' | 'terracotta'
  potHeightScale?: number
  seed?: number
}

export function FiddleLeafFig({
  position,
  maturity = 0.6,
  scale = 1,
  potColor,
  potStyle = 'concrete',
  potHeightScale = 1,
  seed = 0,
}: FiddleLeafFigProps) {
  const tree = useMemo(() => {
    const rng = mulberry32(seed)

    const potSize = 0.25 + maturity * 0.15
    const trunkHeight = 0.4 + maturity * 1.2
    const branchCount = Math.max(3, Math.floor(3 + maturity * 8))
    const trunkThickness = 0.025 + maturity * 0.015
    const trunkSegments = 3 + Math.floor(maturity * 4) // 3-7 segments

    // pre-generate Y-rotations and shuffle
    const yRots: number[] = []
    for (let i = 0; i < branchCount; i++) {
      yRots.push((i / branchCount) * Math.PI * 2 + (rng() - 0.5) * 0.6)
    }
    for (let i = yRots.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[yRots[i], yRots[j]] = [yRots[j], yRots[i]]
    }

    // generate branches
    const branches: React.ReactNode[] = []
    for (let i = 0; i < branchCount; i++) {
      const t = 0.08 + (i / branchCount) * 0.85
      const branchY = t * trunkHeight + potSize * 0.7

      const yRot = yRots[i]
      // lower branches lean more, upper branches are more upright
      const zRot = (0.25 + rng() * 0.35) * (1.3 - t * 0.6)
      const branchLen = 0.1 + rng() * 0.18
      // lower branches thicker
      const branchThick = (0.025 + maturity * 0.012) * (1.2 - t * 0.4)
      // most branches get a slight kink for organic look
      const kink = rng() > 0.3 ? (rng() - 0.5) * 0.4 : undefined

      // leaves at the tip: 3-5
      const leafCount = 3 + Math.floor(rng() * 2.5)
      const leaves: React.ReactNode[] = []
      for (let j = 0; j < leafCount; j++) {
        const leafLen = 0.16 + rng() * 0.12
        const leafWid = leafLen * (0.7 + rng() * 0.2)
        const leafColor = LEAF_COLORS[Math.floor(rng() * LEAF_COLORS.length)]
        const leafYRot = (j / leafCount) * Math.PI * 2 + (rng() - 0.5) * 0.6
        // upper leaves more upright, lower leaves droop more
        const leafTilt = 0.15 + rng() * 0.45 + (1 - t) * 0.2
        const offsetR = 0.02 + rng() * 0.03
        const ox = Math.sin(leafYRot) * offsetR
        const oz = Math.cos(leafYRot) * offsetR
        const oy = (rng() - 0.5) * 0.03
        leaves.push(
          <group key={`l-${i}-${j}`} position={[ox, oy, oz]} rotation={[0, leafYRot, 0]}>
            <Leaf
              length={leafLen}
              width={leafWid}
              color={leafColor}
              rotation={[leafTilt, 0, (rng() - 0.5) * 0.25]}
            />
          </group>
        )
      }

      branches.push(
        <group key={`b-${i}`} position={[0, branchY, 0]} rotation={[0, yRot, 0]}>
          <Branch
            length={branchLen}
            thickness={branchThick}
            color={i % 3 === 0 ? TRUNK_DARK : TRUNK_COLOR}
            rotation={[0, 0, zRot]}
            kinkAngle={kink}
          >
            {leaves}
          </Branch>
        </group>
      )
    }

    // trunk leaves: a few leaves growing directly off the main stem
    const trunkLeaves: React.ReactNode[] = []
    const trunkLeafCount = 1 + Math.floor(maturity * 3)
    for (let i = 0; i < trunkLeafCount; i++) {
      const ly = potSize * 0.7 + trunkHeight * (0.15 + rng() * 0.7)
      const lYRot = rng() * Math.PI * 2
      const leafLen = 0.12 + rng() * 0.1
      const leafWid = leafLen * 0.75
      const leafColor = LEAF_COLORS[Math.floor(rng() * LEAF_COLORS.length)]
      trunkLeaves.push(
        <group key={`tl-${i}`} position={[0, ly, 0]} rotation={[0, lYRot, 0]}>
          <Leaf
            length={leafLen}
            width={leafWid}
            color={leafColor}
            rotation={[0.4 + rng() * 0.3, 0, 0.3 + rng() * 0.2]}
          />
        </group>
      )
    }

    // top crown
    const crownLeaves: React.ReactNode[] = []
    const crownCount = 2 + Math.floor(maturity * 3)
    for (let i = 0; i < crownCount; i++) {
      const leafLen = 0.1 + rng() * 0.08
      const leafWid = leafLen * 0.6
      const leafColor = LEAF_COLORS[Math.floor(rng() * LEAF_COLORS.length)]
      const cYRot = (i / crownCount) * Math.PI * 2 + (rng() - 0.5) * 0.5
      crownLeaves.push(
        <group key={`crown-${i}`} rotation={[0, cYRot, 0]}>
          <Leaf
            length={leafLen}
            width={leafWid}
            color={leafColor}
            rotation={[0.1 + rng() * 0.3, 0, (rng() - 0.5) * 0.2]}
          />
        </group>
      )
    }

    // consume a few rng calls for trunk segment wobble (need rng instance for Trunk)
    const trunkRngSeed = Math.floor(rng() * 100000)

    return { potSize, trunkHeight, trunkThickness, trunkSegments, trunkRngSeed, branches, trunkLeaves, crownLeaves }
  }, [seed, maturity])

  // separate rng for trunk segments (deterministic from seed)
  const trunkRng = useMemo(() => mulberry32(tree.trunkRngSeed), [tree.trunkRngSeed])

  return (
    <group position={position} scale={[scale, scale, scale]}>
      <Pot size={tree.potSize} style={potStyle} color={potColor} heightScale={potHeightScale} />

      {/* Multi-segment trunk with taper and wobble */}
      <group position={[0, tree.potSize * 0.7, 0]}>
        <Trunk
          height={tree.trunkHeight}
          baseThickness={tree.trunkThickness}
          segments={tree.trunkSegments}
          rng={trunkRng}
        />
      </group>

      {/* Branches with leaves */}
      {tree.branches}

      {/* Leaves growing directly off trunk */}
      {tree.trunkLeaves}

      {/* Crown */}
      <group position={[0, tree.potSize * 0.7 + tree.trunkHeight, 0]}>
        {tree.crownLeaves}
      </group>
    </group>
  )
}
