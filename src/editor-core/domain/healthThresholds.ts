import type { CanvasNode } from '../stores/canvasStore'
import type { MetricsBucket } from '../stores/metricsStore'
import type { RuntimeHealthSummary } from './metricsUiContract'

/** CPU utilization warning threshold; `cpuPercent` is on a 0–100 scale. */
export const WARNING_CPU = 80
/** Memory utilization warning threshold; `memPercent` is on a 0–100 scale. */
export const WARNING_MEM = 80
export const ERROR_RATE_THRESHOLD = 0.01
/** Canvas status when HTTP error rate exceeds this fraction. */
export const DEGRADED_ERROR_RATE = 0.25

/** @deprecated Use WARNING_CPU */
export const HIGH_LOAD_CPU = WARNING_CPU
/** @deprecated Use WARNING_MEM */
export const HIGH_LOAD_MEM = WARNING_MEM

export type HealthState = 'idle' | 'healthy' | 'warning' | 'error'

export function runtimeHealthIsCritical(
  rh: RuntimeHealthSummary | null | undefined,
): boolean {
  if (!rh) return false
  return rh.restarting || rh.unreadyCount > 0
}

/** Canvas node status from live metrics (runtime health preferred over error rate). */
export function nodeStatusFromMetrics(m: MetricsBucket): CanvasNode['status'] {
  if (runtimeHealthIsCritical(m.runtimeHealth)) return 'degraded'
  if ((m.errorRate ?? 0) > DEGRADED_ERROR_RATE) return 'degraded'
  return 'healthy'
}

export function computeHealthState(
  m: MetricsBucket | undefined,
  nodeStatus: CanvasNode['status']
): HealthState {
  if (nodeStatus === 'degraded') return 'error'
  if (!m) return 'idle'

  if (runtimeHealthIsCritical(m.runtimeHealth)) return 'error'

  if ((m.errorRate ?? 0) > ERROR_RATE_THRESHOLD) return 'error'

  const cpuReal = !m.cpuIsEstimated && m.cpuPercent > 0
  const memReal = !m.memIsEstimated && m.memPercent > 0

  if (cpuReal && m.cpuPercent > WARNING_CPU) return 'warning'
  if (memReal && m.memPercent > WARNING_MEM) return 'warning'

  if (cpuReal || memReal) return 'healthy'

  return 'idle'
}
