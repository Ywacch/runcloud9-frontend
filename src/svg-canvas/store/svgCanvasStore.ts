import { create } from 'zustand'
import { APP_SERVER_REPLICA_MAX } from '../../lib/replicaConfig'
import { syncZoneForNode, unitObstacleAnchors } from '../compose/syncZoneForNode'
import { HALF_H, HALF_W, isoToScreen, snapWorld } from '../math/iso'
import { attachPoint } from '../routing/attach'
import { routeIsoManhattan } from '../routing/isoManhattan'
import {
  clearSvgHistory,
  popSvgRedo,
  popSvgUndo,
  pushSvgHistory,
  type SvgHistorySnapshot,
} from './svgHistory'
import {
  cloneSvgEdge,
  cloneSvgNode,
  cloneSvgZone,
  defaultEdgeStyle,
  defaultTopology,
  emptyConfig,
  type Archetype,
  type SvgEdge,
  type SvgNode,
  type SvgZone,
} from './svgTypes'

export type { Archetype, SvgEdge, SvgNode, SvgZone } from './svgTypes'

let clipboard: SvgNode[] = []

type SvgCanvasState = {
  nodes: SvgNode[]
  edges: SvgEdge[]
  zones: SvgZone[]
  selectedIds: string[]
  selectedEdgeIds: string[]
  placingArchetype: Archetype | null
  connectMode: boolean
  connectSourceId: string | null
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

function nextLabel(seq: number): { label: string; labelSeq: number } {
  return { label: `T${seq}`, labelSeq: seq + 1 }
}

function snapshotOf(s: {
  nodes: SvgNode[]
  edges: SvgEdge[]
  zones: SvgZone[]
  labelSeq: number
}): SvgHistorySnapshot {
  return { nodes: s.nodes, edges: s.edges, zones: s.zones, labelSeq: s.labelSeq }
}

function rebuildZones(nodes: SvgNode[]): SvgZone[] {
  const zones: SvgZone[] = []
  for (const n of nodes) {
    const z = syncZoneForNode(n)
    if (z) zones.push(z)
  }
  return zones
}

function routeBetween(
  nodes: SvgNode[],
  sourceId: string,
  targetId: string,
): { x: number; y: number }[] {
  const source = nodes.find((n) => n.id === sourceId)
  const target = nodes.find((n) => n.id === targetId)
  if (!source || !target) return []
  const obstacleAnchors = nodes
    .filter((n) => n.id !== sourceId && n.id !== targetId)
    .flatMap((n) => unitObstacleAnchors(n))
  return routeIsoManhattan({
    source: attachPoint(source),
    target: attachPoint(target),
    obstacleAnchors,
  })
}

const seedPos = isoToScreen(0.5, -0.5)
const seed = nextLabel(2)

clearSvgHistory()
clipboard = []

export const useSvgCanvasStore = create<SvgCanvasState>((set, get) => ({
  nodes: [
    {
      id: crypto.randomUUID(),
      archetype: 'app-server',
      x: seedPos.x,
      y: seedPos.y,
      label: seed.label,
      config: emptyConfig(),
      topology: defaultTopology(),
    },
  ],
  edges: [],
  zones: [],
  selectedIds: [],
  selectedEdgeIds: [],
  placingArchetype: null,
  connectMode: false,
  connectSourceId: null,
  labelSeq: seed.labelSeq,

  setPlacingArchetype: (placingArchetype) =>
    set({
      placingArchetype,
      ...(placingArchetype
        ? { connectMode: false, connectSourceId: null }
        : {}),
    }),

  togglePlacingArchetype: (a) =>
    set((s) => {
      const next = s.placingArchetype === a ? null : a
      return {
        placingArchetype: next,
        ...(next ? { connectMode: false, connectSourceId: null } : {}),
      }
    }),

  setConnectMode: (on) =>
    set({
      connectMode: on,
      connectSourceId: null,
      ...(on ? { placingArchetype: null } : {}),
    }),

  setConnectSourceId: (connectSourceId) => set({ connectSourceId }),

  placeNodeAt: (x, y) => {
    const state = get()
    if (!state.placingArchetype) return
    pushSvgHistory(snapshotOf(state))
    const snapped = snapWorld(x, y)
    const { label, labelSeq: next } = nextLabel(state.labelSeq)
    const node: SvgNode = {
      id: crypto.randomUUID(),
      archetype: state.placingArchetype,
      x: snapped.x,
      y: snapped.y,
      label,
      config: emptyConfig(),
      topology: defaultTopology(),
    }
    const nodes = [...state.nodes, node]
    set({
      nodes,
      zones: rebuildZones(nodes),
      selectedIds: [node.id],
      selectedEdgeIds: [],
      labelSeq: next,
    })
  },

  selectOnly: (id) =>
    set({
      selectedIds: id ? [id] : [],
      selectedEdgeIds: [],
    }),

  toggleInSelection: (id) =>
    set((s) => {
      const has = s.selectedIds.includes(id)
      return {
        selectedIds: has
          ? s.selectedIds.filter((sid) => sid !== id)
          : [...s.selectedIds, id],
        selectedEdgeIds: [],
      }
    }),

  selectAllNodes: () =>
    set((s) => {
      if (s.nodes.length === 0) return s
      return {
        selectedIds: s.nodes.map((n) => n.id),
        selectedEdgeIds: [],
      }
    }),

  setSelectedIds: (selectedIds) =>
    set({ selectedIds, selectedEdgeIds: [] }),

  selectEdgesOnly: (selectedEdgeIds) =>
    set({ selectedEdgeIds, selectedIds: [] }),

  setNodeReplicas: (id, replicas) => {
    const state = get()
    const node = state.nodes.find((n) => n.id === id)
    if (!node) return
    const nextN = Math.max(1, Math.min(APP_SERVER_REPLICA_MAX, Math.floor(replicas)))
    if (nextN === node.topology.replicas) return
    pushSvgHistory(snapshotOf(state))
    const nodes = state.nodes.map((n) =>
      n.id === id
        ? { ...n, topology: { ...n.topology, replicas: nextN } }
        : n,
    )
    const zones = rebuildZones(nodes)
    const edges = state.edges.map((e) => {
      if (e.sourceNodeId !== id && e.targetNodeId !== id) return e
      return {
        ...e,
        waypoints: routeBetween(nodes, e.sourceNodeId, e.targetNodeId),
      }
    })
    set({ nodes, zones, edges })
  },

  addEdge: (sourceId, targetId) => {
    if (sourceId === targetId) return
    const state = get()
    const exists = state.edges.some(
      (e) => e.sourceNodeId === sourceId && e.targetNodeId === targetId,
    )
    if (exists) {
      set({ connectSourceId: null })
      return
    }
    const source = state.nodes.find((n) => n.id === sourceId)
    const target = state.nodes.find((n) => n.id === targetId)
    if (!source || !target) return
    pushSvgHistory(snapshotOf(state))
    const waypoints = routeBetween(state.nodes, sourceId, targetId)
    const edge: SvgEdge = {
      id: crypto.randomUUID(),
      sourceNodeId: sourceId,
      targetNodeId: targetId,
      waypoints,
      style: defaultEdgeStyle(),
    }
    set({
      edges: [...state.edges, edge],
      selectedEdgeIds: [edge.id],
      selectedIds: [],
      connectSourceId: null,
    })
  },

  moveNodes: (updates) => {
    if (updates.length === 0) return
    const state = get()
    pushSvgHistory(snapshotOf(state))
    const byId = new Map(
      updates.map((u) => {
        const snapped = snapWorld(u.x, u.y)
        return [u.id, snapped] as const
      }),
    )
    const nodes = state.nodes.map((n) => {
      const next = byId.get(n.id)
      return next ? { ...n, x: next.x, y: next.y } : n
    })
    const moved = new Set(byId.keys())
    const edges = state.edges.map((e) => {
      if (!moved.has(e.sourceNodeId) && !moved.has(e.targetNodeId)) return e
      return {
        ...e,
        waypoints: routeBetween(nodes, e.sourceNodeId, e.targetNodeId),
      }
    })
    set({ nodes, edges, zones: rebuildZones(nodes) })
  },

  rerouteEdgesForNodes: (nodeIds) => {
    if (nodeIds.length === 0) return
    const state = get()
    const moved = new Set(nodeIds)
    set({
      edges: state.edges.map((e) => {
        if (!moved.has(e.sourceNodeId) && !moved.has(e.targetNodeId)) return e
        return {
          ...e,
          waypoints: routeBetween(state.nodes, e.sourceNodeId, e.targetNodeId),
        }
      }),
    })
  },

  removeSelected: () => {
    const state = get()
    if (state.selectedEdgeIds.length > 0) {
      const remove = new Set(state.selectedEdgeIds)
      pushSvgHistory(snapshotOf(state))
      set({
        edges: state.edges.filter((e) => !remove.has(e.id)),
        selectedEdgeIds: [],
      })
      return
    }
    if (state.selectedIds.length === 0) return
    const remove = new Set(state.selectedIds)
    pushSvgHistory(snapshotOf(state))
    const nodes = state.nodes.filter((n) => !remove.has(n.id))
    set({
      nodes,
      zones: rebuildZones(nodes),
      edges: state.edges.filter(
        (e) => !remove.has(e.sourceNodeId) && !remove.has(e.targetNodeId),
      ),
      selectedIds: [],
      selectedEdgeIds: [],
    })
  },

  copySelected: () => {
    const state = get()
    if (state.selectedIds.length === 0) return
    const selected = new Set(state.selectedIds)
    clipboard = state.nodes.filter((n) => selected.has(n.id)).map(cloneSvgNode)
  },

  pasteClipboard: () => {
    if (clipboard.length === 0) return
    const state = get()
    pushSvgHistory(snapshotOf(state))
    const ox = HALF_W
    const oy = HALF_H
    let seq = state.labelSeq
    const created: SvgNode[] = []
    for (const src of clipboard) {
      const { label, labelSeq: next } = nextLabel(seq)
      seq = next
      const snapped = snapWorld(src.x + ox, src.y + oy)
      created.push({
        ...cloneSvgNode(src),
        id: crypto.randomUUID(),
        x: snapped.x,
        y: snapped.y,
        label,
      })
    }
    clipboard = clipboard.map((n) => ({
      ...cloneSvgNode(n),
      x: n.x + ox,
      y: n.y + oy,
    }))
    const nodes = [...state.nodes, ...created]
    set({
      nodes,
      zones: rebuildZones(nodes),
      selectedIds: created.map((n) => n.id),
      selectedEdgeIds: [],
      labelSeq: seq,
    })
  },

  clearPlacementAndSelection: () =>
    set({
      placingArchetype: null,
      selectedIds: [],
      selectedEdgeIds: [],
      connectSourceId: null,
    }),

  undo: () => {
    const state = get()
    const prev = popSvgUndo(snapshotOf(state))
    if (!prev) return
    set({
      nodes: prev.nodes.map(cloneSvgNode),
      edges: prev.edges.map(cloneSvgEdge),
      zones: prev.zones.map(cloneSvgZone),
      labelSeq: prev.labelSeq,
      selectedIds: [],
      selectedEdgeIds: [],
      connectSourceId: null,
    })
  },

  redo: () => {
    const state = get()
    const next = popSvgRedo(snapshotOf(state))
    if (!next) return
    set({
      nodes: next.nodes.map(cloneSvgNode),
      edges: next.edges.map(cloneSvgEdge),
      zones: next.zones.map(cloneSvgZone),
      labelSeq: next.labelSeq,
      selectedIds: [],
      selectedEdgeIds: [],
      connectSourceId: null,
    })
  },
}))
