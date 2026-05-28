import type {
  BuildingState,
  GameState,
  ResourceStockpile,
  TileCoord,
  WorldCell,
  WorldData,
} from '../types'

export interface SelectedTileSummary {
  cell: WorldCell | null
  building: BuildingState | null
  nearbyTerrains: string[]
  buildableLand: boolean
}

export function getCellAt(world: WorldData, tile: TileCoord | null): WorldCell | null {
  if (!tile) {
    return null
  }
  if (tile.x < 0 || tile.y < 0 || tile.x >= world.width || tile.y >= world.height) {
    return null
  }
  return world.cells[tile.y * world.width + tile.x] ?? null
}

export function getBuildingAt(buildings: BuildingState[], tile: TileCoord | null): BuildingState | null {
  if (!tile) {
    return null
  }
  return buildings.find((building) => building.x === tile.x && building.y === tile.y) ?? null
}

export function getNeighborCells(world: WorldData, tile: TileCoord | null): WorldCell[] {
  if (!tile) {
    return []
  }

  const cells: WorldCell[] = []
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      if (offsetX === 0 && offsetY === 0) {
        continue
      }

      const cell = getCellAt(world, { x: tile.x + offsetX, y: tile.y + offsetY })
      if (cell) {
        cells.push(cell)
      }
    }
  }
  return cells
}

export function summarizeSelectedTile(gameState: GameState, tile: TileCoord | null): SelectedTileSummary {
  const cell = getCellAt(gameState.world, tile)
  const building = getBuildingAt(gameState.colony.buildings, tile)
  const nearbyTerrains = [...new Set(getNeighborCells(gameState.world, tile).map((neighbor) => neighbor.terrain))]

  return {
    cell,
    building,
    nearbyTerrains,
    buildableLand: cell ? !['deep-water', 'water', 'snow'].includes(cell.terrain) : false,
  }
}

export function hasEnoughResources(stockpile: ResourceStockpile, costs: ResourceStockpile) {
  return (
    stockpile.wood >= costs.wood &&
    stockpile.stone >= costs.stone &&
    stockpile.food >= costs.food &&
    stockpile.ore >= costs.ore
  )
}

export function getNetFoodPerDay(gameState: GameState) {
  const buildingFood = gameState.colony.buildings
    .filter((building) => building.status === 'active')
    .reduce((sum, building) => {
      const cell = gameState.world.cells[building.y * gameState.world.width + building.x]
      switch (building.kind) {
        case 'forager-hut':
          return sum + (0.18 + cell.yields.food * 0.22) * Math.max(1, building.assignedWorkers) * 45
        case 'lumber-camp':
          return sum + 0.01 * Math.max(1, building.assignedWorkers) * 45
        default:
          return sum
      }
    }, 0)

  const upkeep = gameState.colony.population * 0.42
  return buildingFood - upkeep
}

export function formatTerrainTargets(terrains: string[]) {
  const labels: Record<string, string> = {
    'deep-water': 'глубокая вода',
    water: 'вода',
    beach: 'берег',
    grassland: 'равнина',
    forest: 'лес',
    rainforest: 'густой лес',
    desert: 'пустыня',
    highlands: 'холмы',
    mountain: 'горы',
    snow: 'снег',
  }

  return terrains.map((terrain) => labels[terrain] ?? terrain).join(', ')
}
