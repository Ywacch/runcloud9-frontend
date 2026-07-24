import {
  cloneSvgEdge,
  cloneSvgNode,
  cloneSvgZone,
  type SvgEdge,
  type SvgNode,
  type SvgZone,
} from './svgTypes'

export type SvgHistorySnapshot = {
  nodes: SvgNode[]
  edges: SvgEdge[]
  zones: SvgZone[]
  labelSeq: number
}

const MAX_STACK = 50

let undoStack: SvgHistorySnapshot[] = []
let redoStack: SvgHistorySnapshot[] = []

function cloneSnapshot(s: SvgHistorySnapshot): SvgHistorySnapshot {
  return {
    nodes: s.nodes.map(cloneSvgNode),
    edges: s.edges.map(cloneSvgEdge),
    zones: s.zones.map(cloneSvgZone),
    labelSeq: s.labelSeq,
  }
}

export function clearSvgHistory(): void {
  undoStack = []
  redoStack = []
}

export function pushSvgHistory(current: SvgHistorySnapshot): void {
  undoStack.push(cloneSnapshot(current))
  if (undoStack.length > MAX_STACK) undoStack.shift()
  redoStack = []
}

export function popSvgUndo(
  current: SvgHistorySnapshot,
): SvgHistorySnapshot | null {
  const prev = undoStack.pop()
  if (!prev) return null
  redoStack.push(cloneSnapshot(current))
  if (redoStack.length > MAX_STACK) redoStack.shift()
  return prev
}

export function popSvgRedo(
  current: SvgHistorySnapshot,
): SvgHistorySnapshot | null {
  const next = redoStack.pop()
  if (!next) return null
  undoStack.push(cloneSnapshot(current))
  if (undoStack.length > MAX_STACK) undoStack.shift()
  return next
}
