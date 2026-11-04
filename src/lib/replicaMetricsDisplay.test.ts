import { describe, expect, it } from 'vitest'
import type { PodReplicaMetrics } from '../editor-core/domain/metricsUiContract'
import { replicaBreakdownFromPods } from './replicaMetricsDisplay'

describe('replicaBreakdownFromPods', () => {
  const pods: PodReplicaMetrics[] = [
    {
      name: 'app-server-abc',
      ready: true,
      requestRate: 50,
      p99LatencyMs: 40,
      cpuUsage: 0.09,
      memoryBytes: 16 * 1024 * 1024,
      errorRate: 0,
      totalRequests: 0,
    },
  ]

  it('returns null memPercent when cluster memory limit is missing', () => {
    const rows = replicaBreakdownFromPods(pods, 0, 0)
    expect(rows[0]?.memPercent).toBeNull()
  })

  it('does not treat usage as percent of one core when cpu limit is missing', () => {
    const rows = replicaBreakdownFromPods(pods, 0, 256 * 1024 * 1024)
    expect(rows[0]?.memPercent).not.toBeNull()
    expect(rows[0]?.cpuPercent).toBe(0)
  })
})
