import type { CanvasNode } from '../editor-core/stores/canvasStore'

export function defaultConfigForType(
  type: CanvasNode['type']
): Record<string, unknown> {
  switch (type) {
    case 'load_balancer':
      return { algorithm: 'round-robin' }
    case 'compute':
      return { replicas: 1, instanceSize: 'small' }
    case 'database':
      return {
        engine: 'postgresql',
        instanceSize: 'small',
        storageGB: 10,
        maxConnections: 100,
        readReplicas: 0,
        readConsistency: 'leader-only',
      }
    case 'cache':
      return {
        cacheEngine: 'redis',
        maxMemoryMB: 256,
        evictionPolicy: 'allkeys-lru',
        cacheStrategy: 'cache-aside',
      }
    case 'message_queue':
      return { engine: 'rabbitmq', durable: true, partitions: 1 }
    case 'worker':
      return { replicas: 1, instanceSize: 'small' }
    case 'client':
      return {}
    default:
      return {}
  }
}

const TYPE_LABELS: Record<CanvasNode['type'], string> = {
  load_balancer: 'Load Balancer',
  compute: 'App Server',
  database: 'Database',
  cache: 'Cache',
  message_queue: 'Message Queue',
  worker: 'Worker',
  client: 'Traffic Source',
}

export function nextDefaultLabel(
  type: CanvasNode['type'],
  nodes: Record<string, CanvasNode>
): string {
  const base = TYPE_LABELS[type]
  const count = Object.values(nodes).filter((n) => n.type === type).length
  if (count === 0) return base
  return `${base} ${count + 1}`
}

export function createCanvasNode(
  type: CanvasNode['type'],
  position: [number, number, number],
  nodes: Record<string, CanvasNode>
): CanvasNode {
  return {
    id: crypto.randomUUID(),
    type,
    position,
    label: nextDefaultLabel(type, nodes),
    config: defaultConfigForType(type),
    status: 'idle',
  }
}
