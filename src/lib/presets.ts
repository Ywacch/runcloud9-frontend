import type { CanvasSnapshot } from '../store/canvasStore'

const cacheCfg = {
  cacheEngine: 'redis',
  maxMemoryMB: 256,
  evictionPolicy: 'allkeys-lru',
  cacheStrategy: 'cache-aside',
} as const

/** Canonical url-shortener topology (4 nodes). */
export function presetUrlShortener(): CanvasSnapshot {
  return {
    version: '1.0',
    templateId: 'url-shortener',
    nodes: [
      {
        id: 'lb-1',
        type: 'load_balancer',
        position: [-2, 0.3, 0],
        label: 'Load Balancer',
        config: { algorithm: 'round-robin' },
        status: 'idle',
      },
      {
        id: 'app-1',
        type: 'compute',
        position: [0, 0.3, 0],
        label: 'App Server',
        config: { replicas: 1, instanceSize: 'small' },
        status: 'idle',
      },
      {
        id: 'db-1',
        type: 'database',
        position: [2, 0.3, -2],
        label: 'PostgreSQL',
        config: {
          engine: 'postgresql',
          storageGB: 10,
          maxConnections: 100,
        },
        status: 'idle',
      },
      {
        id: 'cache-1',
        type: 'cache',
        position: [2, 0.3, 2],
        label: 'Redis',
        config: { ...cacheCfg },
        status: 'idle',
      },
    ],
    edges: [
      {
        id: 'e1',
        sourceId: 'lb-1',
        targetId: 'app-1',
        protocol: 'http',
        animated: false,
      },
      {
        id: 'e2',
        sourceId: 'app-1',
        targetId: 'db-1',
        protocol: 'tcp',
        animated: false,
      },
      {
        id: 'e3',
        sourceId: 'app-1',
        targetId: 'cache-1',
        protocol: 'tcp',
        animated: false,
      },
    ],
    exportedAt: new Date().toISOString(),
  }
}

/** LB + 2 app servers + DB + cache. */
export function presetEcommerce(): CanvasSnapshot {
  return {
    version: '1.0',
    templateId: 'ecommerce',
    nodes: [
      {
        id: 'lb-1',
        type: 'load_balancer',
        position: [-3, 0.3, 0],
        label: 'Load Balancer',
        config: { algorithm: 'round-robin' },
        status: 'idle',
      },
      {
        id: 'app-1',
        type: 'compute',
        position: [0, 0.3, -2],
        label: 'App Server 1',
        config: { replicas: 1, instanceSize: 'small' },
        status: 'idle',
      },
      {
        id: 'app-2',
        type: 'compute',
        position: [0, 0.3, 2],
        label: 'App Server 2',
        config: { replicas: 1, instanceSize: 'small' },
        status: 'idle',
      },
      {
        id: 'db-1',
        type: 'database',
        position: [3, 0.3, -2],
        label: 'PostgreSQL',
        config: {
          engine: 'postgresql',
          storageGB: 10,
          maxConnections: 100,
        },
        status: 'idle',
      },
      {
        id: 'cache-1',
        type: 'cache',
        position: [3, 0.3, 2],
        label: 'Redis',
        config: { ...cacheCfg },
        status: 'idle',
      },
    ],
    edges: [
      {
        id: 'e1',
        sourceId: 'lb-1',
        targetId: 'app-1',
        protocol: 'http',
        animated: false,
      },
      {
        id: 'e2',
        sourceId: 'lb-1',
        targetId: 'app-2',
        protocol: 'http',
        animated: false,
      },
      {
        id: 'e3',
        sourceId: 'app-1',
        targetId: 'db-1',
        protocol: 'tcp',
        animated: false,
      },
      {
        id: 'e4',
        sourceId: 'app-2',
        targetId: 'db-1',
        protocol: 'tcp',
        animated: false,
      },
      {
        id: 'e5',
        sourceId: 'app-1',
        targetId: 'cache-1',
        protocol: 'tcp',
        animated: false,
      },
      {
        id: 'e6',
        sourceId: 'app-2',
        targetId: 'cache-1',
        protocol: 'tcp',
        animated: false,
      },
    ],
    exportedAt: new Date().toISOString(),
  }
}

/** LB + feed/fan-out apps + MQ → worker → DB path + cache (fan-out topology). */
export function presetSocialFeed(): CanvasSnapshot {
  return {
    version: '1.0',
    templateId: 'social-feed',
    nodes: [
      {
        id: 'lb-1',
        type: 'load_balancer',
        position: [-3, 0.3, 0],
        label: 'Load Balancer',
        config: { algorithm: 'round-robin' },
        status: 'idle',
      },
      {
        id: 'app-1',
        type: 'compute',
        position: [0, 0.3, -2],
        label: 'Feed Service',
        config: { replicas: 1, instanceSize: 'small' },
        status: 'idle',
      },
      {
        id: 'app-2',
        type: 'compute',
        position: [0, 0.3, 2],
        label: 'Fan-out Service',
        config: { replicas: 1, instanceSize: 'small' },
        status: 'idle',
      },
      {
        id: 'mq-1',
        type: 'message_queue',
        position: [1, 0.3, -2],
        label: 'Message Queue',
        config: { engine: 'rabbitmq', durable: true },
        status: 'idle',
      },
      {
        id: 'worker-1',
        type: 'worker',
        position: [2, 0.3, -2],
        label: 'Worker',
        config: { replicas: 1, instanceSize: 'small' },
        status: 'idle',
      },
      {
        id: 'db-1',
        type: 'database',
        position: [3, 0.3, -2],
        label: 'PostgreSQL',
        config: {
          engine: 'postgresql',
          storageGB: 10,
          maxConnections: 100,
        },
        status: 'idle',
      },
      {
        id: 'cache-1',
        type: 'cache',
        position: [3, 0.3, 2],
        label: 'Redis',
        config: { ...cacheCfg },
        status: 'idle',
      },
    ],
    edges: [
      {
        id: 'e1',
        sourceId: 'lb-1',
        targetId: 'app-1',
        protocol: 'http',
        animated: false,
      },
      {
        id: 'e2',
        sourceId: 'lb-1',
        targetId: 'app-2',
        protocol: 'http',
        animated: false,
      },
      {
        id: 'e-app-mq',
        sourceId: 'app-1',
        targetId: 'mq-1',
        protocol: 'http',
        animated: false,
      },
      {
        id: 'e-mq-worker',
        sourceId: 'mq-1',
        targetId: 'worker-1',
        protocol: 'tcp',
        animated: false,
      },
      {
        id: 'e-worker-db',
        sourceId: 'worker-1',
        targetId: 'db-1',
        protocol: 'tcp',
        animated: false,
      },
      {
        id: 'e4',
        sourceId: 'app-2',
        targetId: 'db-1',
        protocol: 'tcp',
        animated: false,
      },
      {
        id: 'e5',
        sourceId: 'app-1',
        targetId: 'cache-1',
        protocol: 'tcp',
        animated: false,
      },
      {
        id: 'e6',
        sourceId: 'app-2',
        targetId: 'cache-1',
        protocol: 'tcp',
        animated: false,
      },
    ],
    exportedAt: new Date().toISOString(),
  }
}
