import type { CanvasNode } from '../../editor-core/stores/canvasStore'

export interface LayoutJobWant {
  nodeId: string
  shared?: boolean
}

export interface LayoutCase {
  id: string
  templateId: string
  nodes: CanvasNode[]
  jobBindings?: Record<string, string>
  want: Record<string, LayoutJobWant>
}

function n(
  id: string,
  type: CanvasNode['type'],
  config: Record<string, unknown> = {},
): CanvasNode {
  return { id, type, position: [0, 0, 0], label: id, config, status: 'idle' }
}

const db = (id = 'db-1') => n(id, 'database', { engine: 'postgresql' })
const redis = (id: string, extra: Record<string, unknown> = {}) =>
  n(id, 'cache', { engine: 'redis', ...extra })
const mq = (id = 'mq-1') => n(id, 'message_queue', { engine: 'rabbitmq' })

/** Job-to-node map for each layout. Members stay empty in design mode. */
export const LAYOUT_MATRIX: LayoutCase[] = [
  {
    id: 'social-feed-wq-rmq',
    templateId: 'social-feed',
    nodes: [db(), redis('cache-1', { cacheStrategy: 'timeline-store' }), mq()],
    jobBindings: { work_queue: 'mq-1' },
    want: {
      main_db: { nodeId: 'db-1' },
      timeline: { nodeId: 'cache-1' },
      work_queue: { nodeId: 'mq-1' },
    },
  },
  {
    id: 'social-feed-wq-share',
    templateId: 'social-feed',
    nodes: [db(), redis('cache-1', { cacheStrategy: 'timeline-store' }), mq()],
    jobBindings: { timeline: 'cache-1', work_queue: 'cache-1' },
    want: {
      main_db: { nodeId: 'db-1' },
      timeline: { nodeId: 'cache-1', shared: true },
      work_queue: { nodeId: 'cache-1', shared: true },
    },
  },
  {
    id: 'social-feed-wq-dedicated',
    templateId: 'social-feed',
    nodes: [db(), redis('cache-tl', { cacheStrategy: 'timeline-store' }), redis('cache-wq'), mq()],
    jobBindings: { timeline: 'cache-tl', work_queue: 'cache-wq' },
    want: {
      main_db: { nodeId: 'db-1' },
      timeline: { nodeId: 'cache-tl' },
      work_queue: { nodeId: 'cache-wq' },
    },
  },
  {
    id: 'social-feed-tl-pg-wq-rmq',
    templateId: 'social-feed',
    nodes: [db(), redis('cache-1', { cacheStrategy: 'timeline-store' }), mq()],
    jobBindings: { timeline: 'db-1', work_queue: 'mq-1' },
    want: {
      main_db: { nodeId: 'db-1', shared: true },
      timeline: { nodeId: 'db-1', shared: true },
      work_queue: { nodeId: 'mq-1' },
    },
  },
  {
    id: 'social-feed-tl-pg-wq-redis',
    templateId: 'social-feed',
    nodes: [db(), redis('cache-tl', { cacheStrategy: 'timeline-store' }), redis('cache-wq')],
    jobBindings: { timeline: 'db-1', work_queue: 'cache-wq' },
    want: {
      main_db: { nodeId: 'db-1', shared: true },
      timeline: { nodeId: 'db-1', shared: true },
      work_queue: { nodeId: 'cache-wq' },
    },
  },
  {
    id: 'ecommerce-wq-rmq',
    templateId: 'ecommerce',
    nodes: [db(), redis('cache-1'), mq()],
    jobBindings: { work_queue: 'mq-1' },
    want: {
      hot_cache: { nodeId: 'cache-1' },
      main_db: { nodeId: 'db-1' },
      work_queue: { nodeId: 'mq-1' },
    },
  },
  {
    id: 'ecommerce-wq-share',
    templateId: 'ecommerce',
    nodes: [db(), redis('cache-1'), mq()],
    jobBindings: { hot_cache: 'cache-1', work_queue: 'cache-1' },
    want: {
      hot_cache: { nodeId: 'cache-1', shared: true },
      main_db: { nodeId: 'db-1' },
      work_queue: { nodeId: 'cache-1', shared: true },
    },
  },
  {
    id: 'ecommerce-wq-dedicated',
    templateId: 'ecommerce',
    nodes: [db(), redis('cache-1'), redis('cache-wq'), mq()],
    jobBindings: { hot_cache: 'cache-1', work_queue: 'cache-wq' },
    want: {
      hot_cache: { nodeId: 'cache-1' },
      main_db: { nodeId: 'db-1' },
      work_queue: { nodeId: 'cache-wq' },
    },
  },
  {
    id: 'ecommerce-hc-mc-wq-rmq',
    templateId: 'ecommerce',
    nodes: [db(), n('cache-1', 'cache', { engine: 'memcached' }), mq()],
    jobBindings: { hot_cache: 'cache-1', work_queue: 'mq-1' },
    want: {
      hot_cache: { nodeId: 'cache-1' },
      main_db: { nodeId: 'db-1' },
      work_queue: { nodeId: 'mq-1' },
    },
  },
  {
    id: 'ecommerce-hc-mc-wq-redis',
    templateId: 'ecommerce',
    nodes: [db(), n('cache-1', 'cache', { engine: 'memcached' }), redis('cache-wq')],
    jobBindings: { hot_cache: 'cache-1', work_queue: 'cache-wq' },
    want: {
      hot_cache: { nodeId: 'cache-1' },
      main_db: { nodeId: 'db-1' },
      work_queue: { nodeId: 'cache-wq' },
    },
  },
  {
    id: 'url-shortener-hc-redis',
    templateId: 'url-shortener',
    nodes: [db(), redis('cache-1')],
    want: {
      hot_cache: { nodeId: 'cache-1' },
      main_db: { nodeId: 'db-1' },
    },
  },
  {
    id: 'url-shortener-hc-mc',
    templateId: 'url-shortener',
    nodes: [db(), n('cache-1', 'cache', { engine: 'memcached' })],
    want: {
      hot_cache: { nodeId: 'cache-1' },
      main_db: { nodeId: 'db-1' },
    },
  },
  {
    id: 'url-shortener-proxy',
    templateId: 'url-shortener',
    nodes: [db(), redis('cache-1', { cacheStrategy: 'read-through' })],
    want: {
      hot_cache: { nodeId: 'cache-1' },
      main_db: { nodeId: 'db-1' },
    },
  },
  {
    id: 'social-feed-pull-hc-redis',
    templateId: 'social-feed-pull',
    nodes: [db(), redis('cache-1')],
    jobBindings: { hot_cache: 'cache-1' },
    want: {
      hot_cache: { nodeId: 'cache-1' },
      main_db: { nodeId: 'db-1' },
    },
  },
  {
    id: 'url-shortener-db-2-replicas',
    templateId: 'url-shortener',
    nodes: [db(), redis('cache-1')],
    want: {
      hot_cache: { nodeId: 'cache-1' },
      main_db: { nodeId: 'db-1' },
    },
  },
]
