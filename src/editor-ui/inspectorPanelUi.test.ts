import { describe, expect, it } from 'vitest'
import { runtimeHealthPodsForScope, tooltipResourceBucket } from './inspectorPanelUi'
import type { ComponentLayerMetrics } from '../editor-core/domain/metricsUiContract'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'

describe('runtimeHealthPodsForScope', () => {
  const pods = [
    {
      name: 'app-server-roll-abc',
      ready: true,
      restartCount: 0,
    },
    {
      name: 'app-server-roll-def',
      ready: false,
      restartCount: 1,
    },
  ]

  it('returns all pods for cluster scope', () => {
    expect(runtimeHealthPodsForScope(pods, 'cluster')).toEqual(pods)
    expect(runtimeHealthPodsForScope(pods, null)).toEqual(pods)
  })

  it('filters to the selected pod name', () => {
    expect(runtimeHealthPodsForScope(pods, 'app-server-roll-abc')).toEqual([
      pods[0],
    ])
  })

  it('returns null when no pod matches the selected instance', () => {
    expect(runtimeHealthPodsForScope(pods, 'missing-pod')).toBeNull()
  })
})

describe('tooltipResourceBucket', () => {
  it('overlays instance layer cpu/memory onto the cluster bucket', () => {
    const cluster = {
      cpuUsage: 0,
      cpuLimit: 0,
      cpuIsEstimated: true,
      memoryBytes: 0,
      memoryLimit: 0,
      memIsEstimated: true,
      requestRate: 470,
    } as MetricsBucket
    const layer: ComponentLayerMetrics = {
      id: 'postgres',
      role: 'primary',
      engine: 'postgresql',
      cpuUsage: 0.2,
      memoryBytes: 256 * 1024 * 1024,
      cpuLimit: 0.5,
      memoryLimit: 1024 * 1024 * 1024,
      cpuIsEstimated: false,
      memIsEstimated: false,
      cpuSource: 'cadvisor',
      memSource: 'cadvisor',
    }
    const scoped = tooltipResourceBucket(cluster, layer)
    expect(scoped.cpuLimit).toBe(0.5)
    expect(scoped.cpuIsEstimated).toBe(false)
    expect(scoped.memoryLimit).toBe(1024 * 1024 * 1024)
    expect(scoped.requestRate).toBe(470)
  })
})
