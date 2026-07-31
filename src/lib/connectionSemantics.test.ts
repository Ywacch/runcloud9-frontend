import { describe, expect, it } from 'vitest'
import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'
import {
  CONNECTION_RULES,
  analyzeDeployTopology,
  classifySemanticPair,
  classifyCanvasEdge,
  type SemanticComponentType,
} from './connectionSemantics'
import { paintForSemanticClass } from './edgeSemanticPaint'

const SEMANTIC_TYPES: SemanticComponentType[] = [
  'lb',
  'app-server',
  'db',
  'cache',
  'mq',
  'worker',
]

function node(id: string, type: CanvasNode['type']): CanvasNode {
  return {
    id,
    type,
    label: id,
    position: [0, 0, 0],
    config: {},
    status: 'idle',
  }
}

function edge(id: string, sourceId: string, targetId: string): CanvasEdge {
  return {
    id,
    sourceId,
    targetId,
    protocol: 'http',
    animated: false,
  }
}

describe('connectionSemantics grid', () => {
  it('defines all 36 type pairs', () => {
    for (const a of SEMANTIC_TYPES) {
      for (const b of SEMANTIC_TYPES) {
        expect(CONNECTION_RULES.has(`${a}\0${b}`)).toBe(true)
      }
    }
    expect(CONNECTION_RULES.size).toBe(36)
  })

  it('marks lb → db invalid', () => {
    const result = classifySemanticPair('lb', 'db', true)
    expect(result.class).toBe('invalid')
    expect(result.message).toContain('Load balancers')
  })

  it('marks lb → app-server active when worker supported', () => {
    const result = classifySemanticPair('lb', 'app-server', true)
    expect(result.class).toBe('active')
  })

  it('marks app-server → mq decorative when !supportsWorker', () => {
    const result = classifySemanticPair('app-server', 'mq', false)
    expect(result.class).toBe('decorative')
  })

  it('marks lb → lb unsupported', () => {
    const result = classifySemanticPair('lb', 'lb', true)
    expect(result.class).toBe('unsupported')
  })
})

describe('classifyCanvasEdge', () => {
  it('classifies canvas types via backend mapping', () => {
    const nodes = {
      lb: node('lb', 'load_balancer'),
      app: node('app', 'compute'),
    }
    const result = classifyCanvasEdge(
      edge('e1', 'lb', 'app'),
      nodes,
      true,
    )
    expect(result?.class).toBe('active')
  })
})

describe('analyzeDeployTopology', () => {
  it('blocks invalid edges before create', () => {
    const nodes = {
      lb: node('lb', 'load_balancer'),
      db: node('db', 'database'),
    }
    const edges = { e1: edge('e1', 'lb', 'db') }
    const preflight = analyzeDeployTopology(nodes, edges, true)
    expect(preflight.invalidEdges).toHaveLength(1)
    expect(preflight.needsDecorativeConfirm).toBe(false)
  })

  it('requires confirm when mq present without worker support', () => {
    const nodes = {
      app: node('app', 'compute'),
      mq: node('mq', 'message_queue'),
      db: node('db', 'database'),
    }
    const edges = {
      e1: edge('e1', 'app', 'mq'),
      e2: edge('e2', 'app', 'db'),
    }
    const preflight = analyzeDeployTopology(nodes, edges, false)
    expect(preflight.invalidEdges).toHaveLength(0)
    expect(preflight.needsDecorativeConfirm).toBe(true)
    expect(preflight.hasIdleAsyncNodes).toBe(true)
  })
})

describe('edgeSemanticPaint', () => {
  it('maps semantic classes to paint tokens', () => {
    expect(paintForSemanticClass('active')?.color).toBe('#16a34a')
    expect(paintForSemanticClass('decorative')?.dash).toBe('6 4')
    expect(paintForSemanticClass('unsupported')?.color).toBe('#d97706')
    expect(paintForSemanticClass('invalid')?.color).toBe('#b91c1c')
    expect(paintForSemanticClass('neutral')).toBeNull()
  })
})
