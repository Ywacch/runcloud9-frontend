import { describe, expect, it } from 'vitest'
import {
  buildJourneyWalkthroughPath,
  findEdgeOnPath,
  nodeIdForBackendComponent,
} from './walkthroughPath'
import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'

const nodes: Record<string, CanvasNode> = {
  client: {
    id: 'client',
    type: 'client',
    label: 'Client',
    config: {},
    position: [0, 0, 0],
    status: 'idle',
  },
  lb: {
    id: 'lb',
    type: 'load_balancer',
    label: 'LB',
    config: {},
    position: [2, 0, 0],
    status: 'idle',
  },
  app: {
    id: 'app',
    type: 'compute',
    label: 'App',
    config: {},
    position: [4, 0, 0],
    status: 'idle',
  },
}

const edges: Record<string, CanvasEdge> = {
  e1: {
    id: 'e1',
    sourceId: 'client',
    targetId: 'lb',
    protocol: 'http',
    animated: false,
  },
  e2: {
    id: 'e2',
    sourceId: 'lb',
    targetId: 'app',
    protocol: 'http',
    animated: false,
  },
}

describe('walkthroughPath', () => {
  it('maps backend components to canvas node ids', () => {
    expect(nodeIdForBackendComponent('lb', nodes)).toBe('lb')
    expect(nodeIdForBackendComponent('app-server', nodes)).toBe('app')
  })

  it('finds direct edges and first hop on multi-hop paths', () => {
    expect(findEdgeOnPath('client', 'lb', edges)).toBe('e1')
    expect(findEdgeOnPath('lb', 'app', edges)).toBe('e2')
    expect(findEdgeOnPath('client', 'app', edges)).toBe('e1')
  })

  it('builds step nodes, edges, and participating set including client', () => {
    const path = buildJourneyWalkthroughPath(
      [
        { component: 'lb', action: 'Route' },
        { component: 'app-server', action: 'Handle' },
      ],
      nodes,
      edges,
    )
    expect(path.clientNodeId).toBe('client')
    expect(path.stepNodeIds).toEqual(['lb', 'app'])
    expect(path.edgeIntoStep[0]).toBe('e1')
    expect(path.edgeIntoStep[1]).toBe('e2')
    expect(path.participatingNodeIds.sort()).toEqual(['app', 'client', 'lb'])
  })
})
