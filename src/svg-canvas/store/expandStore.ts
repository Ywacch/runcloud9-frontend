import { useSyncExternalStore } from 'react'
import { isExpandToggleEligible } from '../compose/expandEligibility'
import { defaultExpanded } from '../compose/resolveDisplayUnits'
import type { SvgNode } from './svgTypes'

const overrides = new Map<string, boolean>()
let epoch = 0
const listeners = new Set<() => void>()

function notify(): void {
  epoch += 1
  for (const listener of listeners) listener()
}

export function getExpanded(nodeId: string): boolean | undefined {
  return overrides.get(nodeId)
}

export function setExpanded(nodeId: string, value: boolean): void {
  if (overrides.get(nodeId) === value) return
  overrides.set(nodeId, value)
  notify()
}

export function toggleExpanded(nodeId: string, defaultValue: boolean): void {
  const current = overrides.get(nodeId) ?? defaultValue
  setExpanded(nodeId, !current)
}

export function clearExpanded(nodeId: string): void {
  if (!overrides.has(nodeId)) return
  overrides.delete(nodeId)
  notify()
}

let lastInspectableId: string | null = null

/** Fan out stack replicas while a single node is selected; collapse on deselect. */
export function syncExpandWithSelection(
  selectedIds: string[],
  nodes: SvgNode[],
): void {
  const singleId = selectedIds.length === 1 ? selectedIds[0] : null

  if (lastInspectableId && lastInspectableId !== singleId) {
    clearExpanded(lastInspectableId)
  }

  if (!singleId) {
    lastInspectableId = null
    return
  }

  const node = nodes.find((n) => n.id === singleId)
  if (!node || !isExpandToggleEligible(node)) {
    lastInspectableId = singleId
    return
  }

  if (!defaultExpanded(node)) {
    setExpanded(singleId, true)
  }

  lastInspectableId = singleId
}

export function resetExpandStoreForTests(): void {
  overrides.clear()
  lastInspectableId = null
  epoch = 0
}

export function getExpandEpoch(): number {
  return epoch
}

export function subscribeExpand(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  return () => listeners.delete(onStoreChange)
}

export function useExpanded(node: SvgNode): boolean {
  const stored = useSyncExternalStore(
    subscribeExpand,
    () => overrides.get(node.id),
    () => undefined,
  )
  return stored ?? defaultExpanded(node)
}
