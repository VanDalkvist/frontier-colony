import type { BuildingState, GameState, ResourceStockpile } from '../types'

const DAY_LENGTH_SECONDS = 45

export function tickGame(state: GameState, deltaSeconds: number): GameState {
  if (state.colony.paused) {
    return state
  }

  const scaledDelta = deltaSeconds * state.colony.speed
  const buildings = advanceConstruction(state.colony.buildings, scaledDelta)
  const nextState = {
    ...state,
    colony: {
      ...state.colony,
      buildings,
    },
  }
  const production = accumulateProduction(nextState, scaledDelta)
  const foodUpkeep = (state.colony.population * 0.42 * scaledDelta) / DAY_LENGTH_SECONDS
  const nextFood = state.colony.stockpile.food + production.food - foodUpkeep
  const shortage = nextFood < 0 ? Math.abs(nextFood) : 0
  const nextElapsed = state.colony.elapsedSeconds + scaledDelta
  const nextDay =
    state.colony.day + Math.floor(nextElapsed / DAY_LENGTH_SECONDS) - Math.floor(state.colony.elapsedSeconds / DAY_LENGTH_SECONDS)

  return {
    ...nextState,
    colony: {
      ...nextState.colony,
      day: nextDay,
      elapsedSeconds: nextElapsed,
      stockpile: {
        wood: state.colony.stockpile.wood + production.wood,
        stone: state.colony.stockpile.stone + production.stone,
        ore: state.colony.stockpile.ore + production.ore,
        food: Math.max(0, nextFood),
      },
      stability: clamp(state.colony.stability - shortage * 0.08 + production.food * 0.01, 0, 100),
    },
  }
}

function advanceConstruction(buildings: BuildingState[], deltaSeconds: number): BuildingState[] {
  return buildings.map((building) => {
    if (building.status !== 'planned') {
      return building
    }

    const remaining = Math.max(0, building.constructionSecondsRemaining - deltaSeconds)
    return {
      ...building,
      constructionSecondsRemaining: remaining,
      status: remaining <= 0 ? ('active' as const) : ('planned' as const),
    }
  })
}

function accumulateProduction(state: GameState, deltaSeconds: number): ResourceStockpile {
  const total: ResourceStockpile = { wood: 0, stone: 0, food: 0, ore: 0 }

  for (const building of state.colony.buildings) {
    if (building.status !== 'active') {
      continue
    }

    const base = productionForBuilding(state, building)
    total.wood += base.wood * deltaSeconds
    total.stone += base.stone * deltaSeconds
    total.food += base.food * deltaSeconds
    total.ore += base.ore * deltaSeconds
  }

  return total
}

function productionForBuilding(state: GameState, building: BuildingState): ResourceStockpile {
  const cell = state.world.cells[building.y * state.world.width + building.x]
  const workerFactor = Math.max(1, building.assignedWorkers)

  switch (building.kind) {
    case 'lumber-camp':
      return {
        wood: (0.22 + cell.yields.wood * 0.18) * workerFactor,
        stone: 0,
        food: 0.01 * workerFactor,
        ore: 0,
      }
    case 'forager-hut':
      return {
        wood: 0,
        stone: 0,
        food: (0.18 + cell.yields.food * 0.22) * workerFactor,
        ore: 0,
      }
    case 'quarry':
      return {
        wood: 0,
        stone: (0.12 + cell.yields.stone * 0.24) * workerFactor,
        food: 0,
        ore: 0.01 * workerFactor,
      }
    case 'mine':
      return {
        wood: 0,
        stone: 0.04 * workerFactor,
        food: 0,
        ore: (0.08 + cell.yields.ore * 0.2) * workerFactor,
      }
    default:
      return { wood: 0, stone: 0, food: 0, ore: 0 }
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
