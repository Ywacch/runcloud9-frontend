import { describe, expect, it } from 'vitest'
import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'
import { assessGraphConstraints } from './graphConstraints'
import { analyzeDeployTopology } from './connectionSemantics'

function node(
  id: string,
  type: CanvasNode['type'],
  label?: string,
): CanvasNode {
  return {
    id,
    type,
    label: label ?? id,
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
    protocol: 'tcp',
    animated: false,
  }
}

describe('assessGraphConstraints', () => {
  it('returns null for an empty canvas', () => {
    expect(assessGraphConstraints({}, {})).toBeNull()
  })

  it('flags designs with no app-server', () => {
    const nodes = {
      db: node('db', 'database'),
    }
    expect(assessGraphConstraints(nodes, {})).toMatch(/App Server/i)
  })

  it('returns null for a valid worker topology', () => {
    const nodes = {
      app: node('app', 'compute'),
      db: node('db', 'database'),
      mq: node('mq', 'message_queue'),
      worker: node('worker', 'worker', 'Fan-out Worker'),
    }
    const edges = {
      e1: edge('e1', 'app', 'db'),
      e2: edge('e2', 'app', 'mq'),
      e3: edge('e3', 'worker', 'mq'),
      e4: edge('e4', 'worker', 'db'),
    }
    expect(assessGraphConstraints(nodes, edges)).toBeNull()
  })

  it('flags worker missing db edge with BE-aligned message', () => {
    const nodes = {
      app: node('app', 'compute'),
      db: node('db', 'database'),
      mq: node('mq', 'message_queue'),
      worker: node('worker', 'worker', 'Fan-out Worker'),
    }
    const edges = {
      e1: edge('e1', 'app', 'db'),
      e2: edge('e2', 'app', 'mq'),
      e3: edge('e3', 'worker', 'mq'),
    }
    expect(assessGraphConstraints(nodes, edges)).toBe(
      'worker "Fan-out Worker" must connect to a db node (add worker -> db edge)',
    )
  })

  it('flags wrong mq → worker direction', () => {
    const nodes = {
      app: node('app', 'compute'),
      db: node('db', 'database'),
      mq: node('mq', 'message_queue'),
      worker: node('worker', 'worker', 'Fan-out Worker'),
    }
    const edges = {
      e1: edge('e1', 'app', 'db'),
      e2: edge('e2', 'worker', 'db'),
      e3: edge('e3', 'mq', 'worker'),
    }
    expect(assessGraphConstraints(nodes, edges)).toContain('mq -> worker')
  })

  it('flags multiple app-server nodes', () => {
    const nodes = {
      a: node('a', 'compute'),
      b: node('b', 'compute'),
      db: node('db', 'database'),
    }
    const edges = {
      e1: edge('e1', 'a', 'db'),
      e2: edge('e2', 'b', 'db'),
    }
    expect(assessGraphConstraints(nodes, edges)).toMatch(/only one app-server/i)
  })

  it('flags multiple worker nodes', () => {
    const nodes = {
      app: node('app', 'compute'),
      db: node('db', 'database'),
      mq: node('mq', 'message_queue'),
      w1: node('w1', 'worker', 'Worker 1'),
      w2: node('w2', 'worker', 'Worker 2'),
    }
    const edges = {
      e1: edge('e1', 'app', 'db'),
      e2: edge('e2', 'app', 'mq'),
      e3: edge('e3', 'w1', 'mq'),
      e4: edge('e4', 'w1', 'db'),
      e5: edge('e5', 'w2', 'mq'),
      e6: edge('e6', 'w2', 'db'),
    }
    expect(assessGraphConstraints(nodes, edges)).toMatch(/only one worker/i)
  })

  it('flags multiple cache nodes (fixed K8s service name)', () => {
    const nodes = {
      app: node('app', 'compute'),
      db: node('db', 'database'),
      c1: node('c1', 'cache', 'Cache 2'),
      c2: node('c2', 'cache', 'Redis'),
    }
    const edges = {
      e1: edge('e1', 'app', 'db'),
      e2: edge('e2', 'app', 'c1'),
      e3: edge('e3', 'app', 'c2'),
    }
    expect(assessGraphConstraints(nodes, edges)).toMatch(/only one cache/i)
  })

  it('flags multiple db nodes', () => {
    const nodes = {
      app: node('app', 'compute'),
      d1: node('d1', 'database'),
      d2: node('d2', 'database'),
    }
    const edges = {
      e1: edge('e1', 'app', 'd1'),
      e2: edge('e2', 'app', 'd2'),
    }
    expect(assessGraphConstraints(nodes, edges)).toMatch(/only one db/i)
  })

  it('allows a worker when work_queue is bound to cache', () => {
    const nodes = {
      app: node('app', 'compute'),
      db: node('db', 'database'),
      cache: node('cache', 'cache', 'Redis'),
      worker: node('worker', 'worker', 'Fan-out Worker'),
    }
    const edges = {
      e1: edge('e1', 'app', 'db'),
      e2: edge('e2', 'app', 'cache'),
      e3: edge('e3', 'worker', 'db'),
      e4: edge('e4', 'worker', 'cache'),
    }
    expect(
      assessGraphConstraints(nodes, edges, { work_queue: 'cache' }),
    ).toBeNull()
  })

  it('still requires a message queue when work_queue is not on the cache', () => {
    const nodes = {
      app: node('app', 'compute'),
      db: node('db', 'database'),
      cache: node('cache', 'cache', 'Redis'),
      worker: node('worker', 'worker', 'Fan-out Worker'),
    }
    const edges = {
      e1: edge('e1', 'app', 'db'),
      e2: edge('e2', 'worker', 'db'),
      e3: edge('e3', 'worker', 'cache'),
    }
    expect(assessGraphConstraints(nodes, edges)).toMatch(/message queue/i)
  })

  it('requires a worker edge to the cache that hosts the work queue', () => {
    const nodes = {
      app: node('app', 'compute'),
      db: node('db', 'database'),
      cache: node('cache', 'cache', 'Redis'),
      worker: node('worker', 'worker', 'Fan-out Worker'),
    }
    const edges = {
      e1: edge('e1', 'app', 'db'),
      e2: edge('e2', 'worker', 'db'),
    }
    expect(
      assessGraphConstraints(nodes, edges, { work_queue: 'cache' }),
    ).toMatch(/hosts the work queue/i)
  })
})

describe('analyzeDeployTopology graph honesty', () => {
  it('surfaces missing worker→db as wholeDesignIssue before create', () => {
    const nodes = {
      app: node('app', 'compute'),
      db: node('db', 'database'),
      mq: node('mq', 'message_queue'),
      worker: node('worker', 'worker', 'Fan-out Worker'),
    }
    const edges = {
      e1: edge('e1', 'app', 'db'),
      e2: edge('e2', 'app', 'mq'),
      e3: edge('e3', 'worker', 'mq'),
    }
    const preflight = analyzeDeployTopology(nodes, edges, true)
    expect(preflight.wholeDesignIssue).toContain('must connect to a db')
  })
})
