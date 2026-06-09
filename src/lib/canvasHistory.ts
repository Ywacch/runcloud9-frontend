import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'

const MAX_HISTORY = 50

export interface CanvasTopologySnapshot {
  nodes: Record<string, CanvasNode>
  edges: Record<string, CanvasEdge>
}

let past: CanvasTopologySnapshot[] = []
let future: CanvasTopologySnapshot[] = []
let recordingSuspended = 0

function cloneTopology(
  nodes: Record<string, CanvasNode>,
  edges: Record<string, CanvasEdge>,
): CanvasTopologySnapshot {
  return structuredClone({ nodes, edges })
}

function shouldRecord(): boolean {
  return recordingSuspended === 0
}

/** Snapshot nodes + edges before a user edit (skipped during undo/redo/bulk ops). */
export function recordCanvasHistory(
  nodes: Record<string, CanvasNode>,
  edges: Record<string, CanvasEdge>,
): void {
  if (!shouldRecord()) return
  past.push(cloneTopology(nodes, edges))
  if (past.length > MAX_HISTORY) past.shift()
  future = []
}

export function withoutCanvasHistoryRecording(fn: () => void): void {
  recordingSuspended++
  try {
    fn()
  } finally {
    recordingSuspended--
  }
}

export function clearCanvasHistory(): void {
  past = []
  future = []
}

export function canUndoCanvasHistory(): boolean {
  return past.length > 0
}

export function canRedoCanvasHistory(): boolean {
  return future.length > 0
}

export function popUndoSnapshot(
  currentNodes: Record<string, CanvasNode>,
  currentEdges: Record<string, CanvasEdge>,
): CanvasTopologySnapshot | null {
  const entry = past.pop()
  if (!entry) return null
  future.push(cloneTopology(currentNodes, currentEdges))
  return entry
}

export function popRedoSnapshot(
  currentNodes: Record<string, CanvasNode>,
  currentEdges: Record<string, CanvasEdge>,
): CanvasTopologySnapshot | null {
  const entry = future.pop()
  if (!entry) return null
  past.push(cloneTopology(currentNodes, currentEdges))
  return entry
}
