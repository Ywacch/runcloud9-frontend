/**
 * SVG design-scene store — projection + UI façade over product `canvasStore`.
 * Nodes/edges/selection/placement are owned by canvasStore; waypoints/zones are derived.
 */
import { create } from 'zustand'
import {
  canMutateCanvasLayout,
  canMutateCanvasTopology,
  isMetricsViewportMode,
  useCanvasStore,
  type CanvasMode,
  type CanvasNode,
} from '../../editor-core/stores/canvasStore'
import { useMetricsStore } from '../../editor-core/stores/metricsStore'
import { useChaosStore } from '../../editor-core/stores/chaosStore'
import {
  recordCanvasHistory,
  withoutCanvasHistoryRecording,
} from '../../lib/canvasHistory'
import {
  BACKEND_SUPPORTS_SHARDING,
  backendSupportsReplicas,
  isBackendSupportedEngine,
} from '../../lib/backendCapabilities'
import { defaultEdgeProtocol } from '../../lib/defaultEdgeProtocol'
import { createCanvasNode } from '../../lib/nodeFactory'
import { placeFromPicker } from '../../lib/pickerPlacement'
import {
  canMoveOnCanvas,
  canPlaceOnCanvas,
} from '../../lib/canvasContextMenuCatalog'
import {
  applySessionLayoutToNodes,
  clearSessionLayout,
  setSessionLayoutOffsets,
} from '../../lib/sessionLayoutStore'
import { isVariationTopologyLocked } from '../../lib/variationTopologyLock'
import { APP_SERVER_REPLICA_MAX } from '../../lib/replicaConfig'
import {
  archetypeToCanvasType,
  canvasTypeToArchetype,
  configPatchForEngine,
  configPatchForReplicas,
  configPatchForShards,
  svgWorldToCanvasPosition,
} from '../bridge/canvasSvgAdapter'
import { projectSvgScene, rerouteSvgEdgesForNodes } from '../bridge/projectSvgScene'
import { mapSvgNodesWithLiveHealth } from '../fx/syncLiveHealth'
import { HALF_H, HALF_W, snapWorld } from '../math/iso'
import {
  cloneSvgNode,
  type Archetype,
  type SvgEdge,
  type SvgNode,
  type SvgZone,
} from './svgTypes'
import type { HealthVisualState } from '../../canvas/utils/healthVisual'
import { syncExpandWithSelection } from './expandStore'

export type { Archetype, SvgEdge, SvgNode, SvgZone } from './svgTypes'

let clipboard: SvgNode[] = []
let bridgeInstalled = false
let unsubscribeCanvas: (() => void) | null = null
let unsubscribeMetrics: (() => void) | null = null
let unsubscribeChaos: (() => void) | null = null
/** Last canvas mode seen by syncFromCanvas — used to clear rims leaving live/sim. */
let lastSyncedMode: CanvasMode | null = null

type SvgCanvasState = {
  nodes: SvgNode[]
  edges: SvgEdge[]
  zones: SvgZone[]
  selectedIds: string[]
  selectedEdgeIds: string[]
  placingArchetype: Archetype | null
  connectMode: boolean
  connectSourceId: string | null
  /** @deprecated Kept for keyboard paste sequencing; labels come from createCanvasNode. */
  labelSeq: number
  setPlacingArchetype: (a: Archetype | null) => void
  togglePlacingArchetype: (a: Archetype) => void
  setConnectMode: (on: boolean) => void
  setConnectSourceId: (id: string | null) => void
  placeNodeAt: (x: number, y: number) => void
  selectOnly: (id: string | null) => void
  toggleInSelection: (id: string) => void
  selectAllNodes: () => void
  setSelectedIds: (ids: string[]) => void
  selectEdgesOnly: (ids: string[]) => void
  setNodeReplicas: (id: string, replicas: number) => void
  setNodeEngine: (id: string, engine: string) => void
  setNodeShards: (id: string, shards: number) => void
  setNodeHealthVisual: (
    ids: string[],
    healthVisual: HealthVisualState,
  ) => void
  setEdgesTrafficEnabled: (ids: string[] | 'all', enabled: boolean) => void
  addEdge: (sourceId: string, targetId: string) => void
  moveNodes: (updates: { id: string; x: number; y: number }[]) => void
  rerouteEdgesForNodes: (nodeIds: string[]) => void
  removeSelected: () => void
  copySelected: () => void
  pasteClipboard: () => void
  clearPlacementAndSelection: () => void
  undo: () => void
  redo: () => void
}

function selectionFromCanvas(): string[] {
  const c = useCanvasStore.getState()
  if (c.selectedIds.length > 0) return c.selectedIds
  return c.selectedId ? [c.selectedId] : []
}

function selectionEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function patchSelectionFromCanvas(): void {
  const next = selectionFromCanvas()
  const prev = useSvgCanvasStore.getState()
  if (selectionEqual(next, prev.selectedIds)) return
  useSvgCanvasStore.setState({ selectedIds: next })
  syncExpandWithSelection(next, prev.nodes)
}

function patchPlacementFromCanvas(): void {
  const c = useCanvasStore.getState()
  const placingArchetype = c.placingNodeType
    ? canvasTypeToArchetype(c.placingNodeType)
    : null
  const connectMode = c.designTool === 'connect'
  const connectSourceId = c.pendingSourceId
  const prev = useSvgCanvasStore.getState()
  if (
    prev.placingArchetype === placingArchetype &&
    prev.connectMode === connectMode &&
    prev.connectSourceId === connectSourceId
  ) {
    return
  }
  useSvgCanvasStore.setState({
    placingArchetype,
    connectMode,
    connectSourceId,
  })
}

type CanvasBridgeFields = {
  nodes: ReturnType<typeof useCanvasStore.getState>['nodes']
  edges: ReturnType<typeof useCanvasStore.getState>['edges']
  mode: CanvasMode
  selectedId: string | null
  selectedIds: string[]
  placingNodeType: CanvasNode['type'] | null
  designTool: ReturnType<typeof useCanvasStore.getState>['designTool']
  pendingSourceId: string | null
}

function bridgeFieldsFrom(
  c: ReturnType<typeof useCanvasStore.getState>,
): CanvasBridgeFields {
  return {
    nodes: c.nodes,
    edges: c.edges,
    mode: c.mode,
    selectedId: c.selectedId,
    selectedIds: c.selectedIds,
    placingNodeType: c.placingNodeType,
    designTool: c.designTool,
    pendingSourceId: c.pendingSourceId,
  }
}

function syncFromCanvas(): void {
  const c = useCanvasStore.getState()
  const projected = projectSvgScene(c.nodes, c.edges)
  const prev = useSvgCanvasStore.getState()
  const prevHealth = new Map(
    prev.nodes.map((n) => [n.id, n.healthVisual] as const),
  )
  const leftMetricsMode =
    lastSyncedMode != null &&
    isMetricsViewportMode(lastSyncedMode) &&
    !isMetricsViewportMode(c.mode)
  lastSyncedMode = c.mode

  const metrics = useMetricsStore.getState().metrics
  const isTargetActive = useChaosStore.getState().isTargetActive
  const nodes = mapSvgNodesWithLiveHealth(
    projected.nodes,
    c.nodes,
    c.mode,
    metrics,
    isTargetActive,
    prevHealth,
    leftMetricsMode,
  )

  const edgeIds = new Set(projected.edges.map((e) => e.id))
  const selectedIds = selectionFromCanvas()
  useSvgCanvasStore.setState({
    nodes,
    edges: projected.edges,
    zones: projected.zones,
    selectedIds,
    selectedEdgeIds: prev.selectedEdgeIds.filter((id) => edgeIds.has(id)),
    placingArchetype: c.placingNodeType
      ? canvasTypeToArchetype(c.placingNodeType)
      : null,
    connectMode: c.designTool === 'connect',
    connectSourceId: c.pendingSourceId,
  })
  syncExpandWithSelection(selectedIds, nodes)
}

function syncSessionLayoutEdges(movedNodeIds: string[]): void {
  if (movedNodeIds.length === 0) return
  const prev = useSvgCanvasStore.getState()
  const placedNodes = applySessionLayoutToNodes(prev.nodes)
  const edges = rerouteSvgEdgesForNodes(placedNodes, prev.edges, movedNodeIds)
  useSvgCanvasStore.setState({ edges })
}

/** Metrics/chaos-only patch — avoids full topology reproject on every sample. */
function patchLiveHealthVisuals(): void {
  const c = useCanvasStore.getState()
  if (!isMetricsViewportMode(c.mode)) return
  const metrics = useMetricsStore.getState().metrics
  const isTargetActive = useChaosStore.getState().isTargetActive
  const prev = useSvgCanvasStore.getState().nodes
  const prevHealth = new Map(prev.map((n) => [n.id, n.healthVisual] as const))
  const nodes = mapSvgNodesWithLiveHealth(
    prev,
    c.nodes,
    c.mode,
    metrics,
    isTargetActive,
    prevHealth,
    false,
  )
  if (nodes.some((n, i) => n !== prev[i])) {
    useSvgCanvasStore.setState({ nodes })
  }
}

/**
 * Subscribe SVG projection to product canvasStore. Safe to call multiple times.
 * Call from SvgDesignCanvas mount.
 */
export function installCanvasSvgBridge(): void {
  if (bridgeInstalled) {
    syncFromCanvas()
    return
  }
  bridgeInstalled = true
  syncFromCanvas()
  let prev = bridgeFieldsFrom(useCanvasStore.getState())
  unsubscribeCanvas = useCanvasStore.subscribe((state) => {
    const next = bridgeFieldsFrom(state)
    const topologyChanged =
      next.nodes !== prev.nodes ||
      next.edges !== prev.edges ||
      next.mode !== prev.mode
    const selectionChanged =
      next.selectedId !== prev.selectedId ||
      next.selectedIds !== prev.selectedIds
    const placementChanged =
      next.placingNodeType !== prev.placingNodeType ||
      next.designTool !== prev.designTool ||
      next.pendingSourceId !== prev.pendingSourceId

    if (topologyChanged) {
      syncFromCanvas()
    } else {
      if (selectionChanged) patchSelectionFromCanvas()
      if (placementChanged) patchPlacementFromCanvas()
    }
    prev = next
  })
  unsubscribeMetrics = useMetricsStore.subscribe((state, prevMetrics) => {
    if (state.metrics !== prevMetrics.metrics) patchLiveHealthVisuals()
  })
  unsubscribeChaos = useChaosStore.subscribe(() => {
    patchLiveHealthVisuals()
  })
}

/** Test helper: reset bridge + local UI (does not clear canvasStore). */
export function resetCanvasSvgBridgeForTests(): void {
  unsubscribeCanvas?.()
  unsubscribeCanvas = null
  unsubscribeMetrics?.()
  unsubscribeMetrics = null
  unsubscribeChaos?.()
  unsubscribeChaos = null
  bridgeInstalled = false
  lastSyncedMode = null
  clipboard = []
  clearSessionLayout()
  useSvgCanvasStore.setState({
    nodes: [],
    edges: [],
    zones: [],
    selectedIds: [],
    selectedEdgeIds: [],
    placingArchetype: null,
    connectMode: false,
    connectSourceId: null,
    labelSeq: 2,
  })
}

export const useSvgCanvasStore = create<SvgCanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  zones: [],
  selectedIds: [],
  selectedEdgeIds: [],
  placingArchetype: null,
  connectMode: false,
  connectSourceId: null,
  labelSeq: 2,

  setPlacingArchetype: (placingArchetype) => {
    const type = placingArchetype
      ? archetypeToCanvasType(placingArchetype)
      : null
    const canvas = useCanvasStore.getState()
    canvas.setPlacingNodeType(type)
    if (type) {
      canvas.setDesignTool('select')
      canvas.setPendingSource(null)
    }
  },

  togglePlacingArchetype: (a) => {
    const cur = get().placingArchetype
    get().setPlacingArchetype(cur === a ? null : a)
  },

  setConnectMode: (on) => {
    const canvas = useCanvasStore.getState()
    if (on) {
      canvas.setPlacingNodeType(null)
      canvas.setDesignTool('connect')
      canvas.setPendingSource(null)
    } else {
      canvas.setDesignTool('select')
      canvas.setPendingSource(null)
    }
  },

  setConnectSourceId: (connectSourceId) => {
    useCanvasStore.getState().setPendingSource(connectSourceId)
  },

  placeNodeAt: (x, y) => {
    const canvas = useCanvasStore.getState()
    if (
      !canMutateCanvasTopology(canvas) ||
      !canPlaceOnCanvas(canvas.mode, canvas.movementLocked)
    ) {
      return
    }
    const type = canvas.placingNodeType
    if (!type || type === 'client') return
    const position = svgWorldToCanvasPosition(x, y)
    placeFromPicker({
      nodeType: type,
      position,
      nodes: canvas.nodes,
      addNode: canvas.addNode,
      updateNodeConfig: canvas.updateNodeConfig,
    })
    canvas.setPlacingNodeType(null)
  },

  selectOnly: (id) => {
    useCanvasStore.getState().selectNode(id)
    set({ selectedEdgeIds: [] })
  },

  toggleInSelection: (id) => {
    const ids = selectionFromCanvas()
    const has = ids.includes(id)
    const next = has ? ids.filter((sid) => sid !== id) : [...ids, id]
    useCanvasStore.getState().setSelectedIds(next)
    set({ selectedEdgeIds: [] })
  },

  selectAllNodes: () => {
    useCanvasStore.getState().selectAllNodes()
    set({ selectedEdgeIds: [] })
  },

  setSelectedIds: (selectedIds) => {
    useCanvasStore.getState().setSelectedIds(selectedIds)
    set({ selectedEdgeIds: [] })
  },

  selectEdgesOnly: (selectedEdgeIds) => {
    useCanvasStore.getState().setSelectedIds([])
    set({ selectedEdgeIds, selectedIds: [] })
  },

  setNodeReplicas: (id, replicas) => {
    const canvas = useCanvasStore.getState()
    const node = canvas.nodes[id]
    if (!node || !canMutateCanvasTopology(canvas)) return
    if (!backendSupportsReplicas(node.type)) return
    const next = Math.max(1, Math.min(APP_SERVER_REPLICA_MAX, Math.floor(replicas)))
    const patch = configPatchForReplicas(node.type, next, node.config)
    if (Object.keys(patch).length === 0) return
    canvas.updateNodeConfig(id, patch)
  },

  setNodeEngine: (id, engine) => {
    const canvas = useCanvasStore.getState()
    const node = canvas.nodes[id]
    if (!node || !canMutateCanvasTopology(canvas)) return
    if (!isBackendSupportedEngine(node.type, engine)) return
    const patch = configPatchForEngine(node.type, engine)
    if (Object.keys(patch).length === 0) return
    canvas.updateNodeConfig(id, patch)
  },

  setNodeShards: (id, shards) => {
    if (!BACKEND_SUPPORTS_SHARDING) return
    const canvas = useCanvasStore.getState()
    const node = canvas.nodes[id]
    if (!node || !canMutateCanvasTopology(canvas)) return
    if (node.type !== 'database' && node.type !== 'message_queue') return
    canvas.updateNodeConfig(id, configPatchForShards(shards))
  },

  setNodeHealthVisual: (ids, healthVisual) => {
    if (ids.length === 0) return
    // Live/sim rims come from metrics + chaos — demo toggles are design-only.
    if (isMetricsViewportMode(useCanvasStore.getState().mode)) return
    const idSet = new Set(ids)
    set((s) => ({
      nodes: s.nodes.map((n) =>
        idSet.has(n.id) ? { ...n, healthVisual } : n,
      ),
    }))
  },

  setEdgesTrafficEnabled: (ids, enabled) => {
    const canvas = useCanvasStore.getState()
    if (ids === 'all') {
      canvas.setAllEdgesAnimated(enabled)
      return
    }
    for (const id of ids) {
      if (canvas.edges[id]) canvas.setEdgeAnimated(id, enabled)
    }
  },

  addEdge: (sourceId, targetId) => {
    if (sourceId === targetId) return
    const canvas = useCanvasStore.getState()
    if (!canMutateCanvasTopology(canvas)) return
    const source = canvas.nodes[sourceId]
    const target = canvas.nodes[targetId]
    if (!source || !target) return
    const exists = Object.values(canvas.edges).some(
      (e) => e.sourceId === sourceId && e.targetId === targetId,
    )
    if (exists) {
      canvas.setPendingSource(null)
      return
    }
    const edge = {
      id: crypto.randomUUID(),
      sourceId,
      targetId,
      protocol: defaultEdgeProtocol(source.type, target.type),
      animated: false,
    }
    canvas.addEdge(edge)
    canvas.setPendingSource(null)
    canvas.setSelectedIds([])
    set({ selectedEdgeIds: [edge.id], selectedIds: [] })
  },

  moveNodes: (updates) => {
    if (updates.length === 0) return
    const canvas = useCanvasStore.getState()
    if (
      !canMutateCanvasLayout(canvas) ||
      !canMoveOnCanvas(canvas.movementLocked)
    ) {
      return
    }

    const entries: Array<{ id: string; position: [number, number, number] }> =
      []
    const sessionEntries: Array<{ id: string; dx: number; dy: number }> = []
    const canonical = get().nodes
    for (const u of updates) {
      const node = canonical.find((n) => n.id === u.id)
      if (!node || !canvas.nodes[u.id]) continue
      const snapped = snapWorld(u.x, u.y)
      if (isVariationTopologyLocked(canvas.loadedVariationId)) {
        sessionEntries.push({
          id: u.id,
          dx: snapped.x - node.x,
          dy: snapped.y - node.y,
        })
        continue
      }
      if (!canMutateCanvasTopology(canvas)) continue
      entries.push({
        id: u.id,
        position: svgWorldToCanvasPosition(snapped.x, snapped.y),
      })
    }

    if (sessionEntries.length > 0) {
      setSessionLayoutOffsets(sessionEntries)
      syncSessionLayoutEdges(sessionEntries.map((e) => e.id))
    }
    if (entries.length > 0) {
      canvas.applyNodePositions(entries)
    }
  },

  rerouteEdgesForNodes: (nodeIds) => {
    // Waypoints are derived on every canvas sync; keep for API compatibility.
    if (nodeIds.length === 0) return
    syncFromCanvas()
  },

  removeSelected: () => {
    const state = get()
    const canvas = useCanvasStore.getState()
    if (!canMutateCanvasTopology(canvas)) return
    if (state.selectedEdgeIds.length > 0) {
      const remove = [...state.selectedEdgeIds]
      recordCanvasHistory(canvas.nodes, canvas.edges)
      withoutCanvasHistoryRecording(() => {
        for (const id of remove) {
          useCanvasStore.getState().removeEdge(id)
        }
      })
      set({ selectedEdgeIds: [] })
      return
    }
    if (state.selectedIds.length === 0) return
    canvas.setSelectedIds(state.selectedIds)
    canvas.removeSelectedNodes()
    set({ selectedEdgeIds: [] })
  },

  copySelected: () => {
    const state = get()
    if (state.selectedIds.length === 0) return
    const selected = new Set(state.selectedIds)
    clipboard = state.nodes.filter((n) => selected.has(n.id)).map(cloneSvgNode)
  },

  pasteClipboard: () => {
    if (clipboard.length === 0) return
    const canvas = useCanvasStore.getState()
    if (
      !canMutateCanvasTopology(canvas) ||
      !canPlaceOnCanvas(canvas.mode, canvas.movementLocked)
    ) {
      return
    }
    const ox = HALF_W
    const oy = HALF_H
    const createdIds: string[] = []
    recordCanvasHistory(canvas.nodes, canvas.edges)
    withoutCanvasHistoryRecording(() => {
      let nodes: Record<string, CanvasNode> = {
        ...useCanvasStore.getState().nodes,
      }
      for (const src of clipboard) {
        if (src.archetype === 'client') continue
        const type = archetypeToCanvasType(src.archetype)
        const position = svgWorldToCanvasPosition(src.x + ox, src.y + oy)
        const node = createCanvasNode(type, position, nodes)
        const mergedConfig = { ...node.config, ...src.config }
        node.config = {
          ...mergedConfig,
          ...configPatchForEngine(type, src.engine),
          ...configPatchForReplicas(type, src.topology.replicas, mergedConfig),
          ...configPatchForShards(src.topology.shards),
        }
        useCanvasStore.getState().addNode(node)
        nodes = { ...nodes, [node.id]: node }
        createdIds.push(node.id)
      }
      clipboard = clipboard.map((n) => ({
        ...cloneSvgNode(n),
        x: n.x + ox,
        y: n.y + oy,
      }))
    })
    if (createdIds.length > 0) {
      useCanvasStore.getState().setSelectedIds(createdIds)
    }
  },

  clearPlacementAndSelection: () => {
    const canvas = useCanvasStore.getState()
    canvas.setPlacingNodeType(null)
    canvas.setPendingSource(null)
    canvas.setDesignTool('select')
    canvas.setSelectedIds([])
    set({ selectedEdgeIds: [], connectSourceId: null })
  },

  undo: () => {
    useCanvasStore.getState().undo()
    set({ selectedEdgeIds: [], connectSourceId: null })
  },

  redo: () => {
    useCanvasStore.getState().redo()
    set({ selectedEdgeIds: [], connectSourceId: null })
  },
}))
