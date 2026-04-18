import { create } from 'zustand'

/** Design-mode interaction: select/move + inspector, connect nodes, or delete by clicking. */
export type DesignTool = 'select' | 'connect' | 'erase'

export type CanvasMode = 'design' | 'live' | 'simulate'

/** True when the user can move nodes, connect, erase, and place components (not live or simulation view). */
export function isCanvasEditMode(mode: CanvasMode): boolean {
  return mode === 'design' || mode === 'simulate'
}

/** Live deploy or local simulation — show metrics, particles, inspector read-only. */
export function isMetricsViewportMode(mode: CanvasMode): boolean {
  return mode === 'live' || mode === 'simulate'
}

export interface CanvasNode {
  id: string
  type:
    | 'compute'
    | 'database'
    | 'cache'
    | 'load_balancer'
    | 'message_queue'
    | 'worker'
    | 'client'
  position: [number, number, number]
  label: string
  config: Record<string, unknown>
  status: 'idle' | 'provisioning' | 'healthy' | 'degraded'
}

export interface CanvasEdge {
  id: string
  sourceId: string
  targetId: string
  protocol: 'tcp' | 'http'
  animated: boolean
}

export interface CanvasSnapshot {
  version: '1.0'
  templateId?: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  exportedAt: string
}

export interface SessionSummary {
  template: string
  duration: string
  peakRps: number
  peakP99: number
  totalRequests: number
  cacheHitRate: number
  avgLatency: number
  errorRate: number
  componentSummaries: Record<
    string,
    {
      type: string
      label: string
      /** Preformatted for the session dialog (percent, allocation, or MB). */
      cpuSummary: string
      memSummary: string
      requestRate: number
    }
  >
}

interface CanvasState {
  mode: CanvasMode
  nodes: Record<string, CanvasNode>
  edges: Record<string, CanvasEdge>
  selectedId: string | null
  pendingSourceId: string | null
  deploymentId: string | null
  /** Active tool in design mode (hotkeys 1 / 5 / 0). */
  designTool: DesignTool
  /** Click palette then click canvas to spawn (Phase 2). */
  placingNodeType: CanvasNode['type'] | null
  /** Hovered node while `pendingSourceId` is set (connection preview). */
  connectHoverTargetId: string | null
  /** Last loaded / active template id for `exportJSON` → deploy `template`. */
  snapshotTemplateId: string | null
  /** Client-side session end (deploy + 9m) for countdown. */
  liveSessionEndsAt: number | null
  sessionSummary: SessionSummary | null

  addNode: (node: CanvasNode) => void
  updateNodePosition: (id: string, pos: [number, number, number]) => void
  updateNodeConfig: (id: string, config: Partial<CanvasNode['config']>) => void
  updateNodeLabel: (id: string, label: string) => void
  updateNodeStatus: (id: string, status: CanvasNode['status']) => void
  removeNode: (id: string) => void
  addEdge: (edge: CanvasEdge) => void
  removeEdge: (id: string) => void
  setPendingSource: (id: string | null) => void
  setConnectHoverTargetId: (id: string | null) => void
  setEdgeAnimated: (id: string, animated: boolean) => void
  selectNode: (id: string | null) => void
  setMode: (mode: CanvasMode) => void
  setDeploymentId: (id: string | null) => void
  setPlacingNodeType: (type: CanvasNode['type'] | null) => void
  setDesignTool: (tool: DesignTool) => void
  setSnapshotTemplateId: (id: string | null) => void
  setLiveSessionEndsAt: (t: number | null) => void
  setSessionSummary: (summary: SessionSummary | null) => void
  setAllEdgesAnimated: (animated: boolean) => void
  exportJSON: () => CanvasSnapshot
  loadJSON: (snapshot: CanvasSnapshot) => void
  /** Replace canvas from a template in one update (avoids flicker or invalid intermediate state). */
  loadTemplateSnapshot: (
    snapshot: CanvasSnapshot,
    targetMode: 'design' | 'simulate',
  ) => void
  clearCanvas: () => void
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  mode: 'design',
  nodes: {},
  edges: {},
  selectedId: null,
  pendingSourceId: null,
  deploymentId: null,
  designTool: 'select',
  placingNodeType: null,
  connectHoverTargetId: null,
  snapshotTemplateId: null,
  liveSessionEndsAt: null,
  sessionSummary: null,

  addNode: (node) => set((s) => ({ nodes: { ...s.nodes, [node.id]: node } })),

  updateNodePosition: (id, pos) =>
    set((s) => {
      const n = s.nodes[id]
      if (!n) return s
      return { nodes: { ...s.nodes, [id]: { ...n, position: pos } } }
    }),

  updateNodeConfig: (id, config) =>
    set((s) => {
      const n = s.nodes[id]
      if (!n) return s
      return {
        nodes: {
          ...s.nodes,
          [id]: { ...n, config: { ...n.config, ...config } },
        },
      }
    }),

  updateNodeLabel: (id, label) =>
    set((s) => {
      const n = s.nodes[id]
      if (!n) return s
      return { nodes: { ...s.nodes, [id]: { ...n, label } } }
    }),

  updateNodeStatus: (id, status) =>
    set((s) => {
      const n = s.nodes[id]
      if (!n) return s
      return { nodes: { ...s.nodes, [id]: { ...n, status } } }
    }),

  removeNode: (id) =>
    set((s) => {
      const { [id]: _removed, ...nodes } = s.nodes
      const edges = { ...s.edges }
      for (const eid of Object.keys(edges)) {
        const e = edges[eid]
        if (e.sourceId === id || e.targetId === id) delete edges[eid]
      }
      return {
        nodes,
        edges,
        selectedId: s.selectedId === id ? null : s.selectedId,
        pendingSourceId: s.pendingSourceId === id ? null : s.pendingSourceId,
      }
    }),

  addEdge: (edge) =>
    set((s) => {
      const dup = Object.values(s.edges).some(
        (e) => e.sourceId === edge.sourceId && e.targetId === edge.targetId
      )
      if (dup) return s
      return {
        edges: { ...s.edges, [edge.id]: edge },
        connectHoverTargetId: null,
      }
    }),

  removeEdge: (id) =>
    set((s) => {
      const { [id]: _removed, ...edges } = s.edges
      return { edges }
    }),

  setPendingSource: (pendingSourceId) =>
    set({ pendingSourceId, connectHoverTargetId: null }),

  setConnectHoverTargetId: (connectHoverTargetId) => set({ connectHoverTargetId }),

  setEdgeAnimated: (id, animated) =>
    set((s) => {
      const e = s.edges[id]
      if (!e) return s
      return { edges: { ...s.edges, [id]: { ...e, animated } } }
    }),

  selectNode: (selectedId) => set({ selectedId }),

  setMode: (next) =>
    set({
      mode: next,
      ...(next === 'live' || next === 'simulate'
        ? {
            pendingSourceId: null,
            placingNodeType: null,
            connectHoverTargetId: null,
            designTool: 'select' as const,
          }
        : {}),
    }),

  setDeploymentId: (deploymentId) => set({ deploymentId }),

  setPlacingNodeType: (placingNodeType) => set({ placingNodeType }),

  setDesignTool: (designTool) =>
    set({
      designTool,
      pendingSourceId: null,
      connectHoverTargetId: null,
    }),

  setSnapshotTemplateId: (snapshotTemplateId) => set({ snapshotTemplateId }),

  setLiveSessionEndsAt: (liveSessionEndsAt) => set({ liveSessionEndsAt }),

  setSessionSummary: (sessionSummary) => set({ sessionSummary }),

  setAllEdgesAnimated: (animated) =>
    set((s) => {
      const edges = { ...s.edges }
      for (const id of Object.keys(edges)) {
        edges[id] = { ...edges[id], animated }
      }
      return { edges }
    }),

  exportJSON: () => {
    const s = get()
    return {
      version: '1.0',
      templateId: s.snapshotTemplateId ?? undefined,
      nodes: Object.values(s.nodes),
      edges: Object.values(s.edges),
      exportedAt: new Date().toISOString(),
    }
  },

  loadJSON: (snapshot) =>
    set({
      nodes: Object.fromEntries(snapshot.nodes.map((n) => [n.id, n])),
      edges: Object.fromEntries(snapshot.edges.map((e) => [e.id, e])),
      selectedId: null,
      pendingSourceId: null,
      designTool: 'select',
      placingNodeType: null,
      connectHoverTargetId: null,
      snapshotTemplateId: snapshot.templateId ?? null,
      deploymentId: null,
      liveSessionEndsAt: null,
      sessionSummary: null,
      mode: 'design',
    }),

  loadTemplateSnapshot: (snapshot, targetMode) =>
    set({
      nodes: Object.fromEntries(snapshot.nodes.map((n) => [n.id, n])),
      edges: Object.fromEntries(snapshot.edges.map((e) => [e.id, e])),
      selectedId: null,
      pendingSourceId: null,
      designTool: 'select',
      placingNodeType: null,
      connectHoverTargetId: null,
      snapshotTemplateId: snapshot.templateId ?? null,
      deploymentId: null,
      liveSessionEndsAt: null,
      sessionSummary: null,
      mode: targetMode,
    }),

  clearCanvas: () =>
    set({
      mode: 'design',
      nodes: {},
      edges: {},
      selectedId: null,
      pendingSourceId: null,
      designTool: 'select',
      placingNodeType: null,
      connectHoverTargetId: null,
      snapshotTemplateId: null,
      deploymentId: null,
      liveSessionEndsAt: null,
      sessionSummary: null,
    }),
}))
