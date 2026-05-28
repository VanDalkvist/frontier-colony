import type { ResourceStockpile, TerrainId, WorldCell, WorldData } from '../types'

const TERRAIN_COLORS: Record<TerrainId, string> = {
  'deep-water': '#12345a',
  water: '#2d6a9f',
  beach: '#dcc68d',
  grassland: '#83a85d',
  forest: '#4a7b47',
  rainforest: '#2f6540',
  desert: '#c99562',
  highlands: '#8f8266',
  mountain: '#726c6d',
  snow: '#f2f4f7',
}

export function generateWorld(seed: string, width = 84, height = 84): WorldData {
  const numericSeed = stringToSeed(seed)
  const cells = new Array<WorldCell>(width * height)
  let index = 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = x / width - 0.5
      const ny = y / height - 0.5
      const edgeDistance = Math.hypot(nx * 1.1, ny * 1.05) / 0.72
      const edgeFalloff = Math.pow(clamp(edgeDistance, 0, 1), 2.2)

      const elevationNoise = fractalNoise(nx, ny, 3.35, 5, 0.55, 2.05, numericSeed)
      const ridgeNoise = fractalNoise(nx + 3.7, ny - 6.2, 5.2, 4, 0.5, 2.4, numericSeed + 81)
      let elevation =
        elevationNoise * 0.84 +
        Math.pow(ridgeNoise, 1.4) * 0.19 -
        edgeFalloff +
        (1 - clamp(edgeDistance, 0, 1)) * 0.08
      elevation = clamp(Math.pow(clamp(elevation, 0, 1), 1.38), 0, 1)

      const moisture = clamp(
        fractalNoise(nx - 8.1, ny + 10.4, 3.8, 4, 0.58, 2.0, numericSeed + 217) * 0.8 +
          (1 - elevation) * 0.14,
        0,
        1,
      )

      const latitude = Math.abs((y / Math.max(1, height - 1)) * 2 - 1)
      const temperature = clamp(
        1 - latitude * 0.75 - elevation * 0.55 + (valueNoise(nx * 4.4, ny * 4.4, numericSeed + 701) - 0.5) * 0.18,
        0,
        1,
      )

      const terrain = classifyTerrain(elevation, moisture, temperature)
      cells[index] = {
        x,
        y,
        terrain,
        elevation,
        moisture,
        color: TERRAIN_COLORS[terrain],
        yields: terrainYields(terrain),
      }
      index += 1
    }
  }

  return { seed, width, height, cells }
}

export function findStartingCamp(world: WorldData): { x: number; y: number } {
  let bestCell = world.cells[0]
  let bestScore = -Infinity

  for (const cell of world.cells) {
    if (!isBuildableTerrain(cell.terrain)) {
      continue
    }

    const score =
      cell.yields.food * 2.2 +
      cell.yields.wood * 1.8 +
      cell.yields.stone * 0.9 +
      (1 - Math.abs(cell.x / world.width - 0.5)) * 0.6 +
      (1 - Math.abs(cell.y / world.height - 0.5)) * 0.6

    if (score > bestScore) {
      bestScore = score
      bestCell = cell
    }
  }

  return { x: bestCell.x, y: bestCell.y }
}

function terrainYields(terrain: TerrainId): ResourceStockpile {
  switch (terrain) {
    case 'forest':
      return { wood: 1.2, stone: 0.2, food: 0.45, ore: 0 }
    case 'rainforest':
      return { wood: 1.3, stone: 0.1, food: 0.65, ore: 0 }
    case 'grassland':
      return { wood: 0.35, stone: 0.2, food: 0.55, ore: 0.05 }
    case 'beach':
      return { wood: 0.1, stone: 0.15, food: 0.45, ore: 0 }
    case 'highlands':
      return { wood: 0.1, stone: 1.0, food: 0.12, ore: 0.45 }
    case 'mountain':
      return { wood: 0, stone: 1.3, food: 0, ore: 0.8 }
    case 'desert':
      return { wood: 0.05, stone: 0.25, food: 0.05, ore: 0.12 }
    case 'snow':
      return { wood: 0, stone: 0.2, food: 0, ore: 0.1 }
    default:
      return { wood: 0, stone: 0, food: 0.2, ore: 0 }
  }
}

function isBuildableTerrain(terrain: TerrainId) {
  return !['deep-water', 'water', 'snow'].includes(terrain)
}

function classifyTerrain(elevation: number, moisture: number, temperature: number): TerrainId {
  if (elevation < 0.24) return 'deep-water'
  if (elevation < 0.34) return 'water'
  if (elevation < 0.38) return 'beach'
  if (elevation > 0.83 || (temperature < 0.22 && elevation > 0.68)) return 'snow'
  if (elevation > 0.72) return 'mountain'
  if (elevation > 0.63) return 'highlands'
  if (temperature > 0.62 && moisture < 0.2) return 'desert'
  if (moisture < 0.32) return 'grassland'
  if (moisture < 0.66 || temperature < 0.4) return 'forest'
  return 'rainforest'
}

function fractalNoise(
  x: number,
  y: number,
  scale: number,
  octaves: number,
  persistence: number,
  lacunarity: number,
  seed: number,
): number {
  let amplitude = 1
  let frequency = 1
  let total = 0
  let maxAmplitude = 0

  for (let octave = 0; octave < octaves; octave += 1) {
    const octaveSeed = seed + octave * 104_729
    total +=
      valueNoise(x * scale * frequency + octave * 0.17, y * scale * frequency - octave * 0.23, octaveSeed) *
      amplitude
    maxAmplitude += amplitude
    amplitude *= persistence
    frequency *= lacunarity
  }

  return total / maxAmplitude
}

function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = x0 + 1
  const y1 = y0 + 1
  const tx = smoothstep(x - x0)
  const ty = smoothstep(y - y0)

  const v00 = lattice(x0, y0, seed)
  const v10 = lattice(x1, y0, seed)
  const v01 = lattice(x0, y1, seed)
  const v11 = lattice(x1, y1, seed)

  return lerp(lerp(v00, v10, tx), lerp(v01, v11, tx), ty)
}

function lattice(x: number, y: number, seed: number): number {
  let hash = seed ^ Math.imul(x, 374_761_393) ^ Math.imul(y, 668_265_263)
  hash = (hash ^ (hash >>> 13)) >>> 0
  hash = Math.imul(hash, 1_274_126_177) >>> 0
  return ((hash ^ (hash >>> 16)) >>> 0) / 4_294_967_295
}

function stringToSeed(value: string): number {
  let hash = 2_166_136_261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}

function smoothstep(value: number) {
  return value * value * (3 - 2 * value)
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
