import type { BuildingState, GameState } from '../types'
import { findStartingCamp, generateWorld } from '../world/generateWorld'

export function createInitialState(seed: string): GameState {
  const world = generateWorld(seed)
  const camp = findStartingCamp(world)
  const nearby = findNearbyWorksites(camp.x, camp.y)

  const buildings: BuildingState[] = [
    {
      id: 'camp-1',
      kind: 'camp',
      x: camp.x,
      y: camp.y,
      assignedWorkers: 0,
      status: 'active',
      constructionSecondsRemaining: 0,
    },
    {
      id: 'lumber-1',
      kind: 'lumber-camp',
      x: nearby.lumber.x,
      y: nearby.lumber.y,
      assignedWorkers: 3,
      status: 'active',
      constructionSecondsRemaining: 0,
    },
    {
      id: 'forager-1',
      kind: 'forager-hut',
      x: nearby.forager.x,
      y: nearby.forager.y,
      assignedWorkers: 3,
      status: 'active',
      constructionSecondsRemaining: 0,
    },
  ]

  return {
    world,
    colony: {
      day: 1,
      elapsedSeconds: 0,
      paused: false,
      speed: 1,
      population: 8,
      stability: 82,
      stockpile: {
        wood: 30,
        stone: 18,
        food: 42,
        ore: 0,
      },
      buildings,
      selectedBuilding: 'lumber-camp',
    },
  }
}

function findNearbyWorksites(x: number, y: number) {
  return {
    lumber: { x: x + 2, y: y + 1 },
    forager: { x: x - 2, y: y + 1 },
  }
}
