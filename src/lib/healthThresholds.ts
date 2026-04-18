import type { CanvasNode } from '../store/canvasStore'
import type { MetricsBucket } from '../store/metricsStore'

export const HIGH_LOAD_CPU = 0.8
export const HIGH_LOAD_MEM = 0.8
export const ERROR_RATE_THRESHOLD = 0.01

export type HealthState = 'normal' | 'high-load' | 'error'

export function computeHealthState(
  m: MetricsBucket | undefined,
  nodeStatus: CanvasNode['status']
): HealthState {
  if (nodeStatus === 'degraded') return 'error'
  if (!m) return 'normal'
  if ((m.errorRate ?? 0) > ERROR_RATE_THRESHOLD) return 'error'
  if ((m.cpuPercent ?? 0) > HIGH_LOAD_CPU || (m.memPercent ?? 0) > HIGH_LOAD_MEM) {
    return 'high-load'
  }
  return 'normal'
}
