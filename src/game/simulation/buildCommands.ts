import { BUILDING_DEFINITIONS } from '../buildings'
import type { BuildingKind, GameState, TileCoord } from '../types'
import { validateBuildingPlacement } from './buildValidation'

export interface BuildCommandResult {
  ok: boolean
  gameState: GameState
  message: string
}

export function placeBuilding(
  gameState: GameState,
  buildingKind: BuildingKind,
  tile: TileCoord | null,
): BuildCommandResult {
  const validation = validateBuildingPlacement(gameState, buildingKind, tile)
  if (!validation.valid || !tile) {
    return {
      ok: false,
      gameState,
      message: validation.reason,
    }
  }

  const definition = BUILDING_DEFINITIONS[buildingKind]
  const nextIndex = gameState.colony.buildings.filter((building) => building.kind === buildingKind).length + 1

  return {
    ok: true,
    message: `${definition.label} поставлена. Строительство началось.`,
    gameState: {
      ...gameState,
      colony: {
        ...gameState.colony,
        buildings: [
          ...gameState.colony.buildings,
          {
            id: `${buildingKind}-${nextIndex}`,
            kind: buildingKind,
            x: tile.x,
            y: tile.y,
            assignedWorkers: definition.defaultWorkers,
            status: definition.constructionSeconds > 0 ? 'planned' : 'active',
            constructionSecondsRemaining: definition.constructionSeconds,
          },
        ],
        stockpile: {
          wood: gameState.colony.stockpile.wood - definition.costs.wood,
          stone: gameState.colony.stockpile.stone - definition.costs.stone,
          food: gameState.colony.stockpile.food - definition.costs.food,
          ore: gameState.colony.stockpile.ore - definition.costs.ore,
        },
      },
    },
  }
}
