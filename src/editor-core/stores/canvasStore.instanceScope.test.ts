import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasStore, type CanvasNode } from './canvasStore'

function dbNode(readReplicas: number): CanvasNode {
  return {
    id: 'db1',
    type: 'database',
    position: [0, 0, 0],
    label: 'Database',
    config: { readReplicas },
    status: 'healthy',
  }
}

describe('canvasStore selectedInstanceId', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: { db1: dbNode(2) },
      selectedId: null,
      selectedIds: [],
      selectedInstanceId: null,
    })
  })

  it('defaults to cluster when selecting a database with read replicas', () => {
    useCanvasStore.getState().selectNode('db1')
    expect(useCanvasStore.getState().selectedInstanceId).toBe('cluster')
  })

  it('clears instance scope when selection is cleared', () => {
    useCanvasStore.getState().selectNode('db1')
    useCanvasStore.getState().selectNode(null)
    expect(useCanvasStore.getState().selectedInstanceId).toBeNull()
  })

  it('leaves instance scope null for databases without replicas', () => {
    useCanvasStore.setState({ nodes: { db1: dbNode(0) } })
    useCanvasStore.getState().selectNode('db1')
    expect(useCanvasStore.getState().selectedInstanceId).toBeNull()
  })
})
