import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import {
  BUILDING_DEFINITIONS,
  FIRST_PLAYABLE_BUILDINGS,
  formatResourceCost,
} from './game/buildings'
import type { PreviewData } from './game/render/gameBoot'
import type { ColonyPreviewController } from './game/render/gameBoot'
import { mountGame } from './game/render/gameBoot'
import { placeBuilding } from './game/simulation/buildCommands'
import { validateBuildingPlacement } from './game/simulation/buildValidation'
import { createInitialState } from './game/simulation/createInitialState'
import {
  formatTerrainTargets,
  getNetFoodPerDay,
  summarizeSelectedTile,
} from './game/simulation/selectors'
import { tickGame } from './game/simulation/tick'
import type { BuildingKind, GameState, TileCoord } from './game/types'

type NoticeTone = 'info' | 'success' | 'error'

interface NoticeState {
  message: string
  tone: NoticeTone
}

interface BuildingUiMeta {
  icon: ReactNode
  short: string
  hint: string
  output: string
}

const BUILDING_UI: Record<BuildingKind, BuildingUiMeta> = {
  camp: {
    icon: <CampIcon />,
    short: 'База колонии',
    hint: 'Стартовая точка',
    output: 'Центр поселения',
  },
  'lumber-camp': {
    icon: <LumberIcon />,
    short: 'Нужна для ранней стройки',
    hint: 'Ставь рядом с лесом',
    output: '+ дерево',
  },
  'forager-hut': {
    icon: <ForagerIcon />,
    short: 'Закрывает дефицит еды',
    hint: 'Равнина, лес или берег',
    output: '+ еда',
  },
  quarry: {
    icon: <QuarryIcon />,
    short: 'Открывает следующий тир стройки',
    hint: 'Рядом холмы или горы',
    output: '+ камень',
  },
  mine: {
    icon: <MineIcon />,
    short: 'Средняя игра',
    hint: 'Горы и руда',
    output: '+ руда',
  },
  storage: {
    icon: <StorageIcon />,
    short: 'Вместимость',
    hint: 'Любая суша',
    output: 'Больше запасов',
  },
  workshop: {
    icon: <WorkshopIcon />,
    short: 'Развитие',
    hint: 'Позднее здание',
    output: 'Прогресс',
  },
}

function App() {
  const [seed, setSeed] = useState('frontier-alpha')
  const [gameState, setGameState] = useState<GameState>(() => createInitialState('frontier-alpha'))
  const [hoveredTile, setHoveredTile] = useState<TileCoord | null>(null)
  const [selectedTile, setSelectedTile] = useState<TileCoord | null>(null)
  const [buildMode, setBuildMode] = useState<BuildingKind | null>(null)
  const [notice, setNotice] = useState<NoticeState | null>({
    message: '1. Выбери здание справа. 2. Кликни по клетке. 3. Нажми «Построить».',
    tone: 'info',
  })
  const viewportRef = useRef<HTMLDivElement>(null)
  const viewportControllerRef = useRef<ColonyPreviewController | null>(null)
  const latestPreviewRef = useRef<PreviewData | null>(null)
  const lastTickRef = useRef<number | null>(null)

  const selectedSummary = useMemo(
    () => summarizeSelectedTile(gameState, selectedTile),
    [gameState, selectedTile],
  )
  const placementResult = useMemo(() => {
    if (!buildMode) {
      return null
    }
    return validateBuildingPlacement(gameState, buildMode, selectedTile)
  }, [buildMode, gameState, selectedTile])
  const sessionStatus = useMemo(() => getSessionStatus(gameState), [gameState])
  const loopSummary = useMemo(() => buildSummary(gameState), [gameState])
  const netFoodPerDay = useMemo(() => getNetFoodPerDay(gameState), [gameState])
  const previewModel = useMemo<PreviewData>(
    () => ({
      world: gameState.world,
      buildings: gameState.colony.buildings,
      hoveredTile,
      selectedTile,
      previewBuilding: buildMode,
      previewValid: placementResult?.valid ?? false,
    }),
    [buildMode, gameState.world, gameState.colony.buildings, hoveredTile, placementResult, selectedTile],
  )

  useEffect(() => {
    latestPreviewRef.current = previewModel
  }, [previewModel])

  useEffect(() => {
    const viewport = viewportRef.current
    const initialPreview = latestPreviewRef.current
    if (!viewport || !initialPreview) {
      return
    }

    const controller = mountGame(viewport, initialPreview, {
      onHoverTile: setHoveredTile,
      onSelectTile: setSelectedTile,
    })

    viewportControllerRef.current = controller
    return () => {
      viewportControllerRef.current = null
      controller.destroy()
    }
  }, [gameState.world])

  useEffect(() => {
    viewportControllerRef.current?.updateViewModel(previewModel)
  }, [previewModel])

  useEffect(() => {
    let frameId = 0

    const loop = (timestamp: number) => {
      const lastTick = lastTickRef.current
      if (lastTick === null) {
        lastTickRef.current = timestamp
        frameId = window.requestAnimationFrame(loop)
        return
      }

      const delta = Math.min(0.4, (timestamp - lastTick) / 1000)
      lastTickRef.current = timestamp
      setGameState((current) => {
        if (isSessionFinal(current)) {
          return current
        }
        return tickGame(current, delta)
      })
      frameId = window.requestAnimationFrame(loop)
    }

    frameId = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(frameId)
  }, [])

  function rerollWorld() {
    const nextSeed = `${pick(SEED_WORDS)}-${pick(SEED_WORDS)}-${Math.floor(Math.random() * 999)}`
    lastTickRef.current = null
    setSeed(nextSeed)
    setGameState(createInitialState(nextSeed))
    setHoveredTile(null)
    setSelectedTile(null)
    setBuildMode(null)
    setNotice({
      message: 'Новый мир готов. Осмотри карту и сразу закрой дерево или еду.',
      tone: 'info',
    })
  }

  function togglePause() {
    if (isSessionFinal(gameState)) {
      return
    }

    setGameState((current) => ({
      ...current,
      colony: {
        ...current.colony,
        paused: !current.colony.paused,
      },
    }))
  }

  function setSpeed(speed: 1 | 2 | 4) {
    if (isSessionFinal(gameState)) {
      return
    }

    setGameState((current) => ({
      ...current,
      colony: {
        ...current.colony,
        speed,
      },
    }))
  }

  function toggleBuildMode(kind: BuildingKind) {
    setBuildMode((current) => {
      const nextMode = current === kind ? null : kind
      setNotice({
        message: nextMode
          ? `${BUILDING_DEFINITIONS[nextMode].label}: ${BUILDING_UI[nextMode].hint.toLowerCase()}.`
          : 'Режим строительства выключен.',
        tone: 'info',
      })
      return nextMode
    })
  }

  function handlePlaceBuilding() {
    if (!buildMode || isSessionFinal(gameState)) {
      return
    }

    const result = placeBuilding(gameState, buildMode, selectedTile)
    setGameState(result.gameState)
    setNotice({
      message: result.message,
      tone: result.ok ? 'success' : 'error',
    })
  }

  function zoomInViewport() {
    viewportControllerRef.current?.zoomIn()
  }

  function zoomOutViewport() {
    viewportControllerRef.current?.zoomOut()
  }

  function resetViewportCamera() {
    viewportControllerRef.current?.resetCamera()
  }

  function rotateViewportLeft() {
    viewportControllerRef.current?.rotateLeft()
  }

  function rotateViewportRight() {
    viewportControllerRef.current?.rotateRight()
  }

  const buildCtaLabel = buildMode
    ? `Построить: ${BUILDING_DEFINITIONS[buildMode].label}`
    : 'Сначала выбери здание'

  return (
    <div className="shell">
      <header className="headerBar">
        <div className="brandBlock">
          <div>
            <p className="eyebrow">Процедурная колония</p>
            <h1>Frontier Colony</h1>
          </div>
          <div className="seedBadge">
            <span>Сид</span>
            <strong>{seed}</strong>
          </div>
        </div>

        <div className="headerActions">
          <div className="headerSummary">
            <StatusChip label="День" value={String(gameState.colony.day)} />
            <StatusChip label="Люди" value={String(gameState.colony.population)} />
            <StatusChip label="Стаб." value={`${Math.round(gameState.colony.stability)}%`} />
            <StatusChip
              label="Еда/день"
              value={formatSigned(netFoodPerDay)}
              tone={netFoodPerDay >= 0 ? 'good' : 'bad'}
            />
            <StatusChip label="Дер." value={String(Math.floor(gameState.colony.stockpile.wood))} />
            <StatusChip label="Кам." value={String(Math.floor(gameState.colony.stockpile.stone))} />
            <StatusChip label="Еда" value={String(Math.floor(gameState.colony.stockpile.food))} />
          </div>

          <button type="button" className="secondaryButton" onClick={rerollWorld}>
            Новый мир
          </button>
          <button type="button" onClick={togglePause} disabled={isSessionFinal(gameState)}>
            {gameState.colony.paused ? 'Продолжить' : 'Пауза'}
          </button>
          <div className="speedGroup">
            {[1, 2, 4].map((speed) => (
              <button
                key={speed}
                type="button"
                className={gameState.colony.speed === speed ? 'isActive' : ''}
                disabled={isSessionFinal(gameState)}
                onClick={() => setSpeed(speed as 1 | 2 | 4)}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="layout">
        <section className="playfield panel">
          <div className="playfieldTop">
            <div className="stepGuide">
              <span>1. Выбери постройку</span>
              <span>2. Кликни по карте</span>
              <span>3. Построй</span>
            </div>
            <div className="objectiveChip">Цель: день 6, 90 дерева, 55 камня, 55 еды</div>
          </div>

          {notice ? (
            <div className={`notice is-${notice.tone}`}>
              <span>{notice.message}</span>
            </div>
          ) : null}

          <div className="viewportToolbar">
            <div className="viewportHint">Колесо мыши: зум. Перетаскивание: карта.</div>
            <div className="viewportButtons">
              <button type="button" className="secondaryButton" onClick={rotateViewportLeft}>
                ↺
              </button>
              <button type="button" className="secondaryButton" onClick={rotateViewportRight}>
                ↻
              </button>
              <button type="button" className="secondaryButton" onClick={zoomOutViewport}>
                −
              </button>
              <button type="button" className="secondaryButton" onClick={zoomInViewport}>
                +
              </button>
              <button type="button" className="secondaryButton" onClick={resetViewportCamera}>
                Вписать
              </button>
            </div>
          </div>

          <div ref={viewportRef} className="gameViewport" />

          <div className="viewportLegend">
            <span>Курсор</span>
            <strong>{formatTile(hoveredTile) ?? 'нет'}</strong>
            <span>Клетка</span>
            <strong>{formatTile(selectedTile) ?? 'не выбрана'}</strong>
            <span>Строим</span>
            <strong>{buildMode ? BUILDING_DEFINITIONS[buildMode].label : 'ничего'}</strong>
          </div>

          {sessionStatus ? (
            <div className={`sessionOverlay is-${sessionStatus.kind}`}>
              <p className="eyebrow">{sessionStatus.kind === 'win' ? 'Победа' : 'Провал'}</p>
              <h2>{sessionStatus.title}</h2>
              <p>{sessionStatus.description}</p>
              <button type="button" onClick={rerollWorld}>
                Сгенерировать новый мир
              </button>
            </div>
          ) : null}
        </section>

        <aside className="sidebar">
          <section className="panel compactPanel buildPanel">
            <div className="panelHeadline">
              <div>
                <p className="eyebrow">Стройка</p>
                <h2>Что строить сейчас</h2>
              </div>
              <div className="panelBadge">{loopSummary.title}</div>
            </div>

            <div className="buildGrid">
              {FIRST_PLAYABLE_BUILDINGS.map((kind) => {
                const definition = BUILDING_DEFINITIONS[kind]
                const meta = BUILDING_UI[kind]
                const active = buildMode === kind

                return (
                  <button
                    key={kind}
                    type="button"
                    className={`buildOption${active ? ' isSelected' : ''}`}
                    onClick={() => toggleBuildMode(kind)}
                  >
                    <span className="iconBadge">{meta.icon}</span>
                    <span className="buildCopy">
                      <strong>{definition.label}</strong>
                      <span className="buildRole">{meta.output}</span>
                      <span className="buildCost">{formatResourceCost(definition.costs)}</span>
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="placementPanel compactPlacement">
              <div className="placementHeader">
                <h3>{buildMode ? BUILDING_DEFINITIONS[buildMode].label : 'Здание не выбрано'}</h3>
                <span>{selectedTile ? `Клетка ${formatTile(selectedTile)}` : 'Выбери клетку'}</span>
              </div>
              <p className="panelText">
                {placementResult
                  ? placementResult.reason
                  : 'Начни с лесопилки, если мало дерева, или с собирателей, если уходит еда.'}
              </p>
              <button
                type="button"
                onClick={handlePlaceBuilding}
                disabled={!buildMode || !placementResult?.valid || isSessionFinal(gameState)}
              >
                {buildCtaLabel}
              </button>
            </div>

            <div className="sidebarCompact">
              <div className="miniSection">
                <p className="eyebrow">Клетка</p>
                <div className="tileGrid">
                  <InfoStat label="Тип" value={selectedSummary.cell ? formatTerrain(selectedSummary.cell.terrain) : 'Не выбрана'} />
                  <InfoStat label="Статус" value={selectedSummary.building ? formatBuildingStatus(selectedSummary.building.status) : 'Пусто'} />
                  <InfoStat label="Дер." value={selectedSummary.cell ? selectedSummary.cell.yields.wood.toFixed(2) : '--'} />
                  <InfoStat label="Еда" value={selectedSummary.cell ? selectedSummary.cell.yields.food.toFixed(2) : '--'} />
                  <InfoStat label="Кам." value={selectedSummary.cell ? selectedSummary.cell.yields.stone.toFixed(2) : '--'} />
                  <InfoStat
                    label="Соседи"
                    value={selectedSummary.nearbyTerrains.length > 0 ? formatTerrainTargets(selectedSummary.nearbyTerrains) : '--'}
                    wide
                  />
                </div>
              </div>

              <div className="miniSection">
                <p className="eyebrow">Подсказка</p>
                <p className="panelText">{loopSummary.description}</p>
              </div>

              <div className="miniSection">
                <p className="eyebrow">Цель</p>
                <div className="goalGrid">
                  <InfoStat label="День" value={`${gameState.colony.day}/6`} />
                  <InfoStat label="Дер." value={`${Math.floor(gameState.colony.stockpile.wood)}/90`} />
                  <InfoStat label="Кам." value={`${Math.floor(gameState.colony.stockpile.stone)}/55`} />
                  <InfoStat label="Еда" value={`${Math.floor(gameState.colony.stockpile.food)}/55`} />
                </div>
              </div>
            </div>
          </section>
        </aside>
      </main>
    </div>
  )
}

function buildSummary(gameState: GameState) {
  const plannedBuildings = gameState.colony.buildings.filter((building) => building.status === 'planned').length

  if (gameState.colony.stockpile.food < 18 || getNetFoodPerDay(gameState) < 0) {
    return {
      title: 'Срочно нужна еда',
      description: 'Ставь хижину собирателей на равнине, в лесу или у берега. Иначе стабильность начнет падать.',
    }
  }

  if (plannedBuildings > 0) {
    return {
      title: 'Стройка идет',
      description: 'Постройка еще не работает. Дождись завершения и только потом жди прирост ресурса.',
    }
  }

  if (gameState.colony.stockpile.wood < 42) {
    return {
      title: 'Не хватает дерева',
      description: 'Лучший ранний ход: поставить лесопилку рядом с плотным лесом и ускорить весь темп колонии.',
    }
  }

  if (gameState.colony.stockpile.stone < 26) {
    return {
      title: 'Пора в камень',
      description: 'После дерева и еды переходи к каменоломне. Без камня развитие быстро упрется в потолок.',
    }
  }

  return {
    title: 'Колония держится',
    description: 'Контур ранней игры стабилизирован. Добирай целевые ресурсы и не просаживай еду.',
  }
}

function getSessionStatus(gameState: GameState) {
  if (gameState.colony.stability <= 0) {
    return {
      kind: 'lose' as const,
      title: 'Поселение развалилось',
      description: 'Стабильность упала до нуля. Колония не закрыла базовые дефициты вовремя.',
    }
  }

  const win =
    gameState.colony.day >= 6 &&
    gameState.colony.stockpile.wood >= 90 &&
    gameState.colony.stockpile.stone >= 55 &&
    gameState.colony.stockpile.food >= 55

  if (win) {
    return {
      kind: 'win' as const,
      title: 'Ранний этап закрыт',
      description: 'Есть рабочая петля: выбрать здание, найти правильную клетку, построить и стабилизировать экономику.',
    }
  }

  return null
}

function isSessionFinal(gameState: GameState) {
  return getSessionStatus(gameState) !== null
}

function formatTerrain(value: string) {
  const labels: Record<string, string> = {
    'deep-water': 'Глубокая вода',
    water: 'Вода',
    beach: 'Берег',
    grassland: 'Равнина',
    forest: 'Лес',
    rainforest: 'Густой лес',
    desert: 'Пустыня',
    highlands: 'Холмы',
    mountain: 'Горы',
    snow: 'Снег',
  }

  return labels[value] ?? value
}

function formatTile(tile: TileCoord | null) {
  if (!tile) {
    return null
  }
  return `${tile.x}:${tile.y}`
}

function formatSigned(value: number) {
  const rounded = Math.round(value * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded}`
}

function formatBuildingStatus(value: 'planned' | 'active') {
  return value === 'planned' ? 'Строится' : 'Работает'
}

function pick(values: string[]) {
  return values[Math.floor(Math.random() * values.length)]
}

function StatusChip({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'good' | 'bad'
}) {
  return (
    <div className={`statusChip${tone ? ` is-${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function InfoStat({
  label,
  value,
  wide = false,
}: {
  label: string
  value: string
  wide?: boolean
}) {
  return (
    <div className={`infoStat${wide ? ' isWide' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function CampIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 18 12 5l8 13M8.5 18l3.5-5 3.5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LumberIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v13M12 7c-3 0-5 1.4-5 3.2C7 12 8.9 13 12 13c3.2 0 5 1 5 2.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.3 9.7c.7-2 2-3.2 3.7-3.7M15.7 12.8c-.7 2-2 3.2-3.7 3.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function ForagerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 15c0-2.8 1.8-5 4-5s4 2.2 4 5M9 15c0 2 1.3 3.5 3 3.5S15 17 15 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 9c0-2 1.1-3.5 3-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function QuarryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 18 10 8m4 10 4-10M8 12h8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 18h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function MineIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 18 10 8l4 4 2-3 4 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="8" r="1.4" fill="currentColor" />
    </svg>
  )
}

function StorageIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 9h14v9H5zM7 9V6h10v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9.5 13h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function WorkshopIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 6v12M6 12h12M8 8l8 8M16 8l-8 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

const SEED_WORDS = ['frontier', 'cinder', 'harbor', 'granite', 'moss', 'ember']

export default App
