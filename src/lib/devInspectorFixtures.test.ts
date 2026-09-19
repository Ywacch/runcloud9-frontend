import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import {
  DEV_INSPECTOR_CACHE_KEY_COUNT,
  DEV_INSPECTOR_DEPLOYMENT_ID,
  buildDevInspectorLogs,
  devInspectorDeploymentId,
  devIntrospectFixture,
  isDevInspectorDeployment,
} from './devInspectorFixtures'

const computeNode: CanvasNode = {
  id: 'app',
  type: 'compute',
  label: 'App',
  x: 0,
  y: 0,
  config: {},
}

describe('devInspectorFixtures', () => {
  it('resolves synthetic deployment id in dev preview', () => {
    expect(devInspectorDeploymentId(false, true, null)).toBe(
      DEV_INSPECTOR_DEPLOYMENT_ID,
    )
    expect(devInspectorDeploymentId(true, false, 'dep-1')).toBe('dep-1')
    expect(devInspectorDeploymentId(false, false, null)).toBeNull()
  })

  it('builds component logs for canvas nodes', () => {
    const logs = buildDevInspectorLogs({
      app: computeNode,
      cache: {
        id: 'cache',
        type: 'cache',
        label: 'Redis',
        x: 0,
        y: 0,
        config: {},
      },
    })
    expect(logs.length).toBeGreaterThan(0)
    expect(logs.some((line) => line.component === 'app-server')).toBe(true)
    expect(logs.some((line) => line.component === 'cache')).toBe(true)
  })

  it('returns introspect fixtures for db, cache, and mq', () => {
    expect(devIntrospectFixture('db', 'tables')).toEqual([
      { name: 'urls', rowCount: 3 },
    ])
    expect(devIntrospectFixture('cache', 'stats')).toEqual({
      keyCount: DEV_INSPECTOR_CACHE_KEY_COUNT,
    })
    expect(devIntrospectFixture('mq', 'queues')).toEqual([
      { name: 'orders', messages: 42, consumers: 1, available: true },
      { name: 'orders.dlq', messages: 0, consumers: 0, available: true },
    ])
  })

  it('detects dev inspector deployment id', () => {
    expect(isDevInspectorDeployment(DEV_INSPECTOR_DEPLOYMENT_ID)).toBe(
      import.meta.env.DEV,
    )
    expect(isDevInspectorDeployment('real-deploy')).toBe(false)
  })
})
