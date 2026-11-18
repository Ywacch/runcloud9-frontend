import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import {
  registerCanvasFitScheduler,
  unregisterCanvasFitScheduler,
} from '../canvas/utils/canvasFitBridge'
import {
  useCanvasStore,
  type CanvasNode,
} from '../editor-core/stores/canvasStore'
import {
  displayWorldPosition,
  applySessionLayoutToNodes,
} from '../lib/sessionLayoutStore'
import { isInstanceScopeViewportMode } from '../lib/devInstanceScopePreview'
import { useMetricsStore } from '../editor-core/stores/metricsStore'
import { useCanvasContextMenuStore } from '../editor-core/stores/contextMenuStore'
import {
  canMoveOnCanvas,
  canPlaceOnCanvas,
} from '../lib/canvasContextMenuCatalog'
import { placeFromPicker } from '../lib/pickerPlacement'
import {
  instanceIdForUnitIndex,
  metricsInstancePickKey,
  unitPickEnabledForDisplay,
} from '../lib/canvasInstanceScope'
import {
  SPAWN_AT_SCREEN,
  type SpawnAtScreenDetail,
} from '../lib/spawnEvents'
import {
  isWalkthroughRunning,
  walkthroughNodeAlpha,
  walkthroughNodeRole,
} from '../canvas/utils/walkthroughVisual'
import { classifyCanvasEdgeMeaning } from '../lib/resolveEdgeMeaning'
import { getTopologyFlags } from '../lib/componentRole'
import { assessGraphConstraints } from '../lib/graphConstraints'
import {
  findMultiSingletonGroup,
  planSingletonCollapse,
  singletonCollapseButtonLabel,
} from '../lib/collapseSingleton'
import { collapseMultiSingletonOnCanvas } from '../lib/collapseSingletonOnCanvas'
import { APP_SERVER_REPLICA_MAX } from '../lib/replicaConfig'
import { maxAppServerReplicasForUser } from '../lib/userTier'
import {
  setDevCanvasToolsVisible,
  useDevCanvasChromeMode,
  useDevCanvasToolsVisible,
  useDevDebugExtrasVisible,
} from '../lib/devCanvasTools'
import { useAuthStore } from '../product/stores/authStore'
import { useTemplateRegistryStore } from '../editor-core/stores/templateRegistryStore'
import { ConnectToggle } from './components/ConnectToggle'
import { EdgeLayer } from './components/EdgeLayer'
import { EdgeMeaningStrip } from './components/EdgeMeaningStrip'
import { GraphHonestyStrip } from './components/GraphHonestyStrip'
import { EdgeStylePresetToggle } from './components/EdgeStylePresetToggle'
import { EngineSelect } from './components/EngineSelect'
import { Floor, type GridMode } from './components/Floor'
import { FloorThemeToggle } from './components/FloorThemeToggle'
import { DevTemplateLayoutPreview } from './components/DevTemplateLayoutPreview'
import { FxDemoControls } from './components/FxDemoControls'
import { GridModeToggle } from './components/GridModeToggle'
import { GridPatterns } from './components/GridPatterns'
import { HealthRimFilters } from './fx/HealthRimFilters'
import { LiveNodeGlyph } from './components/LiveNodeGlyph'
import { InstanceScopeClusterPickLayer } from './components/InstanceScopeClusterPickLayer'
import { LiveZoneLayer } from './components/LiveZoneLayer'
import { MiniPalette } from './components/MiniPalette'
import { ReplicasStepper } from './components/ReplicasStepper'
import { ShardsStepper } from './components/ShardsStepper'
import { SvgNodeTooltipOverlay } from './components/SvgNodeTooltipOverlay'
import { TrafficLayer } from './components/TrafficLayer'
import { WalkthroughNodeOverlay } from './components/WalkthroughNodeOverlay'
import { NodeLabelChrome } from './components/NodeLabelChrome'
import {
  svgWorldToCanvasPosition,
} from './bridge/canvasSvgAdapter'
import { useEdgeRenderModel } from './hooks/useEdgeRenderModel'
import { useNodeOpacityById } from './hooks/useNodeOpacityById'
import { useSvgCanvasKeyboard } from './hooks/useSvgCanvasKeyboard'
import { screenToIso, snapWorld, type WorldPoint } from './math/iso'
import { modelWorld, presentWorld } from './math/projection'
import { getProjectionT, useProjectionT } from './store/projectionStore'
import { ProjectionToggle } from './components/ProjectionToggle'
import { attachPoint } from './routing/attach'
import { defaultExpanded, resolveDisplayUnits } from './compose/resolveDisplayUnits'
import {
  TemplateFloorPreviewLayer,
  templatePreviewDimOpacity,
} from './components/TemplateFloorPreviewLayer'
import { useTemplateFloorPreviewStore } from '../editor-core/stores/templateFloorPreviewStore'
import { getExpanded, getExpandEpoch, subscribeExpand } from './store/expandStore'
import { setDragLive } from './store/dragLiveStore'
import {
  installCanvasSvgBridge,
  useSvgCanvasStore,
} from './store/svgCanvasStore'
import {
  notifySvgViewportScreenRefresh,
  registerSvgViewport,
  unregisterSvgViewport,
} from './utils/svgViewportBridge'
import {
  downloadSvgString,
  serializeSvgScene,
} from './export/serializeSvgScene'
import { findSvgNodeIdAtWorldPoint } from './utils/svgContextHitTest'
import {
  readStoredFloorTheme,
  writeStoredFloorTheme,
} from './utils/floorThemePreference'
import {
  readStoredEdgeStylePreset,
  writeStoredEdgeStylePreset,
} from './utils/edgeStylePreference'
import {
  readStoredGridMode,
  writeStoredGridMode,
} from './utils/gridModePreference'
import {
  floorThemeTokens,
  type FloorThemeId,
} from './theme/floorTheme'
import type { EdgeStylePresetId } from './fx/edgePresets'

const MIN_VIEW = 400
const MAX_VIEW = 8000
/** Half glyph (~CELL_W) plus margin. Larger pad under-zooms small topologies. */
const FIT_VIEW_PAD = 180
const ZOOM_FACTOR = 1.12
const CLICK_SLOP_PX = 5

type ViewBox = { x: number; y: number; w: number; h: number }

type DragSession = {
  /** Primary grab node (under pointer). */
  primaryId: string
  /** All node ids moving with this drag. */
  ids: string[]
  /** Origins at drag start, keyed by id. */
  origins: Record<string, WorldPoint>
  grabWorld: WorldPoint
  /** Live delta from grab. */
  dx: number
  dy: number
  /** Screen coords at pointerdown — used to distinguish click vs drag. */
  pointerStartClient: { x: number; y: number }
  /**
   * When true, the node was not selected on pointerdown. Select it on
   * pointerup only if the gesture stayed within click slop (so a drag
   * repositions without opening the inspector).
   */
  selectOnClick: boolean
}

type Marquee = { x0: number; y0: number; x1: number; y1: number }

function initialViewBox(hostW: number, hostH: number): ViewBox {
  const aspect = hostW > 0 && hostH > 0 ? hostW / hostH : 16 / 9
  const h = 780
  const w = h * aspect
  return { x: -w / 2, y: -h / 2, w, h }
}

function fitViewToNodes(
  nodeList: { x: number; y: number }[],
  hostW: number,
  hostH: number,
): ViewBox {
  if (nodeList.length === 0) return initialViewBox(hostW, hostH)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodeList) {
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x)
    maxY = Math.max(maxY, n.y)
  }
  const pad = FIT_VIEW_PAD
  const contentW = Math.max(maxX - minX, 160) + pad * 2
  const contentH = Math.max(maxY - minY, 160) + pad * 2
  const aspect = hostW > 0 && hostH > 0 ? hostW / hostH : 16 / 9
  let w = contentW
  let h = contentH
  if (w / h > aspect) h = w / aspect
  else w = h * aspect
  w = Math.min(MAX_VIEW, Math.max(MIN_VIEW, w))
  h = w / aspect
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

const PALETTE_TYPES = new Set<CanvasNode['type']>([
  'load_balancer',
  'compute',
  'database',
  'cache',
  'message_queue',
  'worker',
])

function isPaletteNodeType(raw: string): raw is CanvasNode['type'] {
  return PALETTE_TYPES.has(raw as CanvasNode['type'])
}

function placePickerAtWorld(x: number, y: number, nodeType: CanvasNode['type']): void {
  const state = useCanvasStore.getState()
  if (!canPlaceOnCanvas(state.mode, state.movementLocked)) return
  placeFromPicker({
    nodeType,
    position: svgWorldToCanvasPosition(x, y),
    nodes: state.nodes,
    addNode: state.addNode,
    updateNodeConfig: state.updateNodeConfig,
  })
  state.setPlacingNodeType(null)
}

type SvgDesignCanvasProps = {
  /** When true, product sidebar/inspector own palette + tools; slim local chrome. */
  chromeMounted?: boolean
}

function clientToWorld(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): WorldPoint {
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: 0, y: 0 }
  const local = pt.matrixTransform(ctm.inverse())
  return { x: local.x, y: local.y }
}

function clientToModel(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): WorldPoint {
  return modelWorld(clientToWorld(svg, clientX, clientY), getProjectionT())
}

function anchorsInMarquee(
  nodes: { id: string; x: number; y: number }[],
  m: Marquee,
): string[] {
  const minX = Math.min(m.x0, m.x1)
  const maxX = Math.max(m.x0, m.x1)
  const minY = Math.min(m.y0, m.y1)
  const maxY = Math.max(m.y0, m.y1)
  return nodes
    .filter((n) => n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY)
    .map((n) => n.id)
}

export default function SvgDesignCanvas({
  chromeMounted = false,
}: SvgDesignCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<ViewBox>(() => initialViewBox(1200, 800))
  const projectionT = useProjectionT()
  const templatePreviewActive = useTemplateFloorPreviewStore((s) => s.snapshot != null)
  const prevProjectionT = useRef(0)
  const [mode, setMode] = useState<GridMode>(() => readStoredGridMode())
  const setGridMode = useCallback((next: GridMode) => {
    setMode(next)
    writeStoredGridMode(next)
  }, [])
  const [floorThemeId, setFloorThemeId] = useState<FloorThemeId>(() =>
    readStoredFloorTheme(),
  )
  const setFloorTheme = useCallback((next: FloorThemeId) => {
    setFloorThemeId(next)
    writeStoredFloorTheme(next)
  }, [])
  const floorTheme = useMemo(
    () => floorThemeTokens(floorThemeId),
    [floorThemeId],
  )
  const [edgeStylePreset, setEdgeStylePresetState] =
    useState<EdgeStylePresetId>(() => readStoredEdgeStylePreset())
  const setEdgeStylePreset = useCallback((next: EdgeStylePresetId) => {
    setEdgeStylePresetState(next)
    writeStoredEdgeStylePreset(next)
  }, [])
  const [spaceDown, setSpaceDown] = useState(false)
  const [panning, setPanning] = useState(false)
  const [marquee, setMarquee] = useState<Marquee | null>(null)
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null)
  const panLast = useRef<{ x: number; y: number } | null>(null)
  const panOrigin = useRef<{ x: number; y: number } | null>(null)
  const panMoved = useRef(false)
  const dragRef = useRef<DragSession | null>(null)
  const marqueeRef = useRef<Marquee | null>(null)
  const marqueeActive = useRef(false)
  const rubberLineRef = useRef<SVGLineElement | null>(null)
  const rubberFromRef = useRef<WorldPoint | null>(null)
  const skipAspectSyncRef = useRef(0)
  const devToolsVisible = useDevCanvasToolsVisible()
  const debugExtrasVisible = useDevDebugExtrasVisible()
  const chromeMode = useDevCanvasChromeMode()

  const nodes = useSvgCanvasStore((s) => s.nodes)
  const edges = useSvgCanvasStore((s) => s.edges)
  const zones = useSvgCanvasStore((s) => s.zones)
  const selectedIds = useSvgCanvasStore((s) => s.selectedIds)
  const selectedEdgeIds = useSvgCanvasStore((s) => s.selectedEdgeIds)
  const placingArchetype = useSvgCanvasStore((s) => s.placingArchetype)
  const connectMode = useSvgCanvasStore((s) => s.connectMode)
  const connectSourceId = useSvgCanvasStore((s) => s.connectSourceId)
  const placeNodeAt = useSvgCanvasStore((s) => s.placeNodeAt)
  const selectOnly = useSvgCanvasStore((s) => s.selectOnly)
  const toggleInSelection = useSvgCanvasStore((s) => s.toggleInSelection)
  const setSelectedIds = useSvgCanvasStore((s) => s.setSelectedIds)
  const selectEdgesOnly = useSvgCanvasStore((s) => s.selectEdgesOnly)
  const setConnectSourceId = useSvgCanvasStore((s) => s.setConnectSourceId)
  const addEdge = useSvgCanvasStore((s) => s.addEdge)
  const moveNodes = useSvgCanvasStore((s) => s.moveNodes)
  const canvasMode = useCanvasStore((s) => s.mode)
  const canvasNodes = useCanvasStore((s) => s.nodes)
  const canvasEdges = useCanvasStore((s) => s.edges)
  const snapshotTemplateId = useCanvasStore((s) => s.snapshotTemplateId)
  const jobBindings = useCanvasStore((s) => s.jobBindings)
  const expandEpoch = useSyncExternalStore(subscribeExpand, getExpandEpoch, () => 0)
  const metricsPickKey = useMetricsStore((s) =>
    isInstanceScopeViewportMode(canvasMode)
      ? metricsInstancePickKey(s.metrics, canvasNodes)
      : '',
  )
  const storytelling = useTemplateRegistryStore((s) =>
    snapshotTemplateId ? s.byId[snapshotTemplateId]?.storytelling : undefined,
  )
  const supportsWorker = useTemplateRegistryStore((s) =>
    snapshotTemplateId ? s.byId[snapshotTemplateId]?.supportsWorker !== false : true,
  )
  useSvgCanvasKeyboard()

  const topologyFlags = useMemo(
    () => getTopologyFlags(canvasNodes),
    [canvasNodes],
  )

  useEffect(() => {
    installCanvasSvgBridge()
  }, [])

  useEffect(() => {
    const svg = svgRef.current
    const host = hostRef.current
    if (!svg || !host) return
    registerSvgViewport(svg, host)
    return () => unregisterSvgViewport()
  }, [])

  useEffect(() => {
    notifySvgViewportScreenRefresh()
  }, [view])

  useEffect(() => {
    if (spaceDown || panning || marquee || dragRef.current) {
      useCanvasStore.getState().setHoveredNodeId(null)
    }
  }, [spaceDown, panning, marquee])

  // Read live store nodes — React state is stale right after auto-arrange /
  // LB inject sync (requestCanvasFit runs before paint).
  const fitDefault = useCallback(() => {
    const host = hostRef.current
    if (!host) return
    skipAspectSyncRef.current = 3
    const apply = () => {
      const el = hostRef.current
      if (!el) return
      const { width, height } = el.getBoundingClientRect()
      if (width < 1 || height < 1) return
      const t = getProjectionT()
      setView(
        fitViewToNodes(
          useSvgCanvasStore.getState().nodes.map((n) => presentWorld(n, t)),
          width,
          height,
        ),
      )
    }
    apply()
    requestAnimationFrame(() => {
      requestAnimationFrame(apply)
    })
  }, [])

  const [exporting, setExporting] = useState(false)
  const exportSvg = useCallback(async () => {
    const svg = svgRef.current
    if (!svg || exporting) return
    setExporting(true)
    try {
      const text = await serializeSvgScene(svg, {
        nodes: useSvgCanvasStore.getState().nodes,
        gridMode: mode,
        background: floorTheme.hostBg,
      })
      downloadSvgString(text)
    } catch (err) {
      console.error('SVG export failed', err)
    } finally {
      setExporting(false)
    }
  }, [exporting, floorTheme.hostBg, mode])

  useEffect(() => {
    const prev = prevProjectionT.current
    if (prev === projectionT) return
    prevProjectionT.current = projectionT
    setView((v) => {
      const cx = v.x + v.w / 2
      const cy = v.y + v.h / 2
      const model = modelWorld({ x: cx, y: cy }, prev)
      const next = presentWorld(model, projectionT)
      return { ...v, x: next.x - v.w / 2, y: next.y - v.h / 2 }
    })
  }, [projectionT])

  useEffect(() => {
    registerCanvasFitScheduler(fitDefault)
    return () => unregisterCanvasFitScheduler()
  }, [fitDefault])

  useEffect(() => {
    if (canvasMode !== 'live' && canvasMode !== 'simulate') return
    skipAspectSyncRef.current = 4
    const id = window.setTimeout(() => fitDefault(), 80)
    return () => window.clearTimeout(id)
  }, [canvasMode, fitDefault])

  useEffect(() => {
    const onSpawn = (event: Event) => {
      const detail = (event as CustomEvent<SpawnAtScreenDetail>).detail
      if (!detail || !isPaletteNodeType(detail.nodeType)) return
      const svg = svgRef.current
      if (!svg) return
      const world = clientToModel(svg, detail.clientX, detail.clientY)
      placePickerAtWorld(world.x, world.y, detail.nodeType)
    }
    window.addEventListener(SPAWN_AT_SCREEN, onSpawn)
    return () => window.removeEventListener(SPAWN_AT_SCREEN, onSpawn)
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const sync = () => {
      if (skipAspectSyncRef.current > 0) {
        skipAspectSyncRef.current -= 1
        return
      }
      const { width, height } = host.getBoundingClientRect()
      if (width < 1 || height < 1) return
      setView((v) => {
        const cx = v.x + v.w / 2
        const cy = v.y + v.h / 2
        const aspect = width / height
        const h = v.h
        const w = h * aspect
        return { x: cx - w / 2, y: cy - h / 2, w, h }
      })
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(host)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      if (e.code === 'Space' && !typing) {
        e.preventDefault()
        setSpaceDown(true)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const zoomAround = useCallback((factor: number, worldX: number, worldY: number) => {
    setView((v) => {
      const nextW = Math.min(MAX_VIEW, Math.max(MIN_VIEW, v.w * factor))
      const nextH = nextW * (v.h / v.w)
      const rx = (worldX - v.x) / v.w
      const ry = (worldY - v.y) / v.h
      return {
        x: worldX - rx * nextW,
        y: worldY - ry * nextH,
        w: nextW,
        h: nextH,
      }
    })
  }, [])

  const onWheel = useCallback(
    (e: ReactWheelEvent<SVGSVGElement>) => {
      e.preventDefault()
      const svg = svgRef.current
      if (!svg) return
      const world = clientToWorld(svg, e.clientX, e.clientY)
      const factor = e.deltaY > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR
      zoomAround(factor, world.x, world.y)
    },
    [zoomAround],
  )

  const onContextMenu = useCallback((e: ReactMouseEvent<SVGSVGElement>) => {
    e.preventDefault()
    const svg = svgRef.current
    if (!svg) return
    const presented = clientToWorld(svg, e.clientX, e.clientY)
    const t = getProjectionT()
    const svgNodes = applySessionLayoutToNodes(useSvgCanvasStore.getState().nodes).map(
      (n) => ({ ...n, ...presentWorld(n, t) }),
    )
    const hitId = findSvgNodeIdAtWorldPoint(svgNodes, presented.x, presented.y)
    const menuStore = useCanvasContextMenuStore.getState()
    if (hitId) {
      menuStore.openNode({
        clientX: e.clientX,
        clientY: e.clientY,
        nodeId: hitId,
      })
      return
    }
    const canvas = useCanvasStore.getState()
    if (!canPlaceOnCanvas(canvas.mode, canvas.movementLocked)) {
      menuStore.close()
      return
    }
    menuStore.openCreate({
      clientX: e.clientX,
      clientY: e.clientY,
      position: svgWorldToCanvasPosition(
        modelWorld(presented, t).x,
        modelWorld(presented, t).y,
      ),
    })
  }, [])

  const beginNodeDrag = useCallback(
    (nodeId: string, e: ReactPointerEvent<SVGGElement>) => {
      if (e.button !== 0 || spaceDown) return
      e.stopPropagation()
      useCanvasStore.getState().setHoveredNodeId(null)
      const svg = svgRef.current
      if (!svg) return

      const state = useSvgCanvasStore.getState()
      const canvas = useCanvasStore.getState()
      if (canvas.designTool === 'erase') {
        canvas.setSelectedIds([nodeId])
        canvas.removeSelectedNodes()
        return
      }

      if (state.connectMode) {
        if (state.connectSourceId == null) {
          setConnectSourceId(nodeId)
        } else if (state.connectSourceId === nodeId) {
          setConnectSourceId(null)
        } else {
          addEdge(state.connectSourceId, nodeId)
        }
        return
      }

      if (e.ctrlKey || e.metaKey) {
        toggleInSelection(nodeId)
        return
      }

      const node = state.nodes.find((n) => n.id === nodeId)
      if (!node) return

      const already = state.selectedIds.includes(nodeId)
      const ids = already ? [...state.selectedIds] : [nodeId]
      // Defer select until click: selecting on pointerdown opens the inspector
      // before the user has a chance to drag.

      if (canvas.mode === 'live') {
        selectOnly(nodeId)
        return
      }

      if (!canMoveOnCanvas(canvas.movementLocked)) {
        // Still allow click-to-inspect when movement is locked.
        if (!already) selectOnly(nodeId)
        return
      }

      const world = clientToModel(svg, e.clientX, e.clientY)
      const origins: Record<string, WorldPoint> = {}
      for (const id of ids) {
        const n = state.nodes.find((x) => x.id === id)
        if (n) {
          const placed = displayWorldPosition(n)
          origins[id] = { x: placed.x, y: placed.y }
        }
      }

      const session: DragSession = {
        primaryId: nodeId,
        ids: Object.keys(origins),
        origins,
        grabWorld: world,
        dx: 0,
        dy: 0,
        pointerStartClient: { x: e.clientX, y: e.clientY },
        selectOnClick: !already,
      }
      dragRef.current = session
      setDragLive({
        ids: session.ids,
        origins: session.origins,
        dx: 0,
        dy: 0,
      })
      svg.setPointerCapture(e.pointerId)
    },
    [spaceDown, selectOnly, toggleInSelection, setConnectSourceId, addEdge],
  )

  const onNodePointerEnter = useCallback((nodeId: string) => {
    const state = useCanvasStore.getState()
    if (!isInstanceScopeViewportMode(state.mode)) return
    if (dragRef.current) return
      state.setHoveredNodeId(nodeId)
      state.setHoveredInstanceId('cluster')
  }, [])

  const onNodePointerLeave = useCallback((nodeId: string) => {
    const state = useCanvasStore.getState()
    if (state.hoveredNodeId === nodeId) {
      state.setHoveredNodeId(null)
      state.setHoveredInstanceId(null)
    }
  }, [])

  const unitCountForNode = useCallback((nodeId: string): number => {
    const svgNode = useSvgCanvasStore.getState().nodes.find((n) => n.id === nodeId)
    if (!svgNode) return 1
    const expanded = getExpanded(svgNode.id) ?? defaultExpanded(svgNode)
    return resolveDisplayUnits(svgNode, expanded).units.length
  }, [])

  const unitPickEnabled = useCallback(
    (nodeId: string): boolean => {
      const canvasNode = useCanvasStore.getState().nodes[nodeId]
      if (!canvasNode) return false
      const svgNode = useSvgCanvasStore.getState().nodes.find((n) => n.id === nodeId)
      if (!svgNode) return false
      const displayExpanded = getExpanded(svgNode.id) ?? defaultExpanded(svgNode)
      const unitCount = unitCountForNode(nodeId)
      return unitPickEnabledForDisplay(
        displayExpanded,
        canvasNode,
        useMetricsStore.getState().metrics[nodeId],
        unitCount,
      )
    },
    [unitCountForNode, metricsPickKey, expandEpoch],
  )

  const onZonePointerDown = useCallback(
    (ownerNodeId: string, e: ReactPointerEvent<SVGElement>) => {
      if (e.button !== 0 || spaceDown) return
      e.stopPropagation()
      selectOnly(ownerNodeId)
      const canvas = useCanvasStore.getState()
      canvas.setSelectedInstanceId('cluster')
      canvas.setHoveredNodeId(ownerNodeId)
      canvas.setHoveredInstanceId('cluster')
    },
    [spaceDown, selectOnly],
  )

  const onUnitPointerDown = useCallback(
    (nodeId: string, unitIndex: number, e: ReactPointerEvent<SVGGElement>) => {
      if (e.button !== 0 || spaceDown) return
      if (!unitPickEnabled(nodeId)) return
      e.stopPropagation()
      const canvas = useCanvasStore.getState()
      const canvasNode = canvas.nodes[nodeId]
      if (!canvasNode) return
      const unitCount = unitCountForNode(nodeId)
      const metrics = useMetricsStore.getState().metrics[nodeId]
      const instanceId = instanceIdForUnitIndex(
        canvasNode,
        metrics,
        unitIndex,
        unitCount,
      )
      selectOnly(nodeId)
      const after = useCanvasStore.getState()
      if (instanceId) after.setSelectedInstanceId(instanceId)
      after.setHoveredNodeId(nodeId)
      after.setHoveredInstanceId(instanceId)
    },
    [spaceDown, selectOnly, unitCountForNode, unitPickEnabled],
  )

  const onUnitPointerEnter = useCallback(
    (nodeId: string, unitIndex: number) => {
      const state = useCanvasStore.getState()
      if (!isInstanceScopeViewportMode(state.mode)) return
      if (dragRef.current) return
      if (!unitPickEnabled(nodeId)) return
      const canvasNode = state.nodes[nodeId]
      if (!canvasNode) return
      const unitCount = unitCountForNode(nodeId)
      const metrics = useMetricsStore.getState().metrics[nodeId]
      const instanceId = instanceIdForUnitIndex(
        canvasNode,
        metrics,
        unitIndex,
        unitCount,
      )
      if (!instanceId) return
      state.setHoveredNodeId(nodeId)
      state.setHoveredInstanceId(instanceId)
    },
    [unitCountForNode, unitPickEnabled],
  )

  const onUnitPointerLeave = useCallback((nodeId: string) => {
    const state = useCanvasStore.getState()
    if (state.hoveredNodeId === nodeId) {
      state.setHoveredInstanceId('cluster')
    }
  }, [])

  const onEdgePointerDown = useCallback(
    (edgeId: string, e: ReactPointerEvent<SVGElement>) => {
      if (e.button !== 0 || spaceDown) return
      e.stopPropagation()
      selectEdgesOnly([edgeId])
    },
    [spaceDown, selectEdgesOnly],
  )

  const onEdgePointerEnter = useCallback((edgeId: string) => {
    setHoveredEdgeId(edgeId)
  }, [])

  const onEdgePointerLeave = useCallback((edgeId: string) => {
    setHoveredEdgeId((prev) => (prev === edgeId ? null : prev))
  }, [])

  const edgeMeaning = useMemo(() => {
    if (canvasMode === 'live') return null
    const focusId =
      selectedEdgeIds.length === 1
        ? selectedEdgeIds[0]
        : hoveredEdgeId
    if (!focusId) return null
    const edge = canvasEdges[focusId]
    if (!edge) return null
    return classifyCanvasEdgeMeaning(
      edge,
      canvasNodes,
      supportsWorker,
      topologyFlags,
      storytelling,
    )
  }, [
    canvasMode,
    selectedEdgeIds,
    hoveredEdgeId,
    canvasEdges,
    canvasNodes,
    supportsWorker,
    topologyFlags,
    storytelling,
  ])

  const graphHonestyIssue = useMemo(() => {
    if (canvasMode === 'live') return null
    return assessGraphConstraints(
      canvasNodes,
      canvasEdges,
      jobBindings,
      snapshotTemplateId,
    )
  }, [canvasMode, canvasNodes, canvasEdges, jobBindings, snapshotTemplateId])

  const currentUser = useAuthStore((s) => s.currentUser)
  const userRecord = useAuthStore((s) => s.userRecord)
  const singletonCollapse = useMemo(() => {
    if (canvasMode === 'live') return null
    const group = findMultiSingletonGroup(canvasNodes)
    if (!group) return null
    const maxAllowed =
      group.kind === 'app-server'
        ? (currentUser?.limits.maxAppServerReplicas ??
          maxAppServerReplicasForUser(userRecord))
        : APP_SERVER_REPLICA_MAX
    return planSingletonCollapse(canvasNodes, canvasEdges, maxAllowed)
  }, [canvasMode, canvasNodes, canvasEdges, currentUser, userRecord])

  const onCollapseSingleton = useCallback(() => {
    if (!singletonCollapse) return
    collapseMultiSingletonOnCanvas(singletonCollapse.maxAllowed)
  }, [singletonCollapse])

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current
      if (!svg) return
      if (e.button !== 0 && e.button !== 1) return
      if (e.button === 1) e.preventDefault()

      const world = clientToWorld(svg, e.clientX, e.clientY)
      const wantMarquee =
        e.button === 0 && (e.ctrlKey || e.metaKey) && !spaceDown

      if (wantMarquee) {
        marqueeActive.current = true
        const m = { x0: world.x, y0: world.y, x1: world.x, y1: world.y }
        marqueeRef.current = m
        setMarquee(m)
        svg.setPointerCapture(e.pointerId)
        return
      }

      marqueeActive.current = false
      setPanning(true)
      panMoved.current = false
      panOrigin.current = { x: e.clientX, y: e.clientY }
      panLast.current = { x: e.clientX, y: e.clientY }
      svg.setPointerCapture(e.pointerId)
    },
    [spaceDown],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current
      if (!svg) return

      const presented = clientToWorld(svg, e.clientX, e.clientY)
      if (useSvgCanvasStore.getState().connectSourceId && rubberLineRef.current) {
        rubberLineRef.current.setAttribute('x2', String(presented.x))
        rubberLineRef.current.setAttribute('y2', String(presented.y))
      }

      if (marqueeActive.current && marqueeRef.current) {
        const m = {
          ...marqueeRef.current,
          x1: presented.x,
          y1: presented.y,
        }
        marqueeRef.current = m
        setMarquee(m)
        return
      }

      if (panning && panLast.current) {
        const dx = e.clientX - panLast.current.x
        const dy = e.clientY - panLast.current.y
        if (panOrigin.current) {
          const ox = e.clientX - panOrigin.current.x
          const oy = e.clientY - panOrigin.current.y
          if (Math.hypot(ox, oy) > CLICK_SLOP_PX) panMoved.current = true
        }
        panLast.current = { x: e.clientX, y: e.clientY }
        if (panMoved.current) {
          const rect = svg.getBoundingClientRect()
          setView((v) => ({
            ...v,
            x: v.x - (dx / rect.width) * v.w,
            y: v.y - (dy / rect.height) * v.h,
          }))
        }
        return
      }

      const session = dragRef.current
      if (!session) return
      const model = modelWorld(presented, getProjectionT())
      const updated: DragSession = {
        ...session,
        dx: model.x - session.grabWorld.x,
        dy: model.y - session.grabWorld.y,
      }
      dragRef.current = updated
      setDragLive({
        ids: updated.ids,
        origins: updated.origins,
        dx: updated.dx,
        dy: updated.dy,
      })
    },
    [panning],
  )

  const endPointer = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current

      if (dragRef.current) {
        const session = dragRef.current
        const moved =
          Math.hypot(
            e.clientX - session.pointerStartClient.x,
            e.clientY - session.pointerStartClient.y,
          ) > CLICK_SLOP_PX
        if (moved) {
          const updates = session.ids.map((id) => {
            const o = session.origins[id]
            return {
              id,
              x: o.x + session.dx,
              y: o.y + session.dy,
            }
          })
          moveNodes(updates)
        } else if (session.selectOnClick) {
          // Click (no drag): select → opens inspector.
          selectOnly(session.primaryId)
        }
        dragRef.current = null
        setDragLive(null)
        try {
          e.currentTarget.releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
        return
      }

      if (marqueeActive.current) {
        const m = marqueeRef.current
        marqueeActive.current = false
        marqueeRef.current = null
        setMarquee(null)
        try {
          e.currentTarget.releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
        if (m) {
          const t = getProjectionT()
          const ids = anchorsInMarquee(
            applySessionLayoutToNodes(useSvgCanvasStore.getState().nodes).map((n) => ({
              id: n.id,
              ...presentWorld(n, t),
            })),
            m,
          )
          setSelectedIds(ids)
        }
        return
      }

      if (panning) {
        const wasClick = !panMoved.current && e.button === 0 && !spaceDown
        setPanning(false)
        panLast.current = null
        panOrigin.current = null
        try {
          e.currentTarget.releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }

        if (wasClick && svg) {
          const world = clientToModel(svg, e.clientX, e.clientY)
          const st = useSvgCanvasStore.getState()
          if (st.connectMode) {
            setConnectSourceId(null)
          } else if (st.placingArchetype) {
            placeNodeAt(world.x, world.y)
          } else {
            selectOnly(null)
          }
        }
      }
    },
    [
      panning,
      spaceDown,
      moveNodes,
      placeNodeAt,
      selectOnly,
      setSelectedIds,
      setConnectSourceId,
    ],
  )

  const zoomBy = useCallback(
    (factor: number) => {
      const cx = view.x + view.w / 2
      const cy = view.y + view.h / 2
      zoomAround(factor, cx, cy)
    },
    [view, zoomAround],
  )

  const sortedNodes = useMemo(() => {
    return [...nodes].sort((a, b) => a.y - b.y || a.x - b.x)
  }, [nodes])

  const prevNodeIdsRef = useRef<Set<string>>(new Set())
  const hasRenderedNodesRef = useRef(false)
  const appearIds = useMemo(() => {
    const currentIds = new Set(nodes.map((n) => n.id))
    if (!hasRenderedNodesRef.current) {
      hasRenderedNodesRef.current = true
      prevNodeIdsRef.current = currentIds
      return new Set<string>()
    }
    const appear = new Set<string>()
    for (const id of currentIds) {
      if (!prevNodeIdsRef.current.has(id)) appear.add(id)
    }
    prevNodeIdsRef.current = currentIds
    return appear
  }, [nodes])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const edgeRenderModel = useEdgeRenderModel(edges)

  const walkthroughActiveNodeId = useCanvasStore((s) => s.walkthroughActiveNodeId)
  const walkthroughVisitedNodeIds = useCanvasStore(
    (s) => s.walkthroughVisitedNodeIds,
  )
  const walkthroughParticipatingNodeIds = useCanvasStore(
    (s) => s.walkthroughParticipatingNodeIds,
  )
  const templatePresetMode = useCanvasStore((s) => s.templatePresetMode)
  const isPremiumUser = useAuthStore((s) => s.isPremium)

  const walkthroughOpacityById = useMemo(() => {
    const state = useCanvasStore.getState()
    if (!isWalkthroughRunning(state)) return null as Map<string, number> | null
    const map = new Map<string, number>()
    for (const n of nodes) {
      map.set(n.id, walkthroughNodeAlpha(walkthroughNodeRole(n.id, state)))
    }
    return map
  }, [
    nodes,
    canvasMode,
    walkthroughActiveNodeId,
    walkthroughVisitedNodeIds,
    walkthroughParticipatingNodeIds,
  ])

  const nodeOpacityById = useNodeOpacityById({
    nodes,
    walkthroughOpacityById,
    isFreeUser: !isPremiumUser,
    templatePresetMode,
  })

  const latticeHint = useMemo(() => {
    if (connectMode) {
      return connectSourceId
        ? `connect: pick target · ${edges.length} edges`
        : `connect: pick source · ${edges.length} edges`
    }
    const nSel = selectedIds.length
    if (placingArchetype) {
      return `placing ${placingArchetype} · ${nodes.length} nodes`
    }
    if (selectedEdgeIds.length > 0) {
      return `${selectedEdgeIds.length} edge(s) · ${edges.length} total`
    }
    if (nSel === 0) return `${nodes.length} nodes · ${edges.length} edges`
    if (nSel === 1) {
      const id = selectedIds[0]
      const node = nodes.find((n) => n.id === id)
      if (!node) return `1 selected · ${nodes.length} nodes`
      const snapped = snapWorld(node.x, node.y)
      const iso = screenToIso(snapped.x, snapped.y)
      return `rest ${node.label} → (${iso.i.toFixed(1)}, ${iso.j.toFixed(1)})`
    }
    return `${nSel} selected · ${nodes.length} nodes`
  }, [
    nodes,
    edges.length,
    selectedIds,
    selectedEdgeIds,
    placingArchetype,
    connectMode,
    connectSourceId,
  ])

  const rubberFrom = useMemo(() => {
    if (!connectSourceId) {
      rubberFromRef.current = null
      return null
    }
    const n = nodes.find((x) => x.id === connectSourceId)
    if (!n) {
      rubberFromRef.current = null
      return null
    }
    const from = presentWorld(attachPoint(n, null), projectionT)
    rubberFromRef.current = from
    return from
  }, [connectSourceId, nodes, projectionT])

  const viewBoxStr = `${view.x} ${view.y} ${view.w} ${view.h}`
  const cursor = marquee
    ? 'cursor-crosshair'
    : panning && panMoved.current
      ? 'cursor-grabbing'
      : placingArchetype || connectMode
        ? 'cursor-crosshair'
        : 'cursor-grab'

  const marqueeRect = marquee
    ? {
        x: Math.min(marquee.x0, marquee.x1),
        y: Math.min(marquee.y0, marquee.y1),
        w: Math.abs(marquee.x1 - marquee.x0),
        h: Math.abs(marquee.y1 - marquee.y0),
      }
    : null

  return (
    <div
      className="relative flex h-full min-h-0 w-full flex-col"
      style={{ backgroundColor: floorTheme.hostBg }}
    >
      {!chromeMounted ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-200 bg-white/95 px-3 py-2 text-sm text-zinc-600">
          <span className="font-medium text-zinc-900">SVG canvas spike</span>
          <span className="text-zinc-300">|</span>
          <span className="text-zinc-500">
            Connect · Ctrl+A/C/V · undo Ctrl+Z · drag empty to pan
          </span>
          <MiniPalette />
          <ConnectToggle />
          <ReplicasStepper />
          <ShardsStepper />
          <EngineSelect />
          <FxDemoControls />
          {import.meta.env.DEV ? <DevTemplateLayoutPreview /> : null}
          <div className="ml-2">
            <GridModeToggle mode={mode} onChange={setGridMode} />
          </div>
          <div className="ml-2">
            <FloorThemeToggle theme={floorThemeId} onChange={setFloorTheme} />
          </div>
          <div className="ml-2">
            <EdgeStylePresetToggle
              preset={edgeStylePreset}
              onChange={setEdgeStylePreset}
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
              onClick={() => zoomBy(ZOOM_FACTOR)}
              aria-label="Zoom out"
            >
              −
            </button>
            <button
              type="button"
              className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
              onClick={() => zoomBy(1 / ZOOM_FACTOR)}
              aria-label="Zoom in"
            >
              +
            </button>
            <ProjectionToggle />
            <button
              type="button"
              className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
              onClick={fitDefault}
            >
              Reset view
            </button>
            <button
              type="button"
              className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 disabled:opacity-50"
              onClick={() => void exportSvg()}
              disabled={exporting}
            >
              {exporting ? 'Exporting…' : 'Export SVG'}
            </button>
          </div>
          <span className="ml-auto text-xs text-zinc-500">{latticeHint}</span>
        </div>
      ) : (
        <>
          {devToolsVisible ? null : (
            <div className="absolute bottom-16 left-3 z-20">
              <ProjectionToggle />
            </div>
          )}
          {import.meta.env.DEV && chromeMode !== 'clean' ? (
            <div className="pointer-events-none absolute bottom-20 left-3 z-20">
              <DevTemplateLayoutPreview compact />
            </div>
          ) : null}
          {devToolsVisible ? (
            <div className="pointer-events-none absolute bottom-20 right-3 z-20 flex flex-col items-end gap-1.5">
              {debugExtrasVisible ? <FxDemoControls compact /> : null}
              <ProjectionToggle />
              <GridModeToggle mode={mode} onChange={setGridMode} compact />
              <FloorThemeToggle
                theme={floorThemeId}
                onChange={setFloorTheme}
                compact
              />
              <EdgeStylePresetToggle
                preset={edgeStylePreset}
                onChange={setEdgeStylePreset}
                compact
              />
              <div className="pointer-events-auto flex items-center gap-0.5">
                <button
                  type="button"
                  className="rounded px-1.5 py-0.5 text-[10px] text-[var(--c9-muted)]/80 hover:text-[var(--c9-text)]"
                  onClick={() => zoomBy(ZOOM_FACTOR)}
                  aria-label="Zoom out"
                >
                  −
                </button>
                <button
                  type="button"
                  className="rounded px-1.5 py-0.5 text-[10px] text-[var(--c9-muted)]/80 hover:text-[var(--c9-text)]"
                  onClick={() => zoomBy(1 / ZOOM_FACTOR)}
                  aria-label="Zoom in"
                >
                  +
                </button>
                <button
                  type="button"
                  className="rounded px-1.5 py-0.5 text-[10px] text-[var(--c9-muted)]/80 hover:text-[var(--c9-text)]"
                  onClick={fitDefault}
                  title="Fit (F)"
                >
                  Fit
                </button>
                <button
                  type="button"
                  className="rounded px-1.5 py-0.5 text-[10px] text-[var(--c9-muted)]/80 hover:text-[var(--c9-text)] disabled:opacity-50"
                  onClick={() => void exportSvg()}
                  disabled={exporting}
                  title="Download SVG (bounded board, or design + padding)"
                >
                  {exporting ? '…' : 'SVG'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setDevCanvasToolsVisible(false)}
                title={
                  import.meta.env.DEV
                    ? 'Hide view tools. Press ` for clean chrome.'
                    : 'Hide view tools'
                }
                className="pointer-events-auto rounded px-1.5 py-0.5 text-[10px] text-[var(--c9-muted)]/70 hover:text-[var(--c9-text)]"
              >
                Hide
              </button>
            </div>
          ) : chromeMode !== 'clean' ? (
            <button
              type="button"
              onClick={() => setDevCanvasToolsVisible(true)}
              className="pointer-events-auto absolute bottom-20 right-3 z-20 rounded px-1.5 py-0.5 text-[10px] text-[var(--c9-muted)]/70 hover:text-[var(--c9-text)]"
            >
              View
            </button>
          ) : null}
        </>
      )}

      <div
        ref={hostRef}
        className={`cv-canvas-host relative min-h-0 flex-1${
          templatePreviewActive ? ' ghosting' : ''
        }`}
        data-state={nodes.length > 0 ? 'placed' : 'empty'}
      >
        <svg
          ref={svgRef}
          className={`absolute inset-0 h-full w-full touch-none ${cursor}`}
          viewBox={viewBoxStr}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onContextMenu={onContextMenu}
          role="img"
          aria-label={projectionT < 0.5 ? 'Isometric canvas' : 'Flat canvas'}
        >
          <GridPatterns theme={floorTheme} />
          <HealthRimFilters />
          <rect
            id="interactionLayer"
            x={view.x}
            y={view.y}
            width={view.w}
            height={view.h}
            fill="transparent"
          />
          <Floor
            mode={mode}
            theme={floorTheme}
            viewX={view.x}
            viewY={view.y}
            viewW={view.w}
            viewH={view.h}
            t={projectionT}
          />
          <g
            opacity={templatePreviewDimOpacity(
              templatePreviewActive,
              window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            )}
          >
          <LiveZoneLayer
            zones={zones}
            nodes={nodes}
            selectedOwnerIds={selectedIds}
            ownerOpacityById={walkthroughOpacityById ?? undefined}
            onZonePointerDown={onZonePointerDown}
            onZonePointerEnter={onNodePointerEnter}
            onZonePointerLeave={onNodePointerLeave}
          />
          <EdgeLayer
            edges={edges}
            selectedEdgeIds={selectedEdgeIds}
            edgeStylePreset={edgeStylePreset}
            floorTheme={floorThemeId}
            paint="segments"
            hoveredEdgeId={hoveredEdgeId}
            model={edgeRenderModel}
            onEdgePointerDown={onEdgePointerDown}
            onEdgePointerEnter={onEdgePointerEnter}
            onEdgePointerLeave={onEdgePointerLeave}
          />
          <TrafficLayer edges={edges} />
          {rubberFrom ? (
            <line
              ref={rubberLineRef}
              data-export-strip=""
              x1={rubberFrom.x}
              y1={rubberFrom.y}
              x2={rubberFrom.x}
              y2={rubberFrom.y}
              stroke="#3b82f6"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              style={{ pointerEvents: 'none' }}
            />
          ) : null}
          {sortedNodes.map((node) => {
            const pickUnits = unitPickEnabled(node.id)
            return (
            <LiveNodeGlyph
              key={node.id}
              node={node}
              selected={
                selectedSet.has(node.id) || node.id === connectSourceId
              }
              interactive={!spaceDown && !panning && !marquee}
              opacity={nodeOpacityById?.get(node.id) ?? 1}
              appear={canvasMode !== 'live' && appearIds.has(node.id)}
              onPointerDown={(ev) => beginNodeDrag(node.id, ev)}
              onPointerEnter={() => onNodePointerEnter(node.id)}
              onPointerLeave={() => onNodePointerLeave(node.id)}
              onUnitPointerDown={
                pickUnits
                  ? (unitIndex, ev) => onUnitPointerDown(node.id, unitIndex, ev)
                  : undefined
              }
              onUnitPointerEnter={
                pickUnits
                  ? (unitIndex) => onUnitPointerEnter(node.id, unitIndex)
                  : undefined
              }
              onUnitPointerLeave={
                pickUnits ? () => onUnitPointerLeave(node.id) : undefined
              }
            />
            )
          })}
          <InstanceScopeClusterPickLayer
            canvasMode={canvasMode}
            canvasNodes={canvasNodes}
            nodes={sortedNodes}
            selectedIds={selectedIds}
            ownerOpacityById={walkthroughOpacityById ?? undefined}
            onClusterPointerDown={onZonePointerDown}
            onClusterPointerEnter={onNodePointerEnter}
            onClusterPointerLeave={onNodePointerLeave}
          />
          <EdgeLayer
            edges={edges}
            selectedEdgeIds={selectedEdgeIds}
            edgeStylePreset={edgeStylePreset}
            floorTheme={floorThemeId}
            paint="terminals"
            hoveredEdgeId={hoveredEdgeId}
            model={edgeRenderModel}
            onEdgePointerDown={onEdgePointerDown}
            onEdgePointerEnter={onEdgePointerEnter}
            onEdgePointerLeave={onEdgePointerLeave}
          />
          <NodeLabelChrome
            nodes={sortedNodes}
            opacityById={nodeOpacityById ?? undefined}
          />
          </g>
          <TemplateFloorPreviewLayer />
          <WalkthroughNodeOverlay nodes={sortedNodes} />
          {marqueeRect && marqueeRect.w + marqueeRect.h > 0 ? (
            <rect
              data-export-strip=""
              x={marqueeRect.x}
              y={marqueeRect.y}
              width={marqueeRect.w}
              height={marqueeRect.h}
              fill="rgba(59, 130, 246, 0.12)"
              stroke="#3b82f6"
              strokeWidth={1}
              style={{ pointerEvents: 'none' }}
            />
          ) : null}
        </svg>
        <SvgNodeTooltipOverlay />
        {canvasMode === 'design' &&
        nodes.length === 0 &&
        !templatePreviewActive ? (
          <p className="cv-floor-hint" id="floor-hint">
            Hover a lab in the sidebar to preview it
          </p>
        ) : null}
        {graphHonestyIssue ? (
          <GraphHonestyStrip
            message={graphHonestyIssue}
            collapseLabel={
              singletonCollapse
                ? singletonCollapseButtonLabel(singletonCollapse)
                : undefined
            }
            onCollapse={singletonCollapse ? onCollapseSingleton : undefined}
          />
        ) : null}
        {edgeMeaning ? <EdgeMeaningStrip result={edgeMeaning} /> : null}
      </div>
    </div>
  )
}
