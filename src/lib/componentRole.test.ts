import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { getTopologyFlags } from './componentRole'

describe('getTopologyFlags readConsistency', () => {
  it('exposes readConsistency from the first database node', () => {
    const db: CanvasNode = {
      id: 'db',
      type: 'database',
      label: 'DB',
      position: [0, 0, 0],
      config: { readReplicas: 2, readConsistency: 'monotonic' },
      status: 'idle',
    }
    const flags = getTopologyFlags({ db })
    expect(flags.readConsistency).toBe('monotonic')
    expect(flags.dbReadReplicas).toBe(2)
  })

  it('defaults readConsistency when no database nodes exist', () => {
    const flags = getTopologyFlags({})
    expect(flags.readConsistency).toBe('leader-only')
    expect(flags.hasDB).toBe(false)
  })
})
