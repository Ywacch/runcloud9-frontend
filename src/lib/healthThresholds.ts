import type { CanvasNode } from '../store/canvasStore'
import type { MetricsBucket } from '../store/metricsStore'

export const WARNING_CPU = 0.8
export const WARNING_MEM = 0.8
export const ERROR_RATE_THRESHOLD = 0.01

/** @deprecated Use WARNING_CPU */
export const HIGH_LOAD_CPU = WARNING_CPU
/** @deprecated Use WARNING_MEM */
export const HIGH_LOAD_MEM = WARNING_MEM

export type HealthState = 'idle' | 'healthy' | 'warning' | 'error'

export function computeHealthState(
  m: MetricsBucket | undefined,
  nodeStatus: CanvasNode['status']
): HealthState {
  if (nodeStatus === 'degraded') return 'error'
  if (!m) return 'idle'

  if ((m.errorRate ?? 0) > ERROR_RATE_THRESHOLD) return 'error'

  const cpuReal = !m.cpuIsEstimated && m.cpuPercent > 0
  const memReal = !m.memIsEstimated && m.memPercent > 0

  if (cpuReal && m.cpuPercent > WARNING_CPU) return 'warning'
  if (memReal && m.memPercent > WARNING_MEM) return 'warning'

  if (cpuReal || memReal) return 'healthy'

  return 'idle'
}
