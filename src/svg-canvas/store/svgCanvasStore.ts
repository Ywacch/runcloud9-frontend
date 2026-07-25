/**
 * SVG design-scene store — projection + UI façade over product `canvasStore`.
 * Nodes/edges/selection/placement are owned by canvasStore; waypoints/zones are derived.
 */
import { create } from 'zustand'
import {
  canMutateCanvasTopology,
  useCanvasStore,
  type CanvasNode,
} from '../../editor-core/stores/canvasStore'
import { isoToNode } from '../../canvas/utils/positionAdapter'
import {
  recordCanvasHistory,
  withoutCanvasHistoryRecording,
} from '../../lib/canvasHistory'
import { defaultEdgeProtocol } from '../../lib/defaultEdgeProtocol'
import { createCanvasNode } from '../../lib/nodeFactory'
import { APP_SERVER_REPLICA_MAX } from '../../lib/replicaConfig'
import {
  archetypeToCanvasType,
  canvasTypeToArchetype,
  configPatchForEngine,
  configPatchForReplicas,
  configPatchForShards,
  svgWorldToCanvasPosition,
} from '../bridge/canvasSvgAdapter'
import { projectSvgScene } from '../bridge/projectSvgScene'
import { HALF_H, HALF_W, snapWorld } from '../math/iso'
import {
  cloneSvgNode,
  type Archetype,
  type SvgEdge,
  type SvgNode,
  type SvgZone,
} from './svgTypes'

export type { Archetype, SvgEdge, SvgNode, SvgZone } from './svgTypes'

let clipboard: SvgNode[] = []
let bridgeInstalled = false
let seedAttempted = false
let unsubscribeCanvas: (() => void) | null = null

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

function syncFromCanvas(): void {
  const c = useCanvasStore.getState()
  const projected = projectSvgScene(c.nodes, c.edges)
  const prev = useSvgCanvasStore.getState()
  const edgeIds = new Set(projected.edges.map((e) => e.id))
  useSvgCanvasStore.setState({
    nodes: projected.nodes,
    edges: projected.edges,
    zones: projected.zones,
    selectedIds: selectionFromCanvas(),
    selectedEdgeIds: prev.selectedEdgeIds.filter((id) => edgeIds.has(id)),
    placingArchetype: c.placingNodeType
      ? canvasTypeToArchetype(c.placingNodeType)
      : null,
    connectMode: c.designTool === 'connect',
    connectSourceId: c.pendingSourceId,
  })
}

/** Seed one compute node when canvas is empty so /canvas-svg is usable alone. */
function ensureDemoSeed(): void {
  if (seedAttempted) return
  seedAttempted = true
  const c = useCanvasStore.getState()
  if (Object.keys(c.nodes).length > 0) return
  if (!canMutateCanvasTopology(c)) return
  const node = createCanvasNode('compute', isoToNode(0, 0), {})
  node.label = 'T2'
  useCanvasStore.getState().addNode(node)
}

/**
 * Subscribe SVG projection to product canvasStore. Safe to call multiple times.
 * Call from SvgDesignCanvas mount.
 */
export function installCanvasSvgBridge(): void {
  ensureDemoSeed()
  if (bridgeInstalled) {
    syncFromCanvas()
    return
  }
  bridgeInstalled = true
  syncFromCanvas()
  unsubscribeCanvas = useCanvasStore.subscribe(() => {
    syncFromCanvas()
  })
}

/** Test helper: reset bridge + local UI (does not clear canvasStore). */
export function resetCanvasSvgBridgeForTests(): void {
  unsubscribeCanvas?.()
  unsubscribeCanvas = null
  bridgeInstalled = false
  seedAttempted = false
  clipboard = []
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
    if (!canMutateCanvasTopology(canvas)) return
    const archetype = get().placingArchetype
    if (!archetype || archetype === 'client') return
    const type = archetypeToCanvasType(archetype)
    const position = svgWorldToCanvasPosition(x, y)
    const node = createCanvasNode(type, position, canvas.nodes)
    canvas.addNode(node)
    canvas.setSelectedIds([node.id])
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
    const next = Math.max(1, Math.min(APP_SERVER_REPLICA_MAX, Math.floor(replicas)))
    const patch = configPatchForReplicas(node.type, next)
    if (Object.keys(patch).length === 0) return
    canvas.updateNodeConfig(id, patch)
  },

  setNodeEngine: (id, engine) => {
    const canvas = useCanvasStore.getState()
    const node = canvas.nodes[id]
    if (!node || !canMutateCanvasTopology(canvas)) return
    const patch = configPatchForEngine(node.type, engine)
    if (Object.keys(patch).length === 0) return
    canvas.updateNodeConfig(id, patch)
  },

  setNodeShards: (id, shards) => {
    const canvas = useCanvasStore.getState()
    const node = canvas.nodes[id]
    if (!node || !canMutateCanvasTopology(canvas)) return
    if (node.type !== 'database' && node.type !== 'message_queue') return
    canvas.updateNodeConfig(id, configPatchForShards(shards))
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
    if (!canMutateCanvasTopology(canvas) || canvas.movementLocked) return
    recordCanvasHistory(canvas.nodes, canvas.edges)
    withoutCanvasHistoryRecording(() => {
      const st = useCanvasStore.getState()
      for (const u of updates) {
        if (!st.nodes[u.id]) continue
        const snapped = snapWorld(u.x, u.y)
        st.updateNodePosition(u.id, svgWorldToCanvasPosition(snapped.x, snapped.y))
      }
    })
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
    if (!canMutateCanvasTopology(canvas)) return
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
        node.config = {
          ...node.config,
          ...src.config,
          ...configPatchForEngine(type, src.engine),
          ...configPatchForReplicas(type, src.topology.replicas),
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
