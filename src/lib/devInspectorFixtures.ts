import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { useLogStore, type RawLogLine } from '../editor-core/stores/logStore'
import { canvasToBackend } from './typeMapping'
import type {
  CacheStatsResult,
  ColumnInfo,
  IndexInfo,
  KeyInfo,
  KeyScanResult,
  KeyValue,
  PeekResult,
  QueueInfo,
  RowsResult,
  TableInfo,
} from './introspectApi'

/** Synthetic deployment id — introspect + data browsers use fixture responses in DEV. */
export const DEV_INSPECTOR_DEPLOYMENT_ID = '__dev_inspector_preview__'

export function isDevInspectorDeployment(
  deploymentId: string | null | undefined,
): boolean {
  return import.meta.env.DEV && deploymentId === DEV_INSPECTOR_DEPLOYMENT_ID
}

export function devInspectorDeploymentId(
  liveMode: boolean,
  devPreview: boolean,
  deploymentId: string | null,
): string | null {
  if (liveMode && deploymentId) return deploymentId
  if (devPreview) return DEV_INSPECTOR_DEPLOYMENT_ID
  return null
}

const URL_ROWS: Record<string, unknown>[] = [
  { code: 'abc12', url: 'https://example.com/docs', created_at: '2026-03-18T10:12:04Z' },
  { code: 'x9k2p', url: 'https://example.com/pricing', created_at: '2026-03-18T10:14:22Z' },
  { code: 'm7n4q', url: 'https://example.com/blog/cache-aside', created_at: '2026-03-18T10:18:51Z' },
]

const URL_COLUMNS: ColumnInfo[] = [
  { name: 'code', dataType: 'varchar(8)', nullable: false, isPrimaryKey: true },
  { name: 'url', dataType: 'text', nullable: false, isPrimaryKey: false },
  { name: 'created_at', dataType: 'timestamptz', nullable: false, isPrimaryKey: false },
]

const URL_INDEXES: IndexInfo[] = [
  {
    name: 'urls_pkey',
    table: 'urls',
    columns: ['code'],
    unique: true,
    primary: true,
    definition: 'CREATE UNIQUE INDEX urls_pkey ON urls (code)',
  },
]

const CACHE_KEYS: KeyInfo[] = [
  { key: 'url:abc12', type: 'string', ttl: 3600, memory: 96 },
  { key: 'url:x9k2p', type: 'string', ttl: 3600, memory: 104 },
  { key: 'url:m7n4q', type: 'string', ttl: 3600, memory: 112 },
  { key: 'url:seed42', type: 'string', ttl: -1, memory: 88 },
]

const MQ_QUEUES: QueueInfo[] = [
  { name: 'orders', messages: 42, consumers: 1, available: true },
  { name: 'orders.dlq', messages: 0, consumers: 0, available: true },
]

function isoOffset(secondsAgo: number): string {
  return new Date(Date.now() - secondsAgo * 1000).toISOString()
}

export function buildDevInspectorLogs(nodes: Record<string, CanvasNode>): RawLogLine[] {
  const lines: RawLogLine[] = []
  for (const node of Object.values(nodes)) {
    const component = canvasToBackend[node.type]
    if (!component || component === 'client') continue
    const pod = `${node.id}-roll-a`
    if (component === 'app-server') {
      lines.push(
        {
          timestamp: isoOffset(48),
          component,
          pod,
          level: 'info',
          message: 'GET /r/abc12 200 4.2ms',
          fields: { method: 'GET', path: '/r/abc12', status: 200, duration_ms: 4.2 },
        },
        {
          timestamp: isoOffset(32),
          component,
          pod,
          level: 'info',
          message: 'cache hit url:abc12',
          fields: { cache: 'hit', key: 'url:abc12' },
        },
        {
          timestamp: isoOffset(18),
          component,
          pod,
          level: 'warn',
          message: 'cache miss url:seed99 — querying postgres',
          fields: { cache: 'miss', key: 'url:seed99' },
        },
      )
    } else if (component === 'db') {
      lines.push(
        {
          timestamp: isoOffset(40),
          component,
          pod: 'postgres-0',
          level: 'info',
          message: 'duration: 2.1 ms  statement: SELECT url FROM urls WHERE code = $1',
        },
        {
          timestamp: isoOffset(22),
          component,
          pod: 'postgres-0',
          level: 'info',
          message: 'checkpoint complete: wrote 24 buffers (0.2%)',
        },
      )
    } else if (component === 'cache') {
      lines.push(
        {
          timestamp: isoOffset(36),
          component,
          pod: 'redis-0',
          level: 'info',
          message: 'Accepted 1284 keys in keyspace',
        },
        {
          timestamp: isoOffset(14),
          component,
          pod: 'redis-0',
          level: 'debug',
          message: 'GET url:abc12',
        },
      )
    } else if (component === 'lb') {
      lines.push({
        timestamp: isoOffset(28),
        component,
        pod: 'nginx-0',
        level: 'info',
        message: 'upstream app-server-roll-a: 120 rps, 0 errors',
      })
    } else if (component === 'mq') {
      lines.push({
        timestamp: isoOffset(26),
        component,
        pod: 'rabbitmq-0',
        level: 'info',
        message: 'queue orders depth=42 consumers=1',
      })
    } else if (component === 'worker') {
      lines.push({
        timestamp: isoOffset(24),
        component,
        pod,
        level: 'info',
        message: 'processed order job in 38ms',
      })
    }
  }
  return lines.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

let devLogsSeeded = false

export function seedDevInspectorLogs(nodes: Record<string, CanvasNode>): void {
  if (!import.meta.env.DEV || devLogsSeeded) return
  const { addBatch, logs } = useLogStore.getState()
  if (logs.length > 0) {
    devLogsSeeded = true
    return
  }
  const batch = buildDevInspectorLogs(nodes)
  if (batch.length === 0) return
  addBatch(batch)
  devLogsSeeded = true
}

export function resetDevInspectorLogSeed(): void {
  devLogsSeeded = false
}

export function devIntrospectFixture(
  component: string,
  path: string,
): unknown | null {
  if (!import.meta.env.DEV) return null

  if (path === 'capabilities') {
    return { capabilities: ['tables', 'rows', 'schema', 'indexes', 'keys', 'stats', 'queues', 'peek'] }
  }

  if (component === 'db') {
    if (path === 'tables' || path.startsWith('tables?')) {
      return [{ name: 'urls', rowCount: URL_ROWS.length }] satisfies TableInfo[]
    }
    if (path.startsWith('schema/')) {
      return URL_COLUMNS
    }
    if (path.startsWith('rows/')) {
      const page = 1
      return {
        columns: ['code', 'url', 'created_at'],
        rows: URL_ROWS,
        total: URL_ROWS.length,
        page,
        limit: 50,
      } satisfies RowsResult
    }
    if (path === 'indexes' || path.startsWith('indexes?')) {
      return URL_INDEXES
    }
  }

  if (component === 'cache') {
    if (path === 'stats') {
      return { keyCount: CACHE_KEYS.length } satisfies CacheStatsResult
    }
    if (path.startsWith('keys?')) {
      return {
        keys: CACHE_KEYS,
        cursor: 0,
        keyCount: CACHE_KEYS.length,
      } satisfies KeyScanResult
    }
    if (path.startsWith('key/')) {
      const key = decodeURIComponent(path.slice('key/'.length))
      const row = CACHE_KEYS.find((k) => k.key === key) ?? CACHE_KEYS[0]
      return {
        key: row.key,
        type: row.type,
        value: row.key === 'url:abc12' ? 'https://example.com/docs' : 'https://example.com/pricing',
        ttl: row.ttl,
      } satisfies KeyValue
    }
  }

  if (component === 'mq') {
    if (path === 'queues') {
      return MQ_QUEUES
    }
    if (path.startsWith('peek/')) {
      const queue = decodeURIComponent(path.slice('peek/'.length))
      return {
        queue,
        empty: queue === 'orders.dlq',
        body: queue === 'orders' ? '{"orderId":"ord_1042","sku":"SKU-42"}' : undefined,
        contentType: 'application/json',
        requeued: false,
      } satisfies PeekResult
    }
  }

  return null
}

/** Fixed key count for cache metrics section when API is not deployed. */
export const DEV_INSPECTOR_CACHE_KEY_COUNT = CACHE_KEYS.length
