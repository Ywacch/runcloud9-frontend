import { create } from 'zustand'
import { applyCacheStrategyNormalizationToNodes } from '../../lib/cacheTopologyStrategy'
import { defaultSelectedInstanceId } from '../../lib/dbInstanceScope'
import { socialFeedCacheRemovalBanner } from '../../lib/socialFeedCacheRemoval'
import { useAuthStore } from '../../product/stores/authStore'
import {
  clearCanvasHistory,
  popRedoSnapshot,
  popUndoSnapshot,
  recordCanvasHistory,
  withoutCanvasHistoryRecording,
} from '../../lib/canvasHistory'
import { resetDesignStorytellingUi } from '../../lib/resetStorytellingUi'
import { clearSessionLayout } from '../../lib/sessionLayoutStore'
import { SHOW_SIMULATION_UI } from '../../lib/featureFlags'
import type { AIPostmortem } from '../../lib/aiPostmortem'
import type { SessionEventSummary } from '../../lib/eventsSummaryFromApi'
import type {
  ClientLatencyInterval,
  SessionSparklines,
  StoragePeakSummary,
} from '../domain/sessionHistoryFromApi'
import type { SteadyStateSummary } from '../domain/metricsUiContract'

/** Design-mode interaction: select/move + inspector, connect nodes, or delete by clicking. */
export type DesignTool = 'select' | 'connect' | 'erase'

function cacheStrategyOptionsForUser() {
  return { allowProxyStrategies: useAuthStore.getState().isPremium }
}

export type CanvasMode = 'design' | 'live' | 'simulate'

/** True when the user can move nodes, connect, erase, and place components (not live or simulation view). */
export function isCanvasEditMode(mode: CanvasMode): boolean {
  return mode === 'design' || mode === 'simulate'
}

/** True when topology edits are allowed (blocks live deploy and in-flight provisioning). */
export function canMutateCanvasTopology(state: {
  mode: CanvasMode
  deploymentId: string | null
  loadedVariationId?: string | null
}): boolean {
  if (state.loadedVariationId) return false
  if (state.mode === 'live') return false
  if (state.deploymentId) return false
  return state.mode === 'design' || state.mode === 'simulate'
}

/** True when node layout (drag reposition) is allowed in the current viewport. */
export function canMutateCanvasLayout(state: {
  mode: CanvasMode
  deploymentId: string | null
}): boolean {
  if (state.mode === 'live') return false
  if (state.deploymentId) return false
  return state.mode === 'design' || state.mode === 'simulate'
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
  /** Optional job id to node id bindings persisted with the canvas. */
  jobBindings?: Record<string, string>
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
  /** Count of timeline events captured before teardown (WS). */
  eventsRecorded?: number
  /** Downsampled series from API `metrics_summary.session_history` after teardown. */
  sessionSparklines?: SessionSparklines
  /** Post-warmup medians from API `metrics_summary.steady_state` (prefer for A/B). */
  steadyState?: SteadyStateSummary
  /** Flat highlight reel from API `metrics_summary.events_summary`. */
  eventsSummary?: SessionEventSummary[]
  /** Teardown peaks from `metrics_summary` storage I/O fields when present. */
  storagePeaks?: StoragePeakSummary
  /** Client-path p99 per 5s window from `metrics_summary.client_latency_history`. */
  clientLatencyHistory?: ClientLatencyInterval[]
  /** Verified post-mortem from `metrics_summary.ai_postmortem`. */
  aiPostmortem?: AIPostmortem
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
  /** If true, node dragging is disabled in all modes. */
  movementLocked: boolean
  selectedId: string | null
  /** Multi-select; single-click sets one id, Ctrl+A selects all. */
  selectedIds: string[]
  /** Live inspector scope: cluster vs a concrete instance id (postgres layer or pod name). */
  selectedInstanceId: string | 'cluster' | null
  pendingSourceId: string | null
  deploymentId: string | null
  /** Active tool in design mode (hotkeys S / C / E). */
  designTool: DesignTool
  /** Click palette then click canvas to spawn (Phase 2). */
  placingNodeType: CanvasNode['type'] | null
  /** Hovered node while `pendingSourceId` is set (connection preview). */
  connectHoverTargetId: string | null
  /** Last loaded / active template id for `exportJSON` → deploy `template`. */
  snapshotTemplateId: string | null
  /**
   * Explorer dual-mode: full architecture preview vs runnable lite preset.
   * Null for paid users or when no template is loaded.
   */
  templatePresetMode: 'full' | 'explorer' | null
  /** Variation picked from the template modal; locks topology edits until cleared. */
  loadedVariationId: string | null
  /** Client-side session end (deploy + N minutes) for countdown. */
  liveSessionEndsAt: number | null
  /** True after the session clock elapses until we return to design mode. */
  liveSessionEnding: boolean
  /** When the live session clock started (running_at or enter-live). */
  liveSessionStartedAt: number | null
  sessionSummary: SessionSummary | null
  /** Canvas node ids to pulse (narrative card `related` components). */
  narrativeHighlightNodeIds: string[]
  /** Walkthrough: spotlight node for the current step. */
  walkthroughActiveNodeId: string | null
  /** Walkthrough: nodes already visited in this journey. */
  walkthroughVisitedNodeIds: string[]
  /** Walkthrough: edge ids with animated particles for the current hop. */
  walkthroughHighlightedEdgeIds: string[]
  /** Walkthrough: nodes on the journey path (others are dimmed). */
  walkthroughParticipatingNodeIds: string[]
  /** Live/sim: node under the pointer (metrics tooltip). */
  hoveredNodeId: string | null
  /** Live/sim: concrete instance under the pointer for tooltip preview. */
  hoveredInstanceId: string | null
  /** One-shot topology UX banner (e.g. social-feed cache removal). */
  topologyBanner: string | null
  /** Explicit job id → canvas node id bindings for deploy. */
  jobBindings: Record<string, string>

  addNode: (node: CanvasNode) => void
  updateNodePosition: (id: string, pos: [number, number, number]) => void
  /** One set() for many positions — one history entry, one bridge sync. */
  applyNodePositions: (
    updates: Array<{ id: string; position: [number, number, number] }>,
  ) => void
  updateNodeConfig: (id: string, config: Partial<CanvasNode['config']>) => void
  updateNodeLabel: (id: string, label: string) => void
  updateNodeStatus: (id: string, status: CanvasNode['status']) => void
  /** One set() for many status updates — skips unchanged statuses. */
  updateNodeStatuses: (patch: Record<string, CanvasNode['status']>) => void
  removeNode: (id: string) => void
  removeSelectedNodes: () => void
  addEdge: (edge: CanvasEdge) => void
  removeEdge: (id: string) => void
  setPendingSource: (id: string | null) => void
  setConnectHoverTargetId: (id: string | null) => void
  setHoveredNodeId: (id: string | null) => void
  setHoveredInstanceId: (id: string | null) => void
  setTopologyBanner: (message: string | null) => void
  setJobBinding: (job: string, nodeId: string | null) => void
  setEdgeAnimated: (id: string, animated: boolean) => void
  setMovementLocked: (locked: boolean) => void
  selectNode: (id: string | null) => void
  setSelectedInstanceId: (id: string | 'cluster' | null) => void
  /** Multi-select setter (SVG host / marquee). Clears selectedId unless exactly one id. */
  setSelectedIds: (ids: string[]) => void
  selectAllNodes: () => void
  setMode: (mode: CanvasMode) => void
  setDeploymentId: (id: string | null) => void
  setPlacingNodeType: (type: CanvasNode['type'] | null) => void
  setDesignTool: (tool: DesignTool) => void
  setSnapshotTemplateId: (id: string | null) => void
  setTemplatePresetMode: (mode: 'full' | 'explorer' | null) => void
  setLoadedVariationId: (id: string | null) => void
  setLiveSessionEndsAt: (t: number | null) => void
  setLiveSessionEnding: (ending: boolean) => void
  setLiveSessionStartedAt: (t: number | null) => void
  setSessionSummary: (summary: SessionSummary | null) => void
  setNarrativeHighlightNodeIds: (ids: string[]) => void
  setWalkthroughHighlights: (payload: {
    activeNodeId: string | null
    visitedNodeIds: string[]
    highlightedEdgeIds: string[]
    participatingNodeIds: string[]
  }) => void
  clearWalkthrough: () => void
  setAllEdgesAnimated: (animated: boolean) => void
  exportJSON: () => CanvasSnapshot
  loadJSON: (snapshot: CanvasSnapshot) => void
  /** Replace canvas from a template in one update (avoids flicker or invalid intermediate state). */
  loadTemplateSnapshot: (
    snapshot: CanvasSnapshot,
    targetMode: 'design' | 'simulate',
  ) => void
  /** Start from a chosen template id with an empty canvas in design mode. */
  startFromTemplate: (templateId: string) => void
  clearCanvas: () => void
  undo: () => void
  redo: () => void
}

function positionsEqual(
  a: [number, number, number],
  b: [number, number, number],
): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
}

function restoreTopology(
  set: (partial: Partial<CanvasState>) => void,
  snapshot: { nodes: Record<string, CanvasNode>; edges: Record<string, CanvasEdge> },
): void {
  withoutCanvasHistoryRecording(() => {
    set({
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      selectedId: null,
      selectedIds: [],
      selectedInstanceId: null,
      pendingSourceId: null,
      connectHoverTargetId: null,
    })
  })
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  mode: 'design',
  nodes: {},
  edges: {},
  movementLocked: false,
  selectedId: null,
  selectedIds: [],
  selectedInstanceId: null,
  pendingSourceId: null,
  deploymentId: null,
  designTool: 'select',
  placingNodeType: null,
  connectHoverTargetId: null,
  snapshotTemplateId: null,
  templatePresetMode: null,
  loadedVariationId: null,
  liveSessionEndsAt: null,
  liveSessionEnding: false,
  liveSessionStartedAt: null,
  sessionSummary: null,
  narrativeHighlightNodeIds: [],
  walkthroughActiveNodeId: null,
  walkthroughVisitedNodeIds: [],
  walkthroughHighlightedEdgeIds: [],
  walkthroughParticipatingNodeIds: [],
  hoveredNodeId: null,
  hoveredInstanceId: null,
  topologyBanner: null,
  jobBindings: {},

  addNode: (node) =>
    set((s) => {
      recordCanvasHistory(s.nodes, s.edges)
      return { nodes: { ...s.nodes, [node.id]: node } }
    }),

  updateNodePosition: (id, pos) =>
    set((s) => {
      const n = s.nodes[id]
      if (!n || positionsEqual(n.position, pos)) return s
      recordCanvasHistory(s.nodes, s.edges)
      return { nodes: { ...s.nodes, [id]: { ...n, position: pos } } }
    }),

  applyNodePositions: (updates) =>
    set((s) => {
      if (updates.length === 0) return s
      let changed = false
      const nodes = { ...s.nodes }
      for (const u of updates) {
        const n = nodes[u.id]
        if (!n || positionsEqual(n.position, u.position)) continue
        nodes[u.id] = { ...n, position: u.position }
        changed = true
      }
      if (!changed) return s
      recordCanvasHistory(s.nodes, s.edges)
      return { nodes }
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
      if (n.status === status) return s
      return { nodes: { ...s.nodes, [id]: { ...n, status } } }
    }),

  updateNodeStatuses: (patch) =>
    set((s) => {
      let changed = false
      const nodes = { ...s.nodes }
      for (const [id, status] of Object.entries(patch)) {
        const n = s.nodes[id]
        if (!n || n.status === status) continue
        changed = true
        nodes[id] = { ...n, status }
      }
      if (!changed) return s
      return { nodes }
    }),

  removeNode: (id) =>
    set((s) => {
      if (!s.nodes[id]) return s
      recordCanvasHistory(s.nodes, s.edges)
      const { [id]: _removed, ...nodes } = s.nodes
      const edges = { ...s.edges }
      for (const eid of Object.keys(edges)) {
        const e = edges[eid]
        if (e.sourceId === id || e.targetId === id) delete edges[eid]
      }
      const nodesNorm = applyCacheStrategyNormalizationToNodes(
        nodes,
        edges,
        cacheStrategyOptionsForUser(),
      )
      const topologyBanner =
        socialFeedCacheRemovalBanner(
          s.snapshotTemplateId,
          s.nodes,
          nodesNorm,
          id,
          s.jobBindings,
        ) ?? s.topologyBanner
      return {
        nodes: nodesNorm,
        edges,
        selectedId: s.selectedId === id ? null : s.selectedId,
        selectedIds: s.selectedIds.filter((sid) => sid !== id),
        pendingSourceId: s.pendingSourceId === id ? null : s.pendingSourceId,
        hoveredNodeId: s.hoveredNodeId === id ? null : s.hoveredNodeId,
        topologyBanner,
        jobBindings: Object.fromEntries(
          Object.entries(s.jobBindings).filter(([, nid]) => nid !== id),
        ),
      }
    }),

  setJobBinding: (job, nodeId) =>
    set((s) => {
      const key = job.trim()
      if (!key) return s
      const next = { ...s.jobBindings }
      if (!nodeId?.trim()) {
        delete next[key]
      } else {
        next[key] = nodeId.trim()
      }
      return { jobBindings: next }
    }),

  removeSelectedNodes: () =>
    set((s) => {
      if (!canMutateCanvasTopology(s)) return s
      const rawIds =
        s.selectedIds.length > 0
          ? s.selectedIds
          : s.selectedId
            ? [s.selectedId]
            : []
      // Traffic-source / loadgen is system-owned (Pixi parity).
      const ids = rawIds.filter((id) => s.nodes[id]?.type !== 'client')
      if (ids.length === 0) return s

      recordCanvasHistory(s.nodes, s.edges)
      const idSet = new Set(ids)
      const nodes = { ...s.nodes }
      for (const id of ids) {
        delete nodes[id]
      }
      const edges = { ...s.edges }
      for (const eid of Object.keys(edges)) {
        const e = edges[eid]
        if (idSet.has(e.sourceId) || idSet.has(e.targetId)) delete edges[eid]
      }
      const nodesNorm = applyCacheStrategyNormalizationToNodes(
        nodes,
        edges,
        cacheStrategyOptionsForUser(),
      )
      let topologyBanner = s.topologyBanner
      for (const removedId of ids) {
        const banner = socialFeedCacheRemovalBanner(
          s.snapshotTemplateId,
          s.nodes,
          nodesNorm,
          removedId,
          s.jobBindings,
        )
        if (banner) topologyBanner = banner
      }
      return {
        nodes: nodesNorm,
        edges,
        selectedId: null,
        selectedIds: [],
        selectedInstanceId: null,
        pendingSourceId:
          s.pendingSourceId && idSet.has(s.pendingSourceId)
            ? null
            : s.pendingSourceId,
        topologyBanner,
      }
    }),

  addEdge: (edge) =>
    set((s) => {
      const dup = Object.values(s.edges).some(
        (e) => e.sourceId === edge.sourceId && e.targetId === edge.targetId
      )
      if (dup) return s
      recordCanvasHistory(s.nodes, s.edges)
      const edges = { ...s.edges, [edge.id]: edge }
      const nodesNorm = applyCacheStrategyNormalizationToNodes(
        s.nodes,
        edges,
        cacheStrategyOptionsForUser(),
      )
      return {
        edges,
        nodes: nodesNorm,
        connectHoverTargetId: null,
      }
    }),

  removeEdge: (id) =>
    set((s) => {
      if (!s.edges[id]) return s
      recordCanvasHistory(s.nodes, s.edges)
      const { [id]: _removed, ...edges } = s.edges
      const nodesNorm = applyCacheStrategyNormalizationToNodes(
        s.nodes,
        edges,
        cacheStrategyOptionsForUser(),
      )
      return { edges, nodes: nodesNorm }
    }),

  setPendingSource: (pendingSourceId) =>
    set({ pendingSourceId, connectHoverTargetId: null }),

  setConnectHoverTargetId: (connectHoverTargetId) => set({ connectHoverTargetId }),

  setHoveredNodeId: (hoveredNodeId) =>
    set((s) => ({
      hoveredNodeId,
      hoveredInstanceId:
        hoveredNodeId == null || hoveredNodeId !== s.hoveredNodeId
          ? null
          : s.hoveredInstanceId,
    })),

  setHoveredInstanceId: (hoveredInstanceId) => set({ hoveredInstanceId }),

  setTopologyBanner: (topologyBanner) => set({ topologyBanner }),

  setEdgeAnimated: (id, animated) =>
    set((s) => {
      const e = s.edges[id]
      if (!e) return s
      return { edges: { ...s.edges, [id]: { ...e, animated } } }
    }),

  setMovementLocked: (movementLocked) => set({ movementLocked }),

  selectNode: (selectedId) =>
    set((s) => {
      const node = selectedId ? s.nodes[selectedId] : null
      return {
        selectedId,
        selectedIds: selectedId ? [selectedId] : [],
        selectedInstanceId: defaultSelectedInstanceId(node),
        hoveredInstanceId: null,
      }
    }),

  setSelectedInstanceId: (selectedInstanceId) => set({ selectedInstanceId }),

  setSelectedIds: (selectedIds) =>
    set((s) => ({
      selectedIds,
      selectedId: selectedIds.length === 1 ? selectedIds[0] : null,
      selectedInstanceId:
        selectedIds.length === 1
          ? defaultSelectedInstanceId(s.nodes[selectedIds[0]!])
          : null,
    })),

  selectAllNodes: () =>
    set((s) => {
      if (!canMutateCanvasTopology(s)) return s
      const selectedIds = Object.keys(s.nodes)
      if (selectedIds.length === 0) return s
      return { selectedIds, selectedId: null, selectedInstanceId: null }
    }),

  setMode: (next) => {
    const mode = next === 'simulate' && !SHOW_SIMULATION_UI ? 'design' : next
    set({
      mode,
      hoveredNodeId: null,
      hoveredInstanceId: null,
      ...(mode === 'live' || mode === 'simulate'
        ? {
            pendingSourceId: null,
            placingNodeType: null,
            connectHoverTargetId: null,
            designTool: 'select' as const,
          }
        : {}),
    })
  },

  setDeploymentId: (deploymentId) => set({ deploymentId }),

  setPlacingNodeType: (placingNodeType) => set({ placingNodeType }),

  setDesignTool: (designTool) =>
    set({
      designTool,
      pendingSourceId: null,
      connectHoverTargetId: null,
    }),

  setSnapshotTemplateId: (snapshotTemplateId) => {
    const prev = get().snapshotTemplateId
    if (prev !== snapshotTemplateId) {
      resetDesignStorytellingUi({
        syncPredictions: Boolean(snapshotTemplateId),
      })
    }
    set({
      snapshotTemplateId,
      ...(snapshotTemplateId
        ? {}
        : { templatePresetMode: null, loadedVariationId: null }),
    })
  },

  setTemplatePresetMode: (templatePresetMode) => set({ templatePresetMode }),

  setLoadedVariationId: (loadedVariationId) => set({ loadedVariationId }),

  setLiveSessionEndsAt: (liveSessionEndsAt) => set({ liveSessionEndsAt }),

  setLiveSessionEnding: (liveSessionEnding) => set({ liveSessionEnding }),

  setLiveSessionStartedAt: (liveSessionStartedAt) => set({ liveSessionStartedAt }),

  setSessionSummary: (sessionSummary) => set({ sessionSummary }),

  setNarrativeHighlightNodeIds: (narrativeHighlightNodeIds) =>
    set({ narrativeHighlightNodeIds }),

  setWalkthroughHighlights: ({
    activeNodeId,
    visitedNodeIds,
    highlightedEdgeIds,
    participatingNodeIds,
  }) =>
    set({
      walkthroughActiveNodeId: activeNodeId,
      walkthroughVisitedNodeIds: visitedNodeIds,
      walkthroughHighlightedEdgeIds: highlightedEdgeIds,
      walkthroughParticipatingNodeIds: participatingNodeIds,
    }),

  clearWalkthrough: () =>
    set({
      walkthroughActiveNodeId: null,
      walkthroughVisitedNodeIds: [],
      walkthroughHighlightedEdgeIds: [],
      walkthroughParticipatingNodeIds: [],
      hoveredNodeId: null,
    }),

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
    const snap: CanvasSnapshot = {
      version: '1.0',
      templateId: s.snapshotTemplateId ?? undefined,
      nodes: Object.values(s.nodes),
      edges: Object.values(s.edges),
      exportedAt: new Date().toISOString(),
    }
    if (Object.keys(s.jobBindings).length > 0) {
      snap.jobBindings = { ...s.jobBindings }
    }
    return snap
  },

  undo: () => {
    const s = get()
    if (!canMutateCanvasTopology(s)) return
    const entry = popUndoSnapshot(s.nodes, s.edges)
    if (!entry) return
    restoreTopology(set, entry)
  },

  redo: () => {
    const s = get()
    if (!canMutateCanvasTopology(s)) return
    const entry = popRedoSnapshot(s.nodes, s.edges)
    if (!entry) return
    restoreTopology(set, entry)
  },

  loadJSON: (snapshot) => {
    clearCanvasHistory()
    resetDesignStorytellingUi()
    clearSessionLayout()
    set({
      nodes: Object.fromEntries(snapshot.nodes.map((n) => [n.id, n])),
      edges: Object.fromEntries(snapshot.edges.map((e) => [e.id, e])),
      selectedId: null,
      selectedIds: [],
      selectedInstanceId: null,
      pendingSourceId: null,
      designTool: 'select',
      placingNodeType: null,
      connectHoverTargetId: null,
      snapshotTemplateId: snapshot.templateId ?? null,
      templatePresetMode: null,
      loadedVariationId: null,
      deploymentId: null,
      liveSessionEndsAt: null,
      liveSessionEnding: false,
      liveSessionStartedAt: null,
      sessionSummary: null,
      movementLocked: false,
      mode: 'design',
      narrativeHighlightNodeIds: [],
      walkthroughActiveNodeId: null,
      walkthroughVisitedNodeIds: [],
      walkthroughHighlightedEdgeIds: [],
      walkthroughParticipatingNodeIds: [],
      hoveredNodeId: null,
      jobBindings: snapshot.jobBindings ? { ...snapshot.jobBindings } : {},
    })
    resetDesignStorytellingUi({ syncPredictions: Boolean(snapshot.templateId) })
  },

  loadTemplateSnapshot: (snapshot, targetMode) => {
    clearCanvasHistory()
    resetDesignStorytellingUi()
    clearSessionLayout()
    set({
      nodes: Object.fromEntries(snapshot.nodes.map((n) => [n.id, n])),
      edges: Object.fromEntries(snapshot.edges.map((e) => [e.id, e])),
      selectedId: null,
      selectedIds: [],
      selectedInstanceId: null,
      pendingSourceId: null,
      designTool: 'select',
      placingNodeType: null,
      connectHoverTargetId: null,
      snapshotTemplateId: snapshot.templateId ?? null,
      templatePresetMode: null,
      loadedVariationId: null,
      deploymentId: null,
      liveSessionEndsAt: null,
      liveSessionEnding: false,
      liveSessionStartedAt: null,
      sessionSummary: null,
      movementLocked: false,
      mode: targetMode,
      narrativeHighlightNodeIds: [],
      walkthroughActiveNodeId: null,
      walkthroughVisitedNodeIds: [],
      walkthroughHighlightedEdgeIds: [],
      walkthroughParticipatingNodeIds: [],
      hoveredNodeId: null,
      jobBindings: snapshot.jobBindings ? { ...snapshot.jobBindings } : {},
    })
    resetDesignStorytellingUi({ syncPredictions: Boolean(snapshot.templateId) })
  },

  startFromTemplate: (templateId) => {
    clearCanvasHistory()
    resetDesignStorytellingUi()
    clearSessionLayout()
    set({
      nodes: {},
      edges: {},
      selectedId: null,
      selectedIds: [],
      selectedInstanceId: null,
      pendingSourceId: null,
      designTool: 'select',
      placingNodeType: null,
      connectHoverTargetId: null,
      snapshotTemplateId: templateId,
      templatePresetMode: null,
      loadedVariationId: null,
      deploymentId: null,
      liveSessionEndsAt: null,
      liveSessionEnding: false,
      liveSessionStartedAt: null,
      sessionSummary: null,
      movementLocked: false,
      mode: 'design',
      narrativeHighlightNodeIds: [],
      walkthroughActiveNodeId: null,
      walkthroughVisitedNodeIds: [],
      walkthroughHighlightedEdgeIds: [],
      walkthroughParticipatingNodeIds: [],
      hoveredNodeId: null,
      jobBindings: {},
    })
    resetDesignStorytellingUi({ syncPredictions: true })
  },

  clearCanvas: () => {
    clearCanvasHistory()
    resetDesignStorytellingUi()
    clearSessionLayout()
    set({
      mode: 'design',
      nodes: {},
      edges: {},
      selectedId: null,
      selectedIds: [],
      selectedInstanceId: null,
      pendingSourceId: null,
      designTool: 'select',
      placingNodeType: null,
      connectHoverTargetId: null,
      snapshotTemplateId: null,
      templatePresetMode: null,
      loadedVariationId: null,
      deploymentId: null,
      liveSessionEndsAt: null,
      liveSessionEnding: false,
      liveSessionStartedAt: null,
      sessionSummary: null,
      movementLocked: false,
      narrativeHighlightNodeIds: [],
      walkthroughActiveNodeId: null,
      walkthroughVisitedNodeIds: [],
      walkthroughHighlightedEdgeIds: [],
      walkthroughParticipatingNodeIds: [],
      hoveredNodeId: null,
      jobBindings: {},
    })
  },
}))
