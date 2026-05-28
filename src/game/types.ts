export type TerrainId =
  | 'deep-water'
  | 'water'
  | 'beach'
  | 'grassland'
  | 'forest'
  | 'rainforest'
  | 'desert'
  | 'highlands'
  | 'mountain'
  | 'snow'

export type ResourceKind = 'wood' | 'stone' | 'food' | 'ore'

export type BuildingKind =
  | 'camp'
  | 'lumber-camp'
  | 'forager-hut'
  | 'quarry'
  | 'mine'
  | 'storage'
  | 'workshop'

export interface TileCoord {
  x: number
  y: number
}

export interface ResourceStockpile {
  wood: number
  stone: number
  food: number
  ore: number
}

export interface WorldCell {
  x: number
  y: number
  terrain: TerrainId
  elevation: number
  moisture: number
  color: string
  yields: ResourceStockpile
}

export interface WorldData {
  seed: string
  width: number
  height: number
  cells: WorldCell[]
}

export interface BuildingState {
  id: string
  kind: BuildingKind
  x: number
  y: number
  assignedWorkers: number
  status: 'planned' | 'active'
  constructionSecondsRemaining: number
}

export interface ColonyState {
  day: number
  elapsedSeconds: number
  paused: boolean
  speed: 1 | 2 | 4
  population: number
  stability: number
  stockpile: ResourceStockpile
  buildings: BuildingState[]
  selectedBuilding: BuildingKind | null
}

export interface GameState {
  world: WorldData
  colony: ColonyState
}
