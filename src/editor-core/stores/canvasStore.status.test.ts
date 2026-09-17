import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasStore, type CanvasNode } from './canvasStore'

function node(id: string, status: CanvasNode['status'] = 'healthy'): CanvasNode {
  return {
    id,
    type: 'compute',
    position: [0, 0, 0],
    label: id,
    config: {},
    status,
  }
}

describe('canvasStore updateNodeStatus', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: {
        a: node('a', 'healthy'),
        b: node('b', 'healthy'),
      },
    })
  })

  it('no-ops when status is unchanged', () => {
    const before = useCanvasStore.getState().nodes
    useCanvasStore.getState().updateNodeStatus('a', 'healthy')
    expect(useCanvasStore.getState().nodes).toBe(before)
  })

  it('updates status when it changes', () => {
    useCanvasStore.getState().updateNodeStatus('a', 'degraded')
    expect(useCanvasStore.getState().nodes.a.status).toBe('degraded')
  })

  it('keeps other node references when one status changes', () => {
    const beforeB = useCanvasStore.getState().nodes.b
    useCanvasStore.getState().updateNodeStatus('a', 'degraded')
    expect(useCanvasStore.getState().nodes.b).toBe(beforeB)
  })
})

describe('canvasStore updateNodeStatuses', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: {
        a: node('a', 'healthy'),
        b: node('b', 'healthy'),
      },
    })
  })

  it('no-ops when all statuses are unchanged', () => {
    const before = useCanvasStore.getState().nodes
    useCanvasStore.getState().updateNodeStatuses({
      a: 'healthy',
      b: 'healthy',
    })
    expect(useCanvasStore.getState().nodes).toBe(before)
  })

  it('applies multiple status changes in one set', () => {
    useCanvasStore.getState().updateNodeStatuses({
      a: 'degraded',
      b: 'provisioning',
    })
    expect(useCanvasStore.getState().nodes.a.status).toBe('degraded')
    expect(useCanvasStore.getState().nodes.b.status).toBe('provisioning')
  })
})
