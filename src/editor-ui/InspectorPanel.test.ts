import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'
import {
  REDIS_EVICTION_POLICY_DESCRIPTION,
  type RedisEvictionPolicy,
} from '../lib/redisEvictionPolicy'
import { VOLATILE_NO_EXPIRY_WARNING } from '../lib/cacheTtl'
import { WRITE_BEHIND_INTERVAL_VALIDATION } from '../lib/writeBehindInterval'
import { CacheNodeInspectorFields, DatabaseNodeInspectorFields } from './InspectorPanel'

vi.mock('../product/stores/authStore', () => ({
  useAuthStore: (selector: (state: { isPremium: boolean }) => unknown) =>
    selector({ isPremium: true }),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {},
}))

function proxyTopology(cache: CanvasNode): {
  nodes: Record<string, CanvasNode>
  edges: Record<string, CanvasEdge>
} {
  const app: CanvasNode = {
    id: 'app',
    type: 'compute',
    position: [0, 0, 0],
    label: 'App',
    config: {},
    status: 'idle',
  }
  const db: CanvasNode = {
    id: 'db',
    type: 'database',
    position: [2, 0, 0],
    label: 'DB',
    config: {},
    status: 'idle',
  }
  return {
    nodes: { app, cache, db },
    edges: {
      'app-cache': {
        id: 'app-cache',
        sourceId: 'app',
        targetId: 'cache',
        protocol: 'http',
        animated: false,
      },
      'cache-db': {
        id: 'cache-db',
        sourceId: 'cache',
        targetId: 'db',
        protocol: 'http',
        animated: false,
      },
    },
  }
}

function asideTopology(cache: CanvasNode): {
  nodes: Record<string, CanvasNode>
  edges: Record<string, CanvasEdge>
} {
  const app: CanvasNode = {
    id: 'app',
    type: 'compute',
    position: [0, 0, 0],
    label: 'App',
    config: {},
    status: 'idle',
  }
  const db: CanvasNode = {
    id: 'db',
    type: 'database',
    position: [2, 0, 0],
    label: 'DB',
    config: {},
    status: 'idle',
  }
  return {
    nodes: { app, cache, db },
    edges: {
      'app-cache': {
        id: 'app-cache',
        sourceId: 'app',
        targetId: 'cache',
        protocol: 'http',
        animated: false,
      },
      'app-db': {
        id: 'app-db',
        sourceId: 'app',
        targetId: 'db',
        protocol: 'http',
        animated: false,
      },
    },
  }
}

function renderCacheInspector(opts: {
  evictionPolicy?: RedisEvictionPolicy
  cacheStrategy?: string
  templateId?: string | null
  writeBehindIntervalSeconds?: number
  cacheTtlSeconds?: number
  topology?: 'proxy' | 'aside' | 'isolated'
  updateConfig?: ReturnType<typeof vi.fn>
  readOnly?: boolean
}): string {
  const {
    evictionPolicy = 'allkeys-lru',
    cacheStrategy = 'cache-aside',
    templateId = 'url-shortener',
    writeBehindIntervalSeconds,
    cacheTtlSeconds = 300,
    topology = 'isolated',
    updateConfig = vi.fn(),
    readOnly = false,
  } = opts

  const config: CanvasNode['config'] = {
    cacheStrategy,
    evictionPolicy,
    cacheTtlSeconds,
  }
  if (writeBehindIntervalSeconds != null) {
    config.writeBehindIntervalSeconds = writeBehindIntervalSeconds
  }

  const node: CanvasNode = {
    id: 'cache',
    type: 'cache',
    position: [0, 0, 0],
    label: 'Cache',
    config,
    status: 'idle',
  }

  const graph =
    topology === 'proxy'
      ? proxyTopology(node)
      : topology === 'aside'
        ? asideTopology(node)
        : { nodes: { cache: node }, edges: {} }

  return renderToStaticMarkup(
    createElement(CacheNodeInspectorFields, {
      node,
      nodes: graph.nodes,
      edges: graph.edges,
      simulationMode: false,
      updateConfig,
      templateId,
      readOnly,
    }),
  )
}

describe('CacheNodeInspectorFields eviction policy copy', () => {
  it.each(['volatile-lru', 'volatile-lfu', 'volatile-random', 'volatile-ttl'] as const)(
    'shows eviction policy helper without amber warning for %s when TTL is set',
    (policy) => {
      const html = renderCacheInspector({
        evictionPolicy: policy,
        cacheTtlSeconds: 300,
      })

      expect(html).toContain('pcfg-sub')
      expect(html).toContain(REDIS_EVICTION_POLICY_DESCRIPTION[policy])
      expect(html).not.toContain(VOLATILE_NO_EXPIRY_WARNING)
    },
  )

  it.each(['volatile-lru', 'volatile-lfu', 'volatile-random', 'volatile-ttl'] as const)(
    'shows amber warning for %s when No expiry is enabled',
    (policy) => {
      const html = renderCacheInspector({
        evictionPolicy: policy,
        cacheTtlSeconds: 0,
      })

      expect(html).toContain(VOLATILE_NO_EXPIRY_WARNING)
    },
  )

  it.each(['noeviction', 'allkeys-lru', 'allkeys-lfu', 'allkeys-random'] as const)(
    'shows eviction policy helper without the volatile warning for %s',
    (policy) => {
      const html = renderCacheInspector({
        evictionPolicy: policy,
        cacheTtlSeconds: 0,
      })

      expect(html).toContain('pcfg-sub')
      expect(html).toContain(REDIS_EVICTION_POLICY_DESCRIPTION[policy])
      expect(html).not.toContain(VOLATILE_NO_EXPIRY_WARNING)
    },
  )
})

describe('CacheNodeInspectorFields cache TTL', () => {
  it('renders Default TTL with timed value for url-shortener default', () => {
    const html = renderCacheInspector({
      templateId: 'url-shortener',
      cacheTtlSeconds: 300,
    })
    expect(html).toContain('Default TTL')
    expect(html).toContain('id="cache-ttl"')
    expect(html).toContain('value="300"')
    expect(html).toContain('No expiry')
    expect(html).not.toContain('checked=""')
  })

  it('hides the seconds input when No expiry is enabled', () => {
    const html = renderCacheInspector({
      templateId: 'social-feed',
      cacheTtlSeconds: 0,
    })
    expect(html).toContain('No expiry')
    expect(html).toContain('checked=""')
    expect(html).not.toContain('id="cache-ttl"')
  })

  it('reads ecommerce and social-feed stored values', () => {
    expect(
      renderCacheInspector({
        templateId: 'ecommerce',
        cacheTtlSeconds: 60,
      }),
    ).toContain('value="60"')

    expect(
      renderCacheInspector({
        templateId: 'social-feed',
        cacheTtlSeconds: 0,
      }),
    ).toContain('checked=""')
  })
})

describe('CacheNodeInspectorFields write-behind flush interval', () => {
  it('shows the control for url-shortener write-behind with default 30', () => {
    const html = renderCacheInspector({
      cacheStrategy: 'write-behind',
      templateId: 'url-shortener',
      writeBehindIntervalSeconds: 30,
      topology: 'proxy',
    })

    expect(html).toContain('Flush interval')
    expect(html).toContain('How often the proxy flushes writes to the database.')
    expect(html).toContain('id="cache-write-behind-interval"')
    expect(html).toContain('value="30"')
    expect(html).not.toContain(WRITE_BEHIND_INTERVAL_VALIDATION)
    expect(html).toContain('Read-through refills Redis on miss.')
  })

  it('hides the control for cache-aside and write-through on url-shortener', () => {
    const aside = renderCacheInspector({
      cacheStrategy: 'cache-aside',
      templateId: 'url-shortener',
      writeBehindIntervalSeconds: 45,
      topology: 'aside',
    })
    expect(aside).not.toContain('Flush interval')
    expect(aside).not.toContain('id="cache-write-behind-interval"')

    const through = renderCacheInspector({
      cacheStrategy: 'write-through',
      templateId: 'url-shortener',
      writeBehindIntervalSeconds: 45,
      topology: 'proxy',
    })
    expect(through).not.toContain('Flush interval')
    expect(through).not.toContain('id="cache-write-behind-interval"')
  })

  it('hides the control for ecommerce and social-feed even with stale write-behind', () => {
    for (const templateId of ['ecommerce', 'social-feed'] as const) {
      const html = renderCacheInspector({
        cacheStrategy: 'write-behind',
        templateId,
        writeBehindIntervalSeconds: 45,
        topology: 'proxy',
      })
      expect(html).not.toContain('Flush interval')
    }
  })

  it('preserves a saved interval value when rendered under write-behind', () => {
    const html = renderCacheInspector({
      cacheStrategy: 'write-behind',
      templateId: 'url-shortener',
      writeBehindIntervalSeconds: 120,
      topology: 'proxy',
    })
    expect(html).toContain('value="120"')
  })
})

describe('CacheNodeInspectorFields readOnly (live Config)', () => {
  it('shows full cache fields with controls disabled', () => {
    const html = renderCacheInspector({
      cacheStrategy: 'write-behind',
      templateId: 'url-shortener',
      writeBehindIntervalSeconds: 30,
      cacheTtlSeconds: 300,
      evictionPolicy: 'volatile-lru',
      topology: 'proxy',
      readOnly: true,
    })

    expect(html).toContain('Strategy')
    expect(html).toContain('write-behind')
    expect(html).toContain('Default TTL')
    expect(html).toContain('id="cache-ttl"')
    expect(html).toContain('Eviction policy')
    expect(html).toContain(REDIS_EVICTION_POLICY_DESCRIPTION['volatile-lru'])
    expect(html).toContain('Flush interval')
    expect(html).toContain('Resource profile')
    expect(html).toContain('Proxy profile')
    expect(html).toContain('disabled=""')
    expect(html).not.toContain('(fix wiring)')
  })
})

function renderDatabaseInspector(readReplicas: number): string {
  const node: CanvasNode = {
    id: 'db',
    type: 'database',
    position: [0, 0, 0],
    label: 'DB',
    config: { readReplicas },
    status: 'idle',
  }

  return renderToStaticMarkup(
    createElement(DatabaseNodeInspectorFields, {
      node,
      nodes: { db: node },
      edges: {},
      updateConfig: vi.fn(),
    }),
  )
}

describe('DatabaseNodeInspectorFields applicable knobs', () => {
  it('hides replication and read consistency when readReplicas is 0', () => {
    const html = renderDatabaseInspector(0)

    expect(html).toContain('Read replicas')
    expect(html).not.toContain('id="db-replication-mode"')
    expect(html).not.toContain('id="db-read-consistency"')
  })

  it('shows replication and read consistency when readReplicas is at least 1', () => {
    const html = renderDatabaseInspector(1)

    expect(html).toContain('Read replicas')
    expect(html).toContain('id="db-replication-mode"')
    expect(html).toContain('id="db-read-consistency"')
  })
})
