import type { BuildingKind, ResourceStockpile } from './types'

export interface BuildingDefinition {
  kind: BuildingKind
  label: string
  description: string
  purpose: string
  costs: ResourceStockpile
  constructionSeconds: number
  defaultWorkers: number
}

export const BUILDING_DEFINITIONS: Record<BuildingKind, BuildingDefinition> = {
  camp: {
    kind: 'camp',
    label: 'Лагерь',
    description: 'Главная точка поселения и стартовая база колонии.',
    purpose: 'Старт',
    costs: { wood: 0, stone: 0, food: 0, ore: 0 },
    constructionSeconds: 0,
    defaultWorkers: 0,
  },
  'lumber-camp': {
    kind: 'lumber-camp',
    label: 'Лесопилка',
    description: 'Добывает дерево рядом с лесом и открывает раннее строительство.',
    purpose: 'Дерево',
    costs: { wood: 10, stone: 4, food: 0, ore: 0 },
    constructionSeconds: 10,
    defaultWorkers: 2,
  },
  'forager-hut': {
    kind: 'forager-hut',
    label: 'Хижина собирателей',
    description: 'Дает еду на плодородной земле и рядом с берегом.',
    purpose: 'Еда',
    costs: { wood: 8, stone: 2, food: 0, ore: 0 },
    constructionSeconds: 9,
    defaultWorkers: 2,
  },
  quarry: {
    kind: 'quarry',
    label: 'Каменоломня',
    description: 'Добывает камень в холмах и горах; открывает следующий слой стройки.',
    purpose: 'Камень',
    costs: { wood: 14, stone: 8, food: 0, ore: 0 },
    constructionSeconds: 14,
    defaultWorkers: 2,
  },
  mine: {
    kind: 'mine',
    label: 'Шахта',
    description: 'Добывает руду и ведет к среднему этапу производства.',
    purpose: 'Руда',
    costs: { wood: 18, stone: 12, food: 0, ore: 0 },
    constructionSeconds: 18,
    defaultWorkers: 2,
  },
  storage: {
    kind: 'storage',
    label: 'Склад',
    description: 'Увеличивает запас и снижает риск ранних потерь ресурсов.',
    purpose: 'Вместимость',
    costs: { wood: 12, stone: 6, food: 0, ore: 0 },
    constructionSeconds: 12,
    defaultWorkers: 0,
  },
  workshop: {
    kind: 'workshop',
    label: 'Мастерская',
    description: 'Здание развития для второго уровня производства.',
    purpose: 'Развитие',
    costs: { wood: 20, stone: 14, food: 0, ore: 6 },
    constructionSeconds: 20,
    defaultWorkers: 2,
  },
}

export const FIRST_PLAYABLE_BUILDINGS: BuildingKind[] = [
  'lumber-camp',
  'forager-hut',
  'quarry',
]

export function formatResourceCost(costs: ResourceStockpile) {
  const labels: Record<keyof ResourceStockpile, string> = {
    wood: 'дер.',
    stone: 'кам.',
    food: 'еда',
    ore: 'руда',
  }

  return (Object.entries(costs) as Array<[keyof ResourceStockpile, number]>)
    .filter(([, value]) => value > 0)
    .map(([resource, value]) => `${value} ${labels[resource]}`)
    .join(', ')
}
