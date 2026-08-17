import React from 'react'
import { Voxel } from '../Voxel'

// Classic spiral shell - tall conical with ridges
export const SpiralShell = (
  <>
    <Voxel position={[0, 0.38, 0.02]}  size={[0.38, 0.16, 0.32]} color="#c8a050" />
    <Voxel position={[0, 0.50, 0.02]}  size={[0.34, 0.14, 0.28]} color="#b8944a" />
    <Voxel position={[0, 0.60, 0.02]}  size={[0.28, 0.12, 0.24]} color="#a88040" />
    <Voxel position={[0, 0.68, 0.02]}  size={[0.22, 0.10, 0.20]} color="#987030" />
    <Voxel position={[0, 0.74, 0.02]}  size={[0.16, 0.08, 0.16]} color="#886828" />
    <Voxel position={[0, 0.79, 0.02]}  size={[0.10, 0.06, 0.10]} color="#786020" />
    {/* spiral marks */}
    <Voxel position={[0.08, 0.52, -0.1]}   size={[0.06, 0.06, 0.03]} color="#d4b870" />
    <Voxel position={[-0.06, 0.62, -0.08]} size={[0.06, 0.06, 0.03]} color="#d4b870" />
    <Voxel position={[0.04, 0.70, -0.06]}  size={[0.05, 0.05, 0.03]} color="#d4b870" />
    {/* ridges */}
    <Voxel position={[0, 0.44, -0.14]} size={[0.32, 0.03, 0.03]} color="#b89848" />
    <Voxel position={[0, 0.56, -0.12]} size={[0.26, 0.03, 0.03]} color="#a88840" />
    <Voxel position={[0, 0.66, -0.1]}  size={[0.20, 0.03, 0.03]} color="#987830" />
  </>
)

// Spiky punk shell - wide and covered in spikes
export const SpikyShell = (
  <>
    {/* wide dome base */}
    <Voxel position={[0, 0.36, 0.02]}  size={[0.44, 0.12, 0.36]} color="#4a2a4a" />
    <Voxel position={[0, 0.46, 0.02]}  size={[0.40, 0.12, 0.32]} color="#5a3060" />
    <Voxel position={[0, 0.54, 0.02]}  size={[0.34, 0.10, 0.28]} color="#6a3870" />
    <Voxel position={[0, 0.61, 0.02]}  size={[0.26, 0.08, 0.22]} color="#5a3060" />
    {/* spikes! */}
    <Voxel position={[0, 0.72, 0.02]}     size={[0.06, 0.14, 0.06]} color="#8a48a0" />
    <Voxel position={[-0.14, 0.66, 0.02]} size={[0.06, 0.12, 0.06]} color="#8a48a0" />
    <Voxel position={[0.14, 0.66, 0.02]}  size={[0.06, 0.12, 0.06]} color="#8a48a0" />
    <Voxel position={[0.08, 0.64, -0.08]} size={[0.05, 0.10, 0.05]} color="#7a4090" />
    <Voxel position={[-0.08, 0.64, 0.1]}  size={[0.05, 0.10, 0.05]} color="#7a4090" />
    <Voxel position={[0, 0.63, -0.1]}     size={[0.05, 0.08, 0.05]} color="#9a58b0" />
    <Voxel position={[0.16, 0.60, 0.08]}  size={[0.04, 0.08, 0.04]} color="#9a58b0" />
    {/* barnacles */}
    <Voxel position={[-0.18, 0.42, -0.1]} size={[0.06, 0.06, 0.06]} color="#888888" />
    <Voxel position={[0.16, 0.50, 0.1]}   size={[0.05, 0.05, 0.05]} color="#999999" />
  </>
)

// Flat coral reef shell - wide, flat, covered in coral and anemones
export const CoralShell = (
  <>
    {/* flat wide base */}
    <Voxel position={[0, 0.36, 0.0]}   size={[0.48, 0.08, 0.40]} color="#d4d0c8" />
    <Voxel position={[0, 0.42, 0.0]}   size={[0.42, 0.06, 0.34]} color="#c8c4b8" />
    <Voxel position={[0, 0.47, 0.0]}   size={[0.34, 0.05, 0.28]} color="#bcb8a8" />
    {/* coral growths */}
    <Voxel position={[-0.1, 0.54, 0.0]}   size={[0.08, 0.10, 0.08]} color="#e05050" />
    <Voxel position={[-0.1, 0.62, 0.0]}   size={[0.12, 0.04, 0.12]} color="#ff6060" />
    <Voxel position={[0.12, 0.52, -0.06]} size={[0.06, 0.08, 0.06]} color="#e08040" />
    <Voxel position={[0.12, 0.58, -0.06]} size={[0.1, 0.03, 0.1]}   color="#f09050" />
    <Voxel position={[0.0, 0.53, 0.1]}    size={[0.07, 0.09, 0.07]} color="#e05080" />
    <Voxel position={[0.0, 0.60, 0.1]}    size={[0.1, 0.03, 0.1]}   color="#ff60a0" />
    {/* anemone tendrils */}
    <Voxel position={[-0.16, 0.50, 0.1]}  size={[0.03, 0.12, 0.03]} color="#40c080" />
    <Voxel position={[-0.14, 0.50, 0.13]} size={[0.03, 0.10, 0.03]} color="#50d090" />
    <Voxel position={[0.18, 0.50, -0.08]} size={[0.03, 0.11, 0.03]} color="#40c080" />
    {/* small starfish */}
    <Voxel position={[0.14, 0.44, 0.12]}  size={[0.08, 0.02, 0.08]} color="#e0c040" />
    {/* blue sponge */}
    <Voxel position={[-0.16, 0.44, -0.1]} size={[0.07, 0.07, 0.07]} color="#3060c0" />
  </>
)

// Crystal geode shell - jagged translucent crystals
export const CrystalShell = (
  <>
    <Voxel position={[0, 0.36, 0.02]}   size={[0.36, 0.1, 0.3]} color="#3a3a4a" />
    <Voxel position={[0, 0.44, 0.02]}   size={[0.3, 0.08, 0.24]} color="#4a4a5a" />
    {/* crystals jutting out */}
    <Voxel position={[-0.06, 0.56, 0.0]}  size={[0.06, 0.18, 0.06]} color="#80c0ff" />
    <Voxel position={[0.08, 0.52, -0.04]} size={[0.05, 0.22, 0.05]} color="#60a0e0" />
    <Voxel position={[0.0, 0.54, 0.08]}   size={[0.07, 0.16, 0.07]} color="#a0d0ff" />
    <Voxel position={[-0.12, 0.50, 0.06]} size={[0.04, 0.14, 0.04]} color="#70b0f0" />
    <Voxel position={[0.14, 0.50, 0.06]}  size={[0.04, 0.12, 0.04]} color="#90c0ff" />
    <Voxel position={[0.02, 0.58, -0.08]} size={[0.05, 0.1, 0.05]}  color="#b0e0ff" />
    {/* rock base around crystals */}
    <Voxel position={[0, 0.42, -0.12]}    size={[0.2, 0.06, 0.06]} color="#3a3a3a" />
  </>
)

// Mushroom shell - big spotted toadstool
export const MushroomShell = (
  <>
    {/* stem */}
    <Voxel position={[0, 0.40, 0.02]}   size={[0.12, 0.16, 0.12]} color="#e8e0d0" />
    {/* cap underside (gills) */}
    <Voxel position={[0, 0.50, 0.02]}   size={[0.38, 0.04, 0.34]} color="#d8c8b0" />
    {/* cap */}
    <Voxel position={[0, 0.55, 0.02]}   size={[0.42, 0.08, 0.38]} color="#d02020" />
    <Voxel position={[0, 0.61, 0.02]}   size={[0.36, 0.06, 0.32]} color="#c01818" />
    <Voxel position={[0, 0.65, 0.02]}   size={[0.26, 0.04, 0.24]} color="#b01010" />
    <Voxel position={[0, 0.68, 0.02]}   size={[0.14, 0.03, 0.14]} color="#a00808" />
    {/* white spots */}
    <Voxel position={[-0.1, 0.63, -0.12]} size={[0.06, 0.04, 0.03]} color="#ffffff" />
    <Voxel position={[0.12, 0.60, -0.14]} size={[0.05, 0.04, 0.03]} color="#ffffff" />
    <Voxel position={[0.0, 0.64, -0.15]}  size={[0.04, 0.03, 0.03]} color="#ffffff" />
    <Voxel position={[-0.14, 0.57, -0.1]} size={[0.05, 0.04, 0.03]} color="#ffffff" />
    <Voxel position={[0.08, 0.66, -0.08]} size={[0.04, 0.03, 0.03]} color="#ffffff" />
    <Voxel position={[-0.06, 0.57, 0.14]} size={[0.05, 0.04, 0.03]} color="#ffffff" />
  </>
)

// Treasure chest shell - a little chest with gold spilling out
export const TreasureShell = (
  <>
    {/* chest body */}
    <Voxel position={[0, 0.38, 0.02]}   size={[0.36, 0.16, 0.28]} color="#6a3a1a" />
    {/* chest lid (slightly open) */}
    <Voxel position={[0, 0.50, 0.06]}   size={[0.36, 0.06, 0.24]} color="#7a4a2a" />
    <Voxel position={[0, 0.54, 0.08]}   size={[0.34, 0.04, 0.20]} color="#6a3a1a" />
    {/* metal bands */}
    <Voxel position={[0, 0.38, -0.12]}  size={[0.38, 0.16, 0.02]} color="#c8a850" />
    <Voxel position={[0, 0.50, -0.1]}   size={[0.38, 0.06, 0.02]} color="#c8a850" />
    {/* lock */}
    <Voxel position={[0, 0.44, -0.14]}  size={[0.06, 0.06, 0.02]} color="#c8c8c8" />
    {/* gold coins spilling out */}
    <Voxel position={[0.1, 0.52, -0.04]}  size={[0.05, 0.05, 0.03]} color="#ffd700" />
    <Voxel position={[-0.08, 0.53, -0.02]} size={[0.04, 0.04, 0.03]} color="#ffd700" />
    <Voxel position={[0.02, 0.54, -0.06]} size={[0.05, 0.04, 0.03]} color="#ffcc00" />
    <Voxel position={[-0.04, 0.50, 0.0]}  size={[0.04, 0.04, 0.03]} color="#ffd700" />
    {/* gem */}
    <Voxel position={[0.0, 0.55, -0.02]}  size={[0.04, 0.04, 0.04]} color="#40ff40" />
  </>
)

// Skull shell - a voxel skull riding on the back
export const SkullShell = (
  <>
    {/* skull base */}
    <Voxel position={[0, 0.40, 0.02]}   size={[0.32, 0.2, 0.28]} color="#e8e0d0" />
    <Voxel position={[0, 0.55, 0.02]}   size={[0.28, 0.14, 0.24]} color="#e0d8c8" />
    <Voxel position={[0, 0.64, 0.02]}   size={[0.22, 0.08, 0.2]} color="#e8e0d0" />
    {/* eye sockets */}
    <Voxel position={[-0.06, 0.52, -0.12]} size={[0.08, 0.08, 0.04]} color="#1a1a1a" />
    <Voxel position={[0.06, 0.52, -0.12]}  size={[0.08, 0.08, 0.04]} color="#1a1a1a" />
    {/* eye glow */}
    <Voxel position={[-0.06, 0.52, -0.11]} size={[0.04, 0.04, 0.02]} color="#ff2020" />
    <Voxel position={[0.06, 0.52, -0.11]}  size={[0.04, 0.04, 0.02]} color="#ff2020" />
    {/* nose hole */}
    <Voxel position={[0, 0.45, -0.13]}    size={[0.04, 0.05, 0.03]} color="#2a2a2a" />
    {/* teeth */}
    <Voxel position={[-0.06, 0.39, -0.13]} size={[0.04, 0.03, 0.03]} color="#d0d0c0" />
    <Voxel position={[0, 0.39, -0.13]}     size={[0.04, 0.03, 0.03]} color="#d0d0c0" />
    <Voxel position={[0.06, 0.39, -0.13]}  size={[0.04, 0.03, 0.03]} color="#d0d0c0" />
    {/* crack detail */}
    <Voxel position={[0.04, 0.60, -0.08]}  size={[0.02, 0.08, 0.02]} color="#c0b8a8" />
  </>
)

// Bonsai tree shell - a tiny tree growing on its back
export const BonsaiShell = (
  <>
    {/* soil/rock base */}
    <Voxel position={[0, 0.36, 0.02]}   size={[0.36, 0.08, 0.30]} color="#4a3a2a" />
    <Voxel position={[0, 0.42, 0.02]}   size={[0.28, 0.04, 0.24]} color="#3a2a1a" />
    {/* moss on rock */}
    <Voxel position={[-0.1, 0.44, 0.06]} size={[0.1, 0.02, 0.08]} color="#2d6e1c" />
    <Voxel position={[0.1, 0.44, -0.04]} size={[0.08, 0.02, 0.06]} color="#225a15" />
    {/* trunk */}
    <Voxel position={[0.02, 0.52, 0.02]} size={[0.06, 0.14, 0.06]} color="#5a3a1a" />
    {/* branch going left */}
    <Voxel position={[-0.06, 0.58, 0.02]} size={[0.1, 0.04, 0.04]} color="#5a3a1a" />
    {/* branch going right-up */}
    <Voxel position={[0.08, 0.62, 0.0]}  size={[0.06, 0.04, 0.04]} color="#5a3a1a" />
    {/* foliage puffs */}
    <Voxel position={[-0.1, 0.64, 0.02]}  size={[0.14, 0.1, 0.14]} color="#1a5a10" />
    <Voxel position={[-0.1, 0.72, 0.02]}  size={[0.10, 0.06, 0.10]} color="#2d6e1c" />
    <Voxel position={[0.1, 0.66, 0.0]}    size={[0.12, 0.08, 0.12]} color="#1a5a10" />
    <Voxel position={[0.1, 0.72, 0.0]}    size={[0.08, 0.06, 0.08]} color="#3a8025" />
    <Voxel position={[0.02, 0.68, 0.02]}  size={[0.10, 0.08, 0.10]} color="#225a15" />
    <Voxel position={[0.02, 0.74, 0.02]}  size={[0.06, 0.05, 0.06]} color="#2d6e1c" />
    {/* tiny flower */}
    <Voxel position={[-0.14, 0.70, 0.06]} size={[0.03, 0.03, 0.03]} color="#ff80a0" />
  </>
)

// Disco ball shell - mirror facets that catch light
export const DiscoShell = (
  <>
    <Voxel position={[0, 0.38, 0.02]}  size={[0.32, 0.14, 0.28]} color="#c0c0c0" />
    <Voxel position={[0, 0.48, 0.02]}  size={[0.28, 0.12, 0.24]} color="#d0d0d0" />
    <Voxel position={[0, 0.56, 0.02]}  size={[0.22, 0.10, 0.20]} color="#c0c0c0" />
    <Voxel position={[0, 0.62, 0.02]}  size={[0.14, 0.06, 0.14]} color="#d0d0d0" />
    {/* mirror facets */}
    <Voxel position={[-0.1, 0.44, -0.12]} size={[0.06, 0.06, 0.02]} color="#ffffff" />
    <Voxel position={[0.08, 0.50, -0.1]}  size={[0.06, 0.06, 0.02]} color="#ffe0ff" />
    <Voxel position={[-0.06, 0.54, -0.08]} size={[0.06, 0.06, 0.02]} color="#e0ffff" />
    <Voxel position={[0.1, 0.42, 0.1]}    size={[0.06, 0.06, 0.02]} color="#ffffe0" />
    <Voxel position={[-0.12, 0.50, 0.08]} size={[0.06, 0.06, 0.02]} color="#e0e0ff" />
    <Voxel position={[0.04, 0.58, -0.06]} size={[0.05, 0.05, 0.02]} color="#ffe0e0" />
    <Voxel position={[-0.08, 0.46, -0.04]} size={[0.05, 0.05, 0.02]} color="#ffffff" />
    <Voxel position={[0.12, 0.56, 0.04]}  size={[0.05, 0.05, 0.02]} color="#e0ffe0" />
  </>
)

// Volcano shell - smoking mini volcano
export const VolcanoShell = (
  <>
    {/* wide base */}
    <Voxel position={[0, 0.36, 0.02]}  size={[0.42, 0.10, 0.36]} color="#4a3020" />
    <Voxel position={[0, 0.44, 0.02]}  size={[0.36, 0.10, 0.30]} color="#5a3828" />
    <Voxel position={[0, 0.52, 0.02]}  size={[0.28, 0.10, 0.24]} color="#6a4030" />
    <Voxel position={[0, 0.58, 0.02]}  size={[0.20, 0.08, 0.18]} color="#7a4838" />
    <Voxel position={[0, 0.64, 0.02]}  size={[0.14, 0.06, 0.12]} color="#8a5040" />
    {/* crater rim */}
    <Voxel position={[0, 0.68, 0.02]}  size={[0.16, 0.03, 0.14]} color="#3a2010" />
    {/* lava glow in crater */}
    <Voxel position={[0, 0.67, 0.02]}  size={[0.08, 0.02, 0.08]} color="#ff4400" />
    <Voxel position={[0, 0.69, 0.02]}  size={[0.04, 0.04, 0.04]} color="#ff8800" />
    {/* lava drips down side */}
    <Voxel position={[0.08, 0.54, -0.12]} size={[0.04, 0.12, 0.03]} color="#ff4400" />
    <Voxel position={[-0.06, 0.50, -0.14]} size={[0.03, 0.08, 0.03]} color="#ff6600" />
    {/* smoke puffs */}
    <Voxel position={[0, 0.74, 0.02]}   size={[0.06, 0.06, 0.06]} color="#666666" />
    <Voxel position={[0.03, 0.80, 0.04]} size={[0.08, 0.06, 0.08]} color="#888888" />
    <Voxel position={[-0.02, 0.86, 0.02]} size={[0.06, 0.05, 0.06]} color="#aaaaaa" />
  </>
)

// Ice castle shell - frozen turrets
export const IceCastleShell = (
  <>
    {/* icy base platform */}
    <Voxel position={[0, 0.36, 0.02]}   size={[0.40, 0.08, 0.34]} color="#c0e0f0" />
    <Voxel position={[0, 0.42, 0.02]}   size={[0.34, 0.06, 0.28]} color="#d0e8f8" />
    {/* main tower */}
    <Voxel position={[0, 0.54, 0.02]}   size={[0.14, 0.20, 0.14]} color="#b0d8f0" />
    <Voxel position={[0, 0.66, 0.02]}   size={[0.10, 0.06, 0.10]} color="#c0e0f8" />
    {/* tower peak */}
    <Voxel position={[0, 0.72, 0.02]}   size={[0.06, 0.08, 0.06]} color="#d0e8ff" />
    {/* left turret */}
    <Voxel position={[-0.14, 0.50, 0.02]} size={[0.10, 0.14, 0.10]} color="#b0d8f0" />
    <Voxel position={[-0.14, 0.60, 0.02]} size={[0.06, 0.06, 0.06]} color="#d0e8ff" />
    {/* right turret */}
    <Voxel position={[0.14, 0.48, 0.02]}  size={[0.08, 0.12, 0.08]} color="#b0d8f0" />
    <Voxel position={[0.14, 0.56, 0.02]}  size={[0.05, 0.05, 0.05]} color="#d0e8ff" />
    {/* icicles hanging off edges */}
    <Voxel position={[-0.18, 0.38, -0.12]} size={[0.03, 0.08, 0.03]} color="#e0f0ff" />
    <Voxel position={[0.16, 0.38, -0.10]}  size={[0.03, 0.06, 0.03]} color="#e0f0ff" />
    <Voxel position={[0.0, 0.38, -0.16]}   size={[0.03, 0.07, 0.03]} color="#e0f0ff" />
    {/* frost sparkle */}
    <Voxel position={[0.06, 0.62, -0.04]}  size={[0.02, 0.02, 0.02]} color="#ffffff" />
    <Voxel position={[-0.1, 0.54, -0.06]}  size={[0.02, 0.02, 0.02]} color="#ffffff" />
  </>
)

// Beehive shell - honeycomb with bees
export const BeehiveShell = (
  <>
    {/* hive body */}
    <Voxel position={[0, 0.38, 0.02]}  size={[0.30, 0.12, 0.26]} color="#d4a030" />
    <Voxel position={[0, 0.47, 0.02]}  size={[0.34, 0.10, 0.30]} color="#c89828" />
    <Voxel position={[0, 0.55, 0.02]}  size={[0.30, 0.10, 0.26]} color="#d4a030" />
    <Voxel position={[0, 0.62, 0.02]}  size={[0.24, 0.08, 0.22]} color="#c89828" />
    <Voxel position={[0, 0.68, 0.02]}  size={[0.16, 0.06, 0.14]} color="#d4a030" />
    <Voxel position={[0, 0.72, 0.02]}  size={[0.08, 0.04, 0.08]} color="#c89828" />
    {/* honeycomb texture (hex-ish pattern) */}
    <Voxel position={[-0.08, 0.48, -0.14]} size={[0.06, 0.06, 0.02]} color="#e8b840" />
    <Voxel position={[0.06, 0.48, -0.14]}  size={[0.06, 0.06, 0.02]} color="#e8b840" />
    <Voxel position={[-0.02, 0.56, -0.12]} size={[0.06, 0.06, 0.02]} color="#e8b840" />
    <Voxel position={[0.10, 0.56, -0.12]}  size={[0.06, 0.06, 0.02]} color="#e8b840" />
    {/* honey drip */}
    <Voxel position={[0.04, 0.40, -0.14]}  size={[0.03, 0.08, 0.03]} color="#ffc020" />
    <Voxel position={[0.04, 0.35, -0.14]}  size={[0.04, 0.04, 0.04]} color="#ffc020" />
    {/* bees! */}
    <Voxel position={[-0.2, 0.62, -0.1]}  size={[0.04, 0.03, 0.03]} color="#e8c820" />
    <Voxel position={[-0.2, 0.62, -0.1]}  size={[0.02, 0.03, 0.01]} color="#1a1a1a" />
    <Voxel position={[0.18, 0.70, 0.0]}   size={[0.04, 0.03, 0.03]} color="#e8c820" />
    <Voxel position={[-0.16, 0.54, 0.12]} size={[0.04, 0.03, 0.03]} color="#e8c820" />
    {/* tiny wings on bees */}
    <Voxel position={[-0.2, 0.64, -0.1]}  size={[0.06, 0.01, 0.02]} color="#ffffff" />
    <Voxel position={[0.18, 0.72, 0.0]}   size={[0.06, 0.01, 0.02]} color="#ffffff" />
    <Voxel position={[-0.16, 0.56, 0.12]} size={[0.06, 0.01, 0.02]} color="#ffffff" />
  </>
)

// Aquarium shell - glass box with fish inside
export const AquariumShell = (
  <>
    {/* glass tank */}
    <Voxel position={[0, 0.38, 0.02]}  size={[0.36, 0.14, 0.28]} color="#80c0e0" />
    <Voxel position={[0, 0.48, 0.02]}  size={[0.36, 0.14, 0.28]} color="#70b0d0" />
    {/* glass frame edges */}
    <Voxel position={[0, 0.56, 0.02]}  size={[0.38, 0.02, 0.30]} color="#c0c0c0" />
    <Voxel position={[0, 0.36, 0.02]}  size={[0.38, 0.02, 0.30]} color="#c0c0c0" />
    {/* water surface */}
    <Voxel position={[0, 0.54, 0.02]}  size={[0.32, 0.02, 0.24]} color="#a0e0ff" />
    {/* fish 1 - orange */}
    <Voxel position={[-0.06, 0.46, -0.04]} size={[0.08, 0.04, 0.04]} color="#ff8040" />
    <Voxel position={[-0.12, 0.46, -0.04]} size={[0.04, 0.06, 0.02]} color="#ff6020" />
    {/* fish 2 - blue */}
    <Voxel position={[0.08, 0.42, 0.04]}   size={[0.06, 0.03, 0.03]} color="#4080ff" />
    <Voxel position={[0.12, 0.42, 0.04]}   size={[0.03, 0.05, 0.02]} color="#3060e0" />
    {/* seaweed */}
    <Voxel position={[-0.1, 0.42, 0.06]}  size={[0.03, 0.10, 0.03]} color="#30a050" />
    <Voxel position={[-0.1, 0.50, 0.08]}  size={[0.03, 0.06, 0.03]} color="#40b060" />
    <Voxel position={[0.1, 0.40, -0.06]}  size={[0.03, 0.08, 0.03]} color="#30a050" />
    {/* gravel bottom */}
    <Voxel position={[0, 0.37, 0.02]}     size={[0.30, 0.02, 0.22]} color="#b0a080" />
    {/* bubble */}
    <Voxel position={[0.04, 0.52, 0.0]}   size={[0.02, 0.02, 0.02]} color="#d0f0ff" />
    <Voxel position={[-0.02, 0.50, -0.02]} size={[0.02, 0.02, 0.02]} color="#d0f0ff" />
  </>
)

// UFO shell - flying saucer with lights
export const UfoShell = (
  <>
    <Voxel position={[0, 0.36, 0.02]}  size={[0.44, 0.06, 0.38]} color="#808090" />
    <Voxel position={[0, 0.41, 0.02]}  size={[0.28, 0.08, 0.24]} color="#9090a0" />
    <Voxel position={[0, 0.48, 0.02]}  size={[0.16, 0.10, 0.14]} color="#a0c0e0" />
    {/* dome */}
    <Voxel position={[0, 0.55, 0.02]}  size={[0.12, 0.06, 0.10]} color="#c0e0ff" />
    {/* lights around rim */}
    <Voxel position={[-0.2, 0.37, -0.04]} size={[0.04, 0.03, 0.04]} color="#ff0000" />
    <Voxel position={[0.2, 0.37, -0.04]}  size={[0.04, 0.03, 0.04]} color="#00ff00" />
    <Voxel position={[0, 0.37, -0.18]}    size={[0.04, 0.03, 0.04]} color="#ffff00" />
    <Voxel position={[0, 0.37, 0.2]}      size={[0.04, 0.03, 0.04]} color="#0080ff" />
    <Voxel position={[-0.14, 0.37, 0.12]} size={[0.04, 0.03, 0.04]} color="#ff00ff" />
    <Voxel position={[0.14, 0.37, 0.12]}  size={[0.04, 0.03, 0.04]} color="#00ffff" />
    {/* beam underneath */}
    <Voxel position={[0, 0.34, 0.02]}  size={[0.06, 0.04, 0.06]} color="#ffff80" />
  </>
)

// Cactus shell - desert cactus growing on its back
export const CactusShell = (
  <>
    <Voxel position={[0, 0.36, 0.02]}   size={[0.30, 0.06, 0.26]} color="#c8a060" />
    {/* main stem */}
    <Voxel position={[0, 0.48, 0.02]}   size={[0.10, 0.20, 0.10]} color="#2a6a20" />
    <Voxel position={[0, 0.60, 0.02]}   size={[0.08, 0.06, 0.08]} color="#3a7a28" />
    {/* left arm */}
    <Voxel position={[-0.1, 0.48, 0.02]} size={[0.10, 0.06, 0.06]} color="#2a6a20" />
    <Voxel position={[-0.14, 0.54, 0.02]} size={[0.06, 0.10, 0.06]} color="#2a6a20" />
    {/* right arm */}
    <Voxel position={[0.1, 0.44, 0.02]}  size={[0.10, 0.06, 0.06]} color="#2a6a20" />
    <Voxel position={[0.14, 0.50, 0.02]} size={[0.06, 0.08, 0.06]} color="#2a6a20" />
    {/* flower on top */}
    <Voxel position={[0, 0.65, 0.02]}    size={[0.06, 0.04, 0.06]} color="#ff4080" />
    <Voxel position={[0, 0.67, 0.02]}    size={[0.03, 0.03, 0.03]} color="#ffff40" />
    {/* spines */}
    <Voxel position={[0.06, 0.52, -0.04]} size={[0.02, 0.02, 0.04]} color="#e0e0a0" />
    <Voxel position={[-0.06, 0.46, -0.04]} size={[0.02, 0.02, 0.04]} color="#e0e0a0" />
    <Voxel position={[0.04, 0.42, -0.04]} size={[0.02, 0.02, 0.04]} color="#e0e0a0" />
  </>
)

// Boombox shell - retro boombox
export const BoomboxShell = (
  <>
    {/* main body */}
    <Voxel position={[0, 0.40, 0.02]}  size={[0.44, 0.18, 0.20]} color="#2a2a2a" />
    {/* handle */}
    <Voxel position={[0, 0.52, 0.02]}  size={[0.3, 0.03, 0.03]} color="#c8c8c8" />
    <Voxel position={[-0.15, 0.50, 0.02]} size={[0.03, 0.06, 0.03]} color="#c8c8c8" />
    <Voxel position={[0.15, 0.50, 0.02]}  size={[0.03, 0.06, 0.03]} color="#c8c8c8" />
    {/* left speaker */}
    <Voxel position={[-0.14, 0.40, -0.08]} size={[0.12, 0.12, 0.04]} color="#3a3a3a" />
    <Voxel position={[-0.14, 0.40, -0.09]} size={[0.08, 0.08, 0.02]} color="#4a4a4a" />
    {/* right speaker */}
    <Voxel position={[0.14, 0.40, -0.08]}  size={[0.12, 0.12, 0.04]} color="#3a3a3a" />
    <Voxel position={[0.14, 0.40, -0.09]}  size={[0.08, 0.08, 0.02]} color="#4a4a4a" />
    {/* cassette window */}
    <Voxel position={[0, 0.42, -0.1]}     size={[0.08, 0.06, 0.02]} color="#604020" />
    {/* buttons */}
    <Voxel position={[-0.04, 0.36, -0.1]} size={[0.02, 0.02, 0.02]} color="#ff0000" />
    <Voxel position={[0.0, 0.36, -0.1]}   size={[0.02, 0.02, 0.02]} color="#00ff00" />
    <Voxel position={[0.04, 0.36, -0.1]}  size={[0.02, 0.02, 0.02]} color="#ffff00" />
    {/* antenna */}
    <Voxel position={[0.18, 0.54, 0.02]}  size={[0.02, 0.12, 0.02]} color="#c8c8c8" />
  </>
)

// Pumpkin shell - jack-o-lantern
export const PumpkinShell = (
  <>
    {/* pumpkin body - segmented */}
    <Voxel position={[0, 0.38, 0.02]}     size={[0.36, 0.16, 0.32]} color="#d06010" />
    <Voxel position={[0, 0.48, 0.02]}     size={[0.38, 0.12, 0.34]} color="#e07020" />
    <Voxel position={[0, 0.56, 0.02]}     size={[0.34, 0.08, 0.30]} color="#d06010" />
    <Voxel position={[0, 0.61, 0.02]}     size={[0.24, 0.05, 0.22]} color="#c05808" />
    {/* ridges */}
    <Voxel position={[-0.16, 0.46, -0.02]} size={[0.03, 0.20, 0.03]} color="#b05008" />
    <Voxel position={[0.16, 0.46, -0.02]}  size={[0.03, 0.20, 0.03]} color="#b05008" />
    <Voxel position={[0, 0.46, -0.14]}     size={[0.03, 0.20, 0.03]} color="#b05008" />
    {/* stem */}
    <Voxel position={[0, 0.66, 0.02]}     size={[0.06, 0.06, 0.06]} color="#406020" />
    {/* face - triangle eyes */}
    <Voxel position={[-0.08, 0.50, -0.16]} size={[0.06, 0.06, 0.02]} color="#ffaa00" />
    <Voxel position={[0.08, 0.50, -0.16]}  size={[0.06, 0.06, 0.02]} color="#ffaa00" />
    {/* jagged mouth */}
    <Voxel position={[-0.08, 0.40, -0.16]} size={[0.04, 0.04, 0.02]} color="#ffaa00" />
    <Voxel position={[0, 0.42, -0.16]}     size={[0.04, 0.04, 0.02]} color="#ffaa00" />
    <Voxel position={[0.08, 0.40, -0.16]}  size={[0.04, 0.04, 0.02]} color="#ffaa00" />
    {/* inner glow */}
    <Voxel position={[0, 0.46, -0.14]}    size={[0.14, 0.10, 0.02]} color="#ff8800" />
  </>
)

// Globe shell - miniature earth
export const GlobeShell = (
  <>
    {/* stand */}
    <Voxel position={[0, 0.36, 0.02]}   size={[0.12, 0.04, 0.12]} color="#c8a850" />
    <Voxel position={[0, 0.39, 0.02]}   size={[0.03, 0.04, 0.03]} color="#c8a850" />
    {/* globe sphere approximation */}
    <Voxel position={[0, 0.46, 0.02]}   size={[0.26, 0.10, 0.26]} color="#2060c0" />
    <Voxel position={[0, 0.53, 0.02]}   size={[0.30, 0.08, 0.30]} color="#2060c0" />
    <Voxel position={[0, 0.59, 0.02]}   size={[0.26, 0.08, 0.26]} color="#2060c0" />
    <Voxel position={[0, 0.65, 0.02]}   size={[0.18, 0.06, 0.18]} color="#2060c0" />
    <Voxel position={[0, 0.69, 0.02]}   size={[0.08, 0.04, 0.08]} color="#2060c0" />
    {/* continents */}
    <Voxel position={[-0.06, 0.55, -0.14]} size={[0.1, 0.08, 0.02]} color="#30a040" />
    <Voxel position={[0.08, 0.52, -0.12]}  size={[0.06, 0.10, 0.02]} color="#30a040" />
    <Voxel position={[-0.1, 0.48, -0.08]}  size={[0.06, 0.06, 0.02]} color="#30a040" />
    <Voxel position={[0.04, 0.60, -0.10]}  size={[0.08, 0.04, 0.02]} color="#30a040" />
    {/* ice caps */}
    <Voxel position={[0, 0.68, 0.02]}     size={[0.10, 0.02, 0.10]} color="#e0f0ff" />
    <Voxel position={[0, 0.45, 0.02]}     size={[0.10, 0.02, 0.10]} color="#e0f0ff" />
  </>
)
