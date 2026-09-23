import { afterEach, describe, expect, it } from 'vitest'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import {
  resetDevInspectorModeCache,
  setDevInspectorMode,
} from './devInspectorMode'
import {
  buildDevInstanceScopeMetrics,
  devInstanceScopePreviewEnabled,
  isInstanceScopeViewportMode,
} from './devInstanceScopePreview'

afterEach(() => {
  resetDevInspectorModeCache()
  if (import.meta.env.DEV) setDevInspectorMode('live')
})

describe('devInstanceScopePreview', () => {
  it('is enabled only in local design mode with live inspector preview', () => {
    if (!import.meta.env.DEV) {
      expect(devInstanceScopePreviewEnabled('design')).toBe(false)
      return
    }
    setDevInspectorMode('live')
    expect(devInstanceScopePreviewEnabled('design')).toBe(true)
    setDevInspectorMode('config')
    expect(devInstanceScopePreviewEnabled('design')).toBe(false)
    expect(devInstanceScopePreviewEnabled('live')).toBe(false)
  })

  it('extends metrics viewport mode in DEV design', () => {
    if (!import.meta.env.DEV) {
      expect(isInstanceScopeViewportMode('design')).toBe(false)
      return
    }
    setDevInspectorMode('live')
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

  it('builds cache, load balancer, and database fixtures for dev preview', () => {
    const cache: CanvasNode = {
      id: 'cache1',
      type: 'cache',
      label: 'Redis',
      position: [0, 0, 0],
      status: 'healthy',
      config: { cacheStrategy: 'cache-aside' },
    }
    const db: CanvasNode = {
      id: 'db1',
      type: 'database',
      label: 'Postgres',
      position: [0, 0, 0],
      status: 'healthy',
      config: { readReplicas: 0 },
    }
    const lb: CanvasNode = {
      id: 'lb1',
      type: 'load_balancer',
      label: 'LB',
      position: [0, 0, 0],
      status: 'healthy',
      config: {},
    }
    expect(buildDevInstanceScopeMetrics(cache, undefined)?.cacheHits).toBeGreaterThan(0)
    expect(buildDevInstanceScopeMetrics(db, undefined)?.layers.length).toBe(1)
    const app: CanvasNode = {
      id: 'app1',
      type: 'compute',
      label: 'App',
      position: [0, 0, 0],
      status: 'healthy',
      config: { replicas: 2 },
    }
    expect(
      buildDevInstanceScopeMetrics(
        lb,
        { id: 'app1', archetype: 'app-server', engine: 'generic', x: 0, y: 0, label: 'App', config: {}, topology: { replicas: 2, shards: 1, packing: 'stack' } },
        { app1: app },
        {
          e1: { id: 'e1', sourceId: 'lb1', targetId: 'app1', protocol: 'http', animated: false },
        },
      )?.backendPods.length,
    ).toBe(2)
  })

  it('builds worker pod fixtures aligned with canvas unit count', () => {
    const node: CanvasNode = {
      id: 'worker1',
      type: 'worker',
      label: 'Worker',
      position: [0, 0, 0],
      status: 'healthy',
      config: { replicas: 3 },
    }
    const metrics = buildDevInstanceScopeMetrics(node, {
      id: 'worker1',
      archetype: 'worker',
      engine: 'generic',
      x: 0,
      y: 0,
      label: 'Worker',
      config: {},
      topology: { replicas: 3, shards: 1, packing: 'stack' },
    })
    expect(metrics?.podReplicas).toHaveLength(3)
    expect(metrics?.podReplicas[0]?.name).toBe('worker1-roll-a')
  })
})
