import { BUILDING_DEFINITIONS } from '../buildings'
import type { BuildingKind, GameState, TileCoord, TerrainId, WorldCell } from '../types'
import { getBuildingAt, getCellAt, getNeighborCells, hasEnoughResources } from './selectors'

export interface BuildValidationResult {
  valid: boolean
  reason: string
}

const BUILD_RULES: Record<
  Exclude<BuildingKind, 'camp' | 'storage' | 'workshop' | 'mine'>,
  { allowedTerrains: TerrainId[]; nearbyTerrains: TerrainId[]; minimumYield?: keyof WorldCell['yields']; minimumValue?: number }
> = {
  'lumber-camp': {
    allowedTerrains: ['grassland', 'forest', 'rainforest', 'beach'],
    nearbyTerrains: ['forest', 'rainforest'],
    minimumYield: 'wood',
    minimumValue: 0.7,
  },
  'forager-hut': {
    allowedTerrains: ['grassland', 'forest', 'rainforest', 'beach'],
    nearbyTerrains: ['grassland', 'forest', 'rainforest', 'beach'],
    minimumYield: 'food',
    minimumValue: 0.4,
  },
  quarry: {
    allowedTerrains: ['grassland', 'highlands', 'mountain'],
    nearbyTerrains: ['highlands', 'mountain'],
    minimumYield: 'stone',
    minimumValue: 0.8,
  },
}

export function validateBuildingPlacement(
  gameState: GameState,
  buildingKind: BuildingKind,
  tile: TileCoord | null,
): BuildValidationResult {
  if (!tile) {
    return { valid: false, reason: 'Сначала выбери клетку на карте.' }
  }

  const cell = getCellAt(gameState.world, tile)
  if (!cell) {
    return { valid: false, reason: 'Эта клетка находится вне карты.' }
  }

  if (['deep-water', 'water', 'snow'].includes(cell.terrain)) {
    return {
      valid: false,
      reason: `${BUILDING_DEFINITIONS[buildingKind].label} нельзя поставить на ${formatTerrain(cell.terrain)}.`,
    }
  }

  if (getBuildingAt(gameState.colony.buildings, tile)) {
    return { valid: false, reason: 'Клетка уже занята другой постройкой.' }
  }

  const costs = BUILDING_DEFINITIONS[buildingKind].costs
  if (!hasEnoughResources(gameState.colony.stockpile, costs)) {
    return {
      valid: false,
      reason: `Не хватает ресурсов: нужно ${costs.wood} дерева, ${costs.stone} камня и ${costs.ore} руды.`,
    }
  }

  const rules = BUILD_RULES[buildingKind as keyof typeof BUILD_RULES]
  if (!rules) {
    return { valid: true, reason: 'Постройку можно поставить.' }
  }

  if (!rules.allowedTerrains.includes(cell.terrain)) {
    return {
      valid: false,
      reason: `${BUILDING_DEFINITIONS[buildingKind].label} нельзя поставить на ${formatTerrain(cell.terrain)}.`,
    }
  }

  const nearby = getNeighborCells(gameState.world, tile)
  const hasRequiredNearby = nearby.some((neighbor) => rules.nearbyTerrains.includes(neighbor.terrain))
  if (!hasRequiredNearby) {
    return {
      valid: false,
      reason: `Рядом нужны клетки типа: ${rules.nearbyTerrains.map(formatTerrain).join(', ')}.`,
    }
  }

  if (rules.minimumYield && rules.minimumValue && cell.yields[rules.minimumYield] < rules.minimumValue) {
    return {
      valid: false,
      reason: `Эта клетка слишком слабая для здания ${BUILDING_DEFINITIONS[buildingKind].label}.`,
    }
  }

  return { valid: true, reason: 'Условия подходят, можно строить.' }
}

function formatTerrain(value: TerrainId) {
  const labels: Record<TerrainId, string> = {
    'deep-water': 'глубокой воде',
    water: 'воде',
    beach: 'пляже',
    grassland: 'равнине',
    forest: 'лесу',
    rainforest: 'густом лесу',
    desert: 'пустыне',
    highlands: 'холмах',
    mountain: 'горах',
    snow: 'снегу',
  }

  return labels[value]
}
