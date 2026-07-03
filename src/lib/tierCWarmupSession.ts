import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { TIER_C_WARMUP_MS, isTierCResource, isTierCWarmingUp } from '../editor-ui/inspectorPanelUi'

const firstTierCAtByNode = new Map<string, number>()
const warmupCompleteByNode = new Set<string>()

/** Record the first live Tier C sample for a node; survives inspector remounts. */
export function recordTierCSample(
  nodeId: string,
  m: MetricsBucket,
  nowMs: number,
): void {
  if (warmupCompleteByNode.has(nodeId)) return
  if (!isTierCResource(m) || m.cpuIsEstimated) return

  const existing = firstTierCAtByNode.get(nodeId)
  if (existing == null) {
    firstTierCAtByNode.set(nodeId, nowMs)
    return
  }

  if (nowMs - existing >= TIER_C_WARMUP_MS) {
    warmupCompleteByNode.add(nodeId)
  }
}

export function isDbTierCWarmingUp(
  nodeId: string,
  m: MetricsBucket,
  nowMs: number,
): boolean {
  if (warmupCompleteByNode.has(nodeId)) return false
  if (!isTierCResource(m) || m.cpuIsEstimated) return false

  const firstAt = firstTierCAtByNode.get(nodeId)
  if (firstAt == null) return false

  if (!isTierCWarmingUp(firstAt, nowMs)) {
    warmupCompleteByNode.add(nodeId)
    return false
  }
  return true
}

/** Sync session state during render; returns whether DB cluster warmup is active. */
export function syncDbTierCWarmup(
  nodeId: string,
  m: MetricsBucket,
  nowMs: number,
): boolean {
  recordTierCSample(nodeId, m, nowMs)
  return isDbTierCWarmingUp(nodeId, m, nowMs)
}

export function clearTierCWarmupSession(): void {
  firstTierCAtByNode.clear()
  warmupCompleteByNode.clear()
}

/** Test-only reset helpers. */
export function __tierCWarmupSessionTestState(): {
  firstTierCAtByNode: Map<string, number>
  warmupCompleteByNode: Set<string>
} {
  return { firstTierCAtByNode, warmupCompleteByNode }
}
