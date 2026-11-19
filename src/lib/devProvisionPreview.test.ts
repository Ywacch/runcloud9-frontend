import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import {
  buildDevProvisionMetrics,
  DEV_PROVISION_PREVIEW_KEY,
  isDevProvisionPreviewEnabled,
} from './devProvisionPreview'

function node(
  id: string,
  type: CanvasNode['type'],
  config: Record<string, unknown> = {},
): CanvasNode {
  return {
    id,
    type,
    position: [0, 0, 0],
    label: id,
    config,
    status: 'idle',
  }
}

describe('isDevProvisionPreviewEnabled', () => {
  it('reads query and storage only in DEV', () => {
    const storage = {
      getItem: (k: string) => (k === DEV_PROVISION_PREVIEW_KEY ? '1' : null),
    }
    expect(isDevProvisionPreviewEnabled('?provision=preview', { getItem: () => null })).toBe(
      import.meta.env.DEV,
    )
    expect(isDevProvisionPreviewEnabled('', storage)).toBe(import.meta.env.DEV)
    expect(isDevProvisionPreviewEnabled('', { getItem: () => null })).toBe(false)
  })
})

describe('buildDevProvisionMetrics', () => {
  it('keys status by real canvas node ids and pads replica rows', () => {
    const nodes = {
      'app-1': node('app-1', 'compute', { replicas: 3 }),
      'db-1': node('db-1', 'database'),
    }
    const pending = buildDevProvisionMetrics(nodes, 1)
    expect(pending.componentStatus['db-1']).toBe('pending')
    expect(pending.componentStatus['app-1']).toBe('pending')

    const mid = buildDevProvisionMetrics(nodes, 13)
    expect(mid.componentStatus['db-1']).toBe('ready')
    expect(mid.componentStatus['app-1']).toBe('deploying')
    expect(mid.replicaStatus['app-1']?.length).toBe(3)
    expect(mid.replicaStatus['app-1']?.filter((r) => r.ready).length).toBe(1)
    expect(mid.seedingStatus).toBe('seeding')
  })
})
