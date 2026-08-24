import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import {
  buildDevInstanceScopeMetrics,
  devInstanceScopePreviewEnabled,
  isInstanceScopeViewportMode,
} from './devInstanceScopePreview'

describe('devInstanceScopePreview', () => {
  it('is enabled only in local design mode', () => {
    expect(devInstanceScopePreviewEnabled('design')).toBe(import.meta.env.DEV)
    expect(devInstanceScopePreviewEnabled('live')).toBe(false)
  })

  it('extends metrics viewport mode in DEV design', () => {
    if (!import.meta.env.DEV) {
      expect(isInstanceScopeViewportMode('design')).toBe(false)
      return
    }
    expect(isInstanceScopeViewportMode('design')).toBe(true)
    expect(isInstanceScopeViewportMode('live')).toBe(true)
    expect(isInstanceScopeViewportMode('simulate')).toBe(true)
  })

  it('builds compute pod fixtures aligned with canvas unit count', () => {
    const node: CanvasNode = {
      id: 'app1',
      type: 'compute',
      label: 'App',
      position: [0, 0, 0],
      status: 'healthy',
      config: { replicas: 2 },
    }
    const metrics = buildDevInstanceScopeMetrics(node, {
      id: 'app1',
      archetype: 'app-server',
      engine: 'generic',
      x: 0,
      y: 0,
      label: 'App',
      config: {},
      topology: { replicas: 2, shards: 1, packing: 'stack' },
    })
    expect(metrics?.podReplicas).toHaveLength(2)
    expect(metrics?.runtimeHealth?.pods).toHaveLength(2)
  })
})
