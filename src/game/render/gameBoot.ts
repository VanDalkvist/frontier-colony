import type { BuildingKind, BuildingState, TileCoord, WorldCell, WorldData } from '../types'

const TILE_WIDTH = 16
const TILE_HEIGHT = 8
const DEVICE_PIXEL_RATIO_CAP = 2
const MIN_ZOOM_MULTIPLIER = 1
const MAX_ZOOM_MULTIPLIER = 8
const PAN_GUTTER = 32
const DRAG_THRESHOLD = 5
const ZOOM_STEP = 1.2

export interface PreviewData {
  world: WorldData
  buildings: BuildingState[]
  hoveredTile: TileCoord | null
  selectedTile: TileCoord | null
  previewBuilding: BuildingKind | null
  previewValid: boolean
}

interface PreviewCallbacks {
  onHoverTile: (tile: TileCoord | null) => void
  onSelectTile: (tile: TileCoord | null) => void
}

interface CameraState {
  zoomMultiplier: number
  panX: number
  panY: number
  rotation: 0 | 1 | 2 | 3
}

interface Projection {
  originX: number
  originY: number
  zoom: number
  rotation: 0 | 1 | 2 | 3
  viewportWidth: number
  viewportHeight: number
  totalWidth: number
  totalHeight: number
  displayWidth: number
  displayHeight: number
}

interface DragState {
  pointerId: number
  startClientX: number
  startClientY: number
  startPanX: number
  startPanY: number
  dragged: boolean
  pressedTile: TileCoord | null
}

export interface ColonyPreviewController {
  destroy: () => void
  updateViewModel: (preview: PreviewData) => void
  zoomIn: () => void
  zoomOut: () => void
  resetCamera: () => void
  rotateLeft: () => void
  rotateRight: () => void
}

export function mountGame(
  container: HTMLDivElement,
  preview: PreviewData,
  callbacks: PreviewCallbacks,
): ColonyPreviewController {
  const canvas = document.createElement('canvas')
  canvas.className = 'mapCanvas'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.display = 'block'
  canvas.style.cursor = 'grab'
  container.replaceChildren(canvas)

  const context = canvas.getContext('2d')
  if (!context) {
    container.innerHTML = '<div class="viewportError">Canvas 2D is unavailable in this browser.</div>'
    return {
      destroy: () => undefined,
      updateViewModel: () => undefined,
      zoomIn: () => undefined,
      zoomOut: () => undefined,
      resetCamera: () => undefined,
      rotateLeft: () => undefined,
      rotateRight: () => undefined,
    }
  }

  let currentPreview = preview
  let camera: CameraState = createDefaultCamera()
  let projection = recalculateProjection(canvas, container, currentPreview.world, camera)
  let lastHovered: TileCoord | null = null
  let dragState: DragState | null = null

  const render = () => drawScene(context, canvas, currentPreview, projection)

  const setHover = (tile: TileCoord | null) => {
    if (sameTile(tile, lastHovered)) {
      return
    }
    lastHovered = tile
    callbacks.onHoverTile(tile)
  }

  const zoomAtPoint = (clientX: number, clientY: number, nextZoomMultiplier: number) => {
    const clamped = clamp(nextZoomMultiplier, MIN_ZOOM_MULTIPLIER, MAX_ZOOM_MULTIPLIER)
    if (Math.abs(clamped - camera.zoomMultiplier) < 0.001) {
      return
    }

    const point = getLocalPoint(clientX, clientY, canvas)
    const worldPoint = screenToContinuousGrid(point.x, point.y, projection)

    camera.zoomMultiplier = clamped
    projection = recalculateProjection(canvas, container, currentPreview.world, camera)
    const nextScreen = projectContinuousGrid(worldPoint.x, worldPoint.y, projection)
    camera.panX += point.x - nextScreen.x
    camera.panY += point.y - nextScreen.y
    camera = clampCamera(camera, projection)
    projection = recalculateProjection(canvas, container, currentPreview.world, camera)
    render()
  }

  const handleMove = (event: PointerEvent) => {
    if (dragState && dragState.pointerId === event.pointerId) {
      const deltaX = event.clientX - dragState.startClientX
      const deltaY = event.clientY - dragState.startClientY
      if (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD) {
        dragState.dragged = true
      }

      if (dragState.dragged) {
        camera.panX = dragState.startPanX + deltaX
        camera.panY = dragState.startPanY + deltaY
        camera = clampCamera(camera, projection)
        projection = recalculateProjection(canvas, container, currentPreview.world, camera)
        canvas.style.cursor = 'grabbing'
        render()
        return
      }
    }

    setHover(pickTile(event, canvas, currentPreview.world, projection))
  }

  const handleLeave = () => {
    setHover(null)
  }

  const finishPointer = (event: PointerEvent) => {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    const pointerTile = pickTile(event, canvas, currentPreview.world, projection)
    if (!dragState.dragged) {
      callbacks.onSelectTile(pointerTile ?? dragState.pressedTile)
      setHover(pointerTile)
    } else {
      setHover(pointerTile)
    }

    dragState = null
    canvas.style.cursor = 'grab'
    canvas.releasePointerCapture(event.pointerId)
  }

  const handleDown = (event: PointerEvent) => {
    if (event.button !== 0) {
      return
    }

    dragState = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: camera.panX,
      startPanY: camera.panY,
      dragged: false,
      pressedTile: pickTile(event, canvas, currentPreview.world, projection),
    }
    canvas.style.cursor = 'grabbing'
    canvas.setPointerCapture(event.pointerId)
  }

  const handleWheel = (event: WheelEvent) => {
    event.preventDefault()
    const factor = Math.exp(-event.deltaY * 0.0015)
    zoomAtPoint(event.clientX, event.clientY, camera.zoomMultiplier * factor)
  }

  const handleResize = () => {
    camera = clampCamera(camera, projection)
    projection = recalculateProjection(canvas, container, currentPreview.world, camera)
    render()
  }

  canvas.addEventListener('pointermove', handleMove)
  canvas.addEventListener('pointerleave', handleLeave)
  canvas.addEventListener('pointerdown', handleDown)
  canvas.addEventListener('pointerup', finishPointer)
  canvas.addEventListener('pointercancel', finishPointer)
  canvas.addEventListener('wheel', handleWheel, { passive: false })
  window.addEventListener('resize', handleResize)

  render()

  return {
    destroy: () => {
      canvas.removeEventListener('pointermove', handleMove)
      canvas.removeEventListener('pointerleave', handleLeave)
      canvas.removeEventListener('pointerdown', handleDown)
      canvas.removeEventListener('pointerup', finishPointer)
      canvas.removeEventListener('pointercancel', finishPointer)
      canvas.removeEventListener('wheel', handleWheel)
      window.removeEventListener('resize', handleResize)
      if (container.firstChild === canvas) {
        container.replaceChildren()
      }
    },
    updateViewModel: (nextPreview) => {
      const worldChanged =
        nextPreview.world.width !== currentPreview.world.width ||
        nextPreview.world.height !== currentPreview.world.height ||
        nextPreview.world.seed !== currentPreview.world.seed

      currentPreview = nextPreview
      if (worldChanged) {
        camera = createDefaultCamera(camera.rotation)
      }
      projection = recalculateProjection(canvas, container, currentPreview.world, camera)
      render()
    },
    zoomIn: () => {
      const rect = canvas.getBoundingClientRect()
      zoomAtPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, camera.zoomMultiplier * ZOOM_STEP)
    },
    zoomOut: () => {
      const rect = canvas.getBoundingClientRect()
      zoomAtPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, camera.zoomMultiplier / ZOOM_STEP)
    },
    resetCamera: () => {
      camera = createDefaultCamera(camera.rotation)
      projection = recalculateProjection(canvas, container, currentPreview.world, camera)
      render()
    },
    rotateLeft: () => {
      camera.rotation = (((camera.rotation + 3) % 4) as 0 | 1 | 2 | 3)
      camera.panX = 0
      camera.panY = 0
      projection = recalculateProjection(canvas, container, currentPreview.world, camera)
      render()
    },
    rotateRight: () => {
      camera.rotation = (((camera.rotation + 1) % 4) as 0 | 1 | 2 | 3)
      camera.panX = 0
      camera.panY = 0
      projection = recalculateProjection(canvas, container, currentPreview.world, camera)
      render()
    },
  }
}

function drawScene(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  preview: PreviewData,
  projection: Projection,
) {
  const ratio = getDevicePixelRatio()
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.setTransform(ratio, 0, 0, ratio, 0, 0)

  for (let diagonal = 0; diagonal < projection.displayWidth + projection.displayHeight - 1; diagonal += 1) {
    const startX = Math.max(0, diagonal - (projection.displayHeight - 1))
    const endX = Math.min(projection.displayWidth - 1, diagonal)

    for (let displayX = startX; displayX <= endX; displayX += 1) {
      const displayY = diagonal - displayX
      const cell = getCellAtDisplay(preview.world, displayX, displayY, projection)
      if (!cell) {
        continue
      }
      const point = projectContinuousGrid(displayX, displayY, projection)
      drawDiamond(context, point.x, point.y, projection.zoom, cell)
    }
  }

  for (const building of preview.buildings) {
    const rotated = rotateWorldToDisplay({ x: building.x, y: building.y }, preview.world, projection.rotation)
    const point = projectContinuousGrid(rotated.x, rotated.y, projection)
    const markerY = point.y + TILE_HEIGHT * projection.zoom * 0.12
    context.beginPath()
    context.fillStyle = withAlpha(colorForBuilding(building.kind), building.status === 'active' ? 0.94 : 0.52)
    context.arc(point.x, markerY, (building.status === 'active' ? 4.6 : 4) * projection.zoom, 0, Math.PI * 2)
    context.fill()

    context.beginPath()
    context.lineWidth = 1.5
    context.strokeStyle = withAlpha('#f8e9bd', building.status === 'active' ? 0.92 : 0.56)
    context.arc(point.x, markerY, (building.status === 'active' ? 6.2 : 5.6) * projection.zoom, 0, Math.PI * 2)
    context.stroke()

    if (building.status === 'planned') {
      context.beginPath()
      context.lineWidth = 1.4
      context.strokeStyle = withAlpha('#f2bd63', 0.72)
      context.arc(point.x, markerY, 8.4 * projection.zoom, 0, Math.PI * 2)
      context.stroke()
    }
  }

  if (preview.hoveredTile) {
    const rotated = rotateWorldToDisplay(preview.hoveredTile, preview.world, projection.rotation)
    drawOutline(context, rotated, projection, '#9ad9ff', 0.78, 2)
  }

  if (preview.selectedTile) {
    const rotated = rotateWorldToDisplay(preview.selectedTile, preview.world, projection.rotation)
    drawOutline(context, rotated, projection, '#f2bd63', 1, 2.6)
  }

  if (preview.previewBuilding && preview.selectedTile) {
    const rotated = rotateWorldToDisplay(preview.selectedTile, preview.world, projection.rotation)
    drawPlacementPreview(context, rotated, projection, preview.previewValid)
  }
}

function createDefaultCamera(rotation: 0 | 1 | 2 | 3 = 0): CameraState {
  return {
    zoomMultiplier: 1,
    panX: 0,
    panY: 0,
    rotation,
  }
}

function recalculateProjection(
  canvas: HTMLCanvasElement,
  container: HTMLDivElement,
  world: WorldData,
  camera: CameraState,
): Projection {
  const ratio = getDevicePixelRatio()
  const viewportWidth = Math.max(1, Math.floor(container.clientWidth))
  const viewportHeight = Math.max(1, Math.floor(container.clientHeight))
  canvas.width = Math.floor(viewportWidth * ratio)
  canvas.height = Math.floor(viewportHeight * ratio)

  const dims = getDisplayDimensions(world, camera.rotation)
  const fitZoom = calculateFitZoom(viewportWidth, viewportHeight, dims.width, dims.height)
  const zoom = fitZoom * camera.zoomMultiplier
  const totalWidth = (dims.width + dims.height) * (TILE_WIDTH / 2) * zoom
  const totalHeight = (dims.width + dims.height) * (TILE_HEIGHT / 2) * zoom
  const originX = viewportWidth / 2 - ((dims.width - dims.height) * TILE_WIDTH * zoom) / 4 + camera.panX
  const originY = (viewportHeight - totalHeight) / 2 + (TILE_HEIGHT / 2) * zoom + camera.panY

  return {
    originX,
    originY,
    zoom,
    rotation: camera.rotation,
    viewportWidth,
    viewportHeight,
    totalWidth,
    totalHeight,
    displayWidth: dims.width,
    displayHeight: dims.height,
  }
}

function calculateFitZoom(viewportWidth: number, viewportHeight: number, gridWidth: number, gridHeight: number) {
  const paddingX = 28
  const paddingY = 28
  const totalWidth = (gridWidth + gridHeight) * (TILE_WIDTH / 2)
  const totalHeight = (gridWidth + gridHeight) * (TILE_HEIGHT / 2)
  return Math.max(
    0.12,
    Math.min((viewportWidth - paddingX * 2) / totalWidth, (viewportHeight - paddingY * 2) / totalHeight),
  )
}

function getLocalPoint(clientX: number, clientY: number, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect()
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  }
}

function screenToContinuousGrid(screenX: number, screenY: number, projection: Projection) {
  const localX = screenX - projection.originX
  const localY = screenY - projection.originY
  return {
    x: localY / (TILE_HEIGHT * projection.zoom) + localX / (TILE_WIDTH * projection.zoom),
    y: localY / (TILE_HEIGHT * projection.zoom) - localX / (TILE_WIDTH * projection.zoom),
  }
}

function projectContinuousGrid(x: number, y: number, projection: Projection) {
  return {
    x: projection.originX + (x - y) * (TILE_WIDTH / 2) * projection.zoom,
    y: projection.originY + (x + y) * (TILE_HEIGHT / 2) * projection.zoom,
  }
}

function pickTile(
  event: PointerEvent,
  canvas: HTMLCanvasElement,
  world: WorldData,
  projection: Projection,
): TileCoord | null {
  const point = getLocalPoint(event.clientX, event.clientY, canvas)
  const continuous = screenToContinuousGrid(point.x, point.y, projection)
  const candidateX = Math.floor(continuous.x)
  const candidateY = Math.floor(continuous.y)

  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      const displayX = candidateX + offsetX
      const displayY = candidateY + offsetY
      if (
        displayX < 0 ||
        displayY < 0 ||
        displayX >= projection.displayWidth ||
        displayY >= projection.displayHeight
      ) {
        continue
      }

      const center = projectContinuousGrid(displayX, displayY, projection)
      const deltaX = Math.abs(point.x - center.x) / ((TILE_WIDTH / 2) * projection.zoom)
      const deltaY = Math.abs(point.y - center.y) / ((TILE_HEIGHT / 2) * projection.zoom)
      if (deltaX + deltaY <= 1) {
        return rotateDisplayToWorld({ x: displayX, y: displayY }, world, projection.rotation)
      }
    }
  }

  return null
}

function clampCamera(camera: CameraState, projection: Projection): CameraState {
  const overflowX = Math.max(0, (projection.totalWidth - projection.viewportWidth) / 2 + PAN_GUTTER)
  const overflowY = Math.max(0, (projection.totalHeight - projection.viewportHeight) / 2 + PAN_GUTTER)
  return {
    ...camera,
    panX: clamp(camera.panX, -overflowX, overflowX),
    panY: clamp(camera.panY, -overflowY, overflowY),
  }
}

function getDisplayDimensions(world: WorldData, rotation: 0 | 1 | 2 | 3) {
  return rotation % 2 === 0
    ? { width: world.width, height: world.height }
    : { width: world.height, height: world.width }
}

function getCellAtDisplay(world: WorldData, displayX: number, displayY: number, projection: Projection) {
  const tile = rotateDisplayToWorld({ x: displayX, y: displayY }, world, projection.rotation)
  return world.cells[tile.y * world.width + tile.x] ?? null
}

function rotateWorldToDisplay(tile: TileCoord, world: WorldData, rotation: 0 | 1 | 2 | 3): TileCoord {
  switch (rotation) {
    case 1:
      return { x: world.height - 1 - tile.y, y: tile.x }
    case 2:
      return { x: world.width - 1 - tile.x, y: world.height - 1 - tile.y }
    case 3:
      return { x: tile.y, y: world.width - 1 - tile.x }
    default:
      return tile
  }
}

function rotateDisplayToWorld(tile: TileCoord, world: WorldData, rotation: 0 | 1 | 2 | 3): TileCoord {
  switch (rotation) {
    case 1:
      return { x: tile.y, y: world.height - 1 - tile.x }
    case 2:
      return { x: world.width - 1 - tile.x, y: world.height - 1 - tile.y }
    case 3:
      return { x: world.width - 1 - tile.y, y: tile.x }
    default:
      return tile
  }
}

function drawDiamond(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
  cell: WorldCell,
) {
  const halfWidth = (TILE_WIDTH / 2) * zoom
  const halfHeight = (TILE_HEIGHT / 2) * zoom
  const points = [
    { x, y: y - halfHeight },
    { x: x + halfWidth, y },
    { x, y: y + halfHeight },
    { x: x - halfWidth, y },
  ]

  context.beginPath()
  context.moveTo(points[0].x, points[0].y)
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x, points[index].y)
  }
  context.closePath()
  context.fillStyle = cell.color
  context.fill()
  context.lineWidth = Math.max(0.35, zoom)
  context.strokeStyle = withAlpha(shadeHex(cell.color, -18), 0.45)
  context.stroke()
}

function drawOutline(
  context: CanvasRenderingContext2D,
  tile: TileCoord,
  projection: Projection,
  color: string,
  alpha: number,
  lineWidth: number,
) {
  const point = projectContinuousGrid(tile.x, tile.y, projection)
  const halfWidth = (TILE_WIDTH / 2) * projection.zoom
  const halfHeight = (TILE_HEIGHT / 2) * projection.zoom
  context.beginPath()
  context.moveTo(point.x, point.y - halfHeight)
  context.lineTo(point.x + halfWidth, point.y)
  context.lineTo(point.x, point.y + halfHeight)
  context.lineTo(point.x - halfWidth, point.y)
  context.closePath()
  context.lineWidth = lineWidth
  context.strokeStyle = withAlpha(color, alpha)
  context.stroke()
}

function drawPlacementPreview(
  context: CanvasRenderingContext2D,
  tile: TileCoord,
  projection: Projection,
  valid: boolean,
) {
  const point = projectContinuousGrid(tile.x, tile.y, projection)
  const halfWidth = (TILE_WIDTH / 2) * projection.zoom
  const halfHeight = (TILE_HEIGHT / 2) * projection.zoom
  const fill = valid ? '#74b36a' : '#d96d6d'

  context.beginPath()
  context.moveTo(point.x, point.y - halfHeight)
  context.lineTo(point.x + halfWidth, point.y)
  context.lineTo(point.x, point.y + halfHeight)
  context.lineTo(point.x - halfWidth, point.y)
  context.closePath()
  context.fillStyle = withAlpha(fill, 0.26)
  context.fill()

  context.beginPath()
  context.fillStyle = withAlpha(fill, 0.92)
  context.arc(point.x, point.y + TILE_HEIGHT * projection.zoom * 0.12, 4.2 * projection.zoom, 0, Math.PI * 2)
  context.fill()
}

function colorForBuilding(kind: BuildingState['kind']) {
  switch (kind) {
    case 'camp':
      return '#f3c67a'
    case 'lumber-camp':
      return '#74b36a'
    case 'forager-hut':
      return '#4f8cba'
    case 'quarry':
      return '#9d8f7a'
    case 'mine':
      return '#7f7e8f'
    default:
      return '#f8e9bd'
  }
}

function shadeHex(hex: string, amount: number) {
  const value = hex.replace('#', '')
  const parts = [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ]

  return rgbToHex(
    clampColor(parts[0] + amount),
    clampColor(parts[1] + amount),
    clampColor(parts[2] + amount),
  )
}

function withAlpha(color: string, alpha: number) {
  const value = color.replace('#', '')
  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function rgbToHex(red: number, green: number, blue: number) {
  return `#${[red, green, blue]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`
}

function clampColor(value: number) {
  return Math.max(0, Math.min(255, value))
}

function getDevicePixelRatio() {
  return Math.min(window.devicePixelRatio || 1, DEVICE_PIXEL_RATIO_CAP)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function sameTile(left: TileCoord | null, right: TileCoord | null) {
  if (!left && !right) {
    return true
  }
  if (!left || !right) {
    return false
  }
  return left.x === right.x && left.y === right.y
}
