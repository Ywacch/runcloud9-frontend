import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import {
  registerCanvasFitScheduler,
  unregisterCanvasFitScheduler,
} from '../canvas/utils/canvasFitBridge'
import {
  isMetricsViewportMode,
  useCanvasStore,
  type CanvasNode,
} from '../editor-core/stores/canvasStore'
import { useCanvasContextMenuStore } from '../editor-core/stores/contextMenuStore'
import {
  canMoveOnCanvas,
  canPlaceOnCanvas,
} from '../lib/canvasContextMenuCatalog'
import { placeFromPicker } from '../lib/pickerPlacement'
import {
  SPAWN_AT_SCREEN,
  type SpawnAtScreenDetail,
} from '../lib/spawnEvents'
import {
  isWalkthroughRunning,
  walkthroughNodeAlpha,
  walkthroughNodeRole,
} from '../canvas/utils/walkthroughVisual'
import { ConnectToggle } from './components/ConnectToggle'
import { EdgeLayer } from './components/EdgeLayer'
import { EngineSelect } from './components/EngineSelect'
import { Floor, type GridMode } from './components/Floor'
import { FxDemoControls } from './components/FxDemoControls'
import { GridModeToggle } from './components/GridModeToggle'
import { GridPatterns } from './components/GridPatterns'
import { HealthRimFilters } from './fx/HealthRimFilters'
import { MiniPalette } from './components/MiniPalette'
import { ReplicasStepper } from './components/ReplicasStepper'
import { ShardsStepper } from './components/ShardsStepper'
import { SvgNodeTooltipOverlay } from './components/SvgNodeTooltipOverlay'
import { TrafficLayer } from './components/TrafficLayer'
import { WalkthroughNodeOverlay } from './components/WalkthroughNodeOverlay'
import { NodeLabelChrome } from './components/NodeLabelChrome'
import { ZoneLayer } from './components/ZoneLayer'
import { svgWorldToCanvasPosition } from './bridge/canvasSvgAdapter'
import { syncZoneForNode } from './compose/syncZoneForNode'
import { NodeGlyph } from './glyphs/NodeGlyph'
import { useSvgCanvasKeyboard } from './hooks/useSvgCanvasKeyboard'
import { screenToIso, snapWorld, type WorldPoint } from './math/iso'
import { attachPoint } from './routing/attach'
import {
  installCanvasSvgBridge,
  useSvgCanvasStore,
} from './store/svgCanvasStore'
import {
  notifySvgViewportScreenRefresh,
  registerSvgViewport,
  unregisterSvgViewport,
} from './utils/svgViewportBridge'
import { findSvgNodeIdAtWorldPoint } from './utils/svgContextHitTest'
import {
  readStoredGridMode,
  writeStoredGridMode,
} from './utils/gridModePreference'

const MIN_VIEW = 400
const MAX_VIEW = 8000
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
  const pad = 320
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
    selectNode: state.selectNode,
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
  const [mode, setMode] = useState<GridMode>(() => readStoredGridMode())
  const setGridMode = useCallback((next: GridMode) => {
    setMode(next)
    writeStoredGridMode(next)
  }, [])
  const [spaceDown, setSpaceDown] = useState(false)
  const [panning, setPanning] = useState(false)
  const [drag, setDrag] = useState<DragSession | null>(null)
  const [marquee, setMarquee] = useState<Marquee | null>(null)
  const [rubberTip, setRubberTip] = useState<WorldPoint | null>(null)
  const panLast = useRef<{ x: number; y: number } | null>(null)
  const panOrigin = useRef<{ x: number; y: number } | null>(null)
  const panMoved = useRef(false)
  const dragRef = useRef<DragSession | null>(null)
  const marqueeRef = useRef<Marquee | null>(null)
  const marqueeActive = useRef(false)

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
  useSvgCanvasKeyboard()

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
    if (spaceDown || panning || marquee || drag) {
      useCanvasStore.getState().setHoveredNodeId(null)
    }
  }, [spaceDown, panning, marquee, drag])

  // Read live store nodes — React state is stale right after auto-arrange /
  // LB inject sync (requestCanvasFit runs before paint).
  const fitDefault = useCallback(() => {
    const host = hostRef.current
    if (!host) return
    const { width, height } = host.getBoundingClientRect()
    setView(
      fitViewToNodes(useSvgCanvasStore.getState().nodes, width, height),
    )
  }, [])

  useEffect(() => {
    registerCanvasFitScheduler(fitDefault)
    return () => unregisterCanvasFitScheduler()
  }, [fitDefault])

  useEffect(() => {
    const onSpawn = (event: Event) => {
      const detail = (event as CustomEvent<SpawnAtScreenDetail>).detail
      if (!detail || !isPaletteNodeType(detail.nodeType)) return
      const svg = svgRef.current
      if (!svg) return
      const world = clientToWorld(svg, detail.clientX, detail.clientY)
      placePickerAtWorld(world.x, world.y, detail.nodeType)
    }
    window.addEventListener(SPAWN_AT_SCREEN, onSpawn)
    return () => window.removeEventListener(SPAWN_AT_SCREEN, onSpawn)
  }, [])

  useEffect(() => {
    if (!connectSourceId) setRubberTip(null)
  }, [connectSourceId])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const sync = () => {
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
    const world = clientToWorld(svg, e.clientX, e.clientY)
    const svgNodes = useSvgCanvasStore.getState().nodes
    const hitId = findSvgNodeIdAtWorldPoint(svgNodes, world.x, world.y)
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
      position: svgWorldToCanvasPosition(world.x, world.y),
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
          setRubberTip(null)
        } else {
          addEdge(state.connectSourceId, nodeId)
          setRubberTip(null)
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
      if (!already) selectOnly(nodeId)

      if (!canMoveOnCanvas(canvas.movementLocked)) return

      const world = clientToWorld(svg, e.clientX, e.clientY)
      const origins: Record<string, WorldPoint> = {}
      for (const id of ids) {
        const n = state.nodes.find((x) => x.id === id)
        if (n) origins[id] = { x: n.x, y: n.y }
      }
      origins[nodeId] = { x: node.x, y: node.y }

      const session: DragSession = {
        primaryId: nodeId,
        ids: Object.keys(origins),
        origins,
        grabWorld: world,
        dx: 0,
        dy: 0,
      }
      dragRef.current = session
      setDrag(session)
      svg.setPointerCapture(e.pointerId)
    },
    [spaceDown, selectOnly, toggleInSelection, setConnectSourceId, addEdge],
  )

  const onNodePointerEnter = useCallback((nodeId: string) => {
    const state = useCanvasStore.getState()
    if (!isMetricsViewportMode(state.mode)) return
    if (dragRef.current) return
    state.setHoveredNodeId(nodeId)
  }, [])

  const onNodePointerLeave = useCallback((nodeId: string) => {
    const state = useCanvasStore.getState()
    if (state.hoveredNodeId === nodeId) {
      state.setHoveredNodeId(null)
    }
  }, [])

  const onZonePointerDown = useCallback(
    (ownerNodeId: string, e: ReactPointerEvent<SVGElement>) => {
      if (e.button !== 0 || spaceDown) return
      e.stopPropagation()
      beginNodeDrag(ownerNodeId, e as unknown as ReactPointerEvent<SVGGElement>)
    },
    [spaceDown, beginNodeDrag],
  )

  const onEdgePointerDown = useCallback(
    (edgeId: string, e: ReactPointerEvent<SVGElement>) => {
      if (e.button !== 0 || spaceDown) return
      e.stopPropagation()
      selectEdgesOnly([edgeId])
    },
    [spaceDown, selectEdgesOnly],
  )

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

      const world = clientToWorld(svg, e.clientX, e.clientY)
      if (useSvgCanvasStore.getState().connectSourceId) {
        setRubberTip(world)
      }

      if (marqueeActive.current && marqueeRef.current) {
        const m = {
          ...marqueeRef.current,
          x1: world.x,
          y1: world.y,
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
      const updated: DragSession = {
        ...session,
        dx: world.x - session.grabWorld.x,
        dy: world.y - session.grabWorld.y,
      }
      dragRef.current = updated
      setDrag(updated)
    },
    [panning],
  )

  const endPointer = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current

      if (dragRef.current) {
        const session = dragRef.current
        const updates = session.ids.map((id) => {
          const o = session.origins[id]
          return {
            id,
            x: o.x + session.dx,
            y: o.y + session.dy,
          }
        })
        moveNodes(updates)
        dragRef.current = null
        setDrag(null)
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
          const ids = anchorsInMarquee(
            useSvgCanvasStore.getState().nodes,
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
          const world = clientToWorld(svg, e.clientX, e.clientY)
          const st = useSvgCanvasStore.getState()
          if (st.connectMode) {
            setConnectSourceId(null)
            setRubberTip(null)
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

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const liveById = useMemo(() => {
    if (!drag) return null as Map<string, WorldPoint> | null
    const map = new Map<string, WorldPoint>()
    for (const id of drag.ids) {
      const o = drag.origins[id]
      map.set(id, { x: o.x + drag.dx, y: o.y + drag.dy })
    }
    return map
  }, [drag])

  const liveZones = useMemo(() => {
    if (!liveById) return zones
    return nodes.flatMap((n) => {
      const live = liveById.get(n.id)
      const node = live ? { ...n, x: live.x, y: live.y } : n
      const z = syncZoneForNode(node)
      return z ? [z] : []
    })
  }, [zones, nodes, liveById])

  const canvasMode = useCanvasStore((s) => s.mode)
  const walkthroughActiveNodeId = useCanvasStore((s) => s.walkthroughActiveNodeId)
  const walkthroughVisitedNodeIds = useCanvasStore(
    (s) => s.walkthroughVisitedNodeIds,
  )
  const walkthroughParticipatingNodeIds = useCanvasStore(
    (s) => s.walkthroughParticipatingNodeIds,
  )
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
      const live = liveById?.get(id) ?? (node ? { x: node.x, y: node.y } : null)
      if (!live || !node) return `1 selected · ${nodes.length} nodes`
      const snapped = snapWorld(live.x, live.y)
      const iso = screenToIso(snapped.x, snapped.y)
      return `${drag ? 'glide' : 'rest'} ${node.label} → (${iso.i.toFixed(1)}, ${iso.j.toFixed(1)})`
    }
    return `${nSel} selected · ${nodes.length} nodes`
  }, [
    nodes,
    edges.length,
    selectedIds,
    selectedEdgeIds,
    drag,
    placingArchetype,
    liveById,
    connectMode,
    connectSourceId,
  ])

  const rubberFrom = useMemo(() => {
    if (!connectSourceId) return null
    const n = nodes.find((x) => x.id === connectSourceId)
    return n ? attachPoint(n) : null
  }, [connectSourceId, nodes])

  const viewBoxStr = `${view.x} ${view.y} ${view.w} ${view.h}`
  const cursor = drag || marquee
    ? drag
      ? 'cursor-grabbing'
      : 'cursor-crosshair'
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
    <div className="relative flex h-full min-h-0 w-full flex-col bg-[#f4f5f7]">
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
          <div className="ml-2">
            <GridModeToggle mode={mode} onChange={setGridMode} />
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
            <button
              type="button"
              className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
              onClick={fitDefault}
            >
              Reset view
            </button>
          </div>
          <span className="ml-auto text-xs text-zinc-500">{latticeHint}</span>
        </div>
      ) : (
        <div className="pointer-events-none absolute bottom-20 right-3 z-20 flex flex-col items-end gap-2">
          {import.meta.env.DEV ? <FxDemoControls compact /> : null}
          <GridModeToggle mode={mode} onChange={setGridMode} compact />
          <div className="pointer-events-auto flex items-center gap-1 rounded-md border border-zinc-300/80 bg-white/90 p-0.5 shadow-sm backdrop-blur-sm">
            <button
              type="button"
              className="rounded px-2 py-1 text-[10px] text-zinc-600 hover:bg-zinc-100"
              onClick={() => zoomBy(ZOOM_FACTOR)}
              aria-label="Zoom out"
            >
              −
            </button>
            <button
              type="button"
              className="rounded px-2 py-1 text-[10px] text-zinc-600 hover:bg-zinc-100"
              onClick={() => zoomBy(1 / ZOOM_FACTOR)}
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              className="rounded px-2 py-1 text-[10px] text-zinc-600 hover:bg-zinc-100"
              onClick={fitDefault}
              title="Fit (F)"
            >
              Fit
            </button>
          </div>
        </div>
      )}

      <div ref={hostRef} className="relative min-h-0 flex-1">
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
          aria-label="Isometric SVG design canvas"
        >
          <GridPatterns />
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
            viewX={view.x}
            viewY={view.y}
            viewW={view.w}
            viewH={view.h}
          />
          <ZoneLayer
            zones={liveZones}
            selectedOwnerIds={selectedIds}
            ownerOpacityById={walkthroughOpacityById ?? undefined}
            onZonePointerDown={onZonePointerDown}
            onZonePointerEnter={onNodePointerEnter}
            onZonePointerLeave={onNodePointerLeave}
          />
          <EdgeLayer
            edges={edges}
            selectedEdgeIds={selectedEdgeIds}
            onEdgePointerDown={onEdgePointerDown}
          />
          <TrafficLayer edges={edges} />
          {rubberFrom && rubberTip ? (
            <line
              x1={rubberFrom.x}
              y1={rubberFrom.y}
              x2={rubberTip.x}
              y2={rubberTip.y}
              stroke="#3b82f6"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              style={{ pointerEvents: 'none' }}
            />
          ) : null}
          {sortedNodes.map((node) => {
            const live = liveById?.get(node.id) ?? { x: node.x, y: node.y }
            const opacity = walkthroughOpacityById?.get(node.id) ?? 1
            return (
              <g key={node.id} opacity={opacity}>
                <NodeGlyph
                  node={node}
                  x={live.x}
                  y={live.y}
                  selected={
                    selectedSet.has(node.id) || node.id === connectSourceId
                  }
                  interactive={!spaceDown && !panning && !marquee}
                  onPointerDown={(ev) => beginNodeDrag(node.id, ev)}
                  onPointerEnter={() => onNodePointerEnter(node.id)}
                  onPointerLeave={() => onNodePointerLeave(node.id)}
                />
              </g>
            )
          })}
          <NodeLabelChrome
            nodes={sortedNodes}
            liveById={liveById ?? undefined}
            opacityById={walkthroughOpacityById ?? undefined}
          />
          <WalkthroughNodeOverlay
            nodes={sortedNodes}
            liveById={liveById ?? undefined}
          />
          {marqueeRect && marqueeRect.w + marqueeRect.h > 0 ? (
            <rect
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
      </div>
    </div>
  )
}
