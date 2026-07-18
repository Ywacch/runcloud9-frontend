import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'
import {
  REDIS_EVICTION_POLICY_DESCRIPTION,
  type RedisEvictionPolicy,
} from '../lib/redisEvictionPolicy'
import { WRITE_BEHIND_INTERVAL_VALIDATION } from '../lib/writeBehindInterval'
import { CacheNodeInspectorFields } from './InspectorPanel'

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
  topology?: 'proxy' | 'aside' | 'isolated'
  updateConfig?: ReturnType<typeof vi.fn>
}): string {
  const {
    evictionPolicy = 'allkeys-lru',
    cacheStrategy = 'cache-aside',
    templateId = 'url-shortener',
    writeBehindIntervalSeconds,
    topology = 'isolated',
    updateConfig = vi.fn(),
  } = opts

  const config: CanvasNode['config'] = {
    cacheStrategy,
    evictionPolicy,
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
    }),
  )
}

describe('CacheNodeInspectorFields eviction policy copy', () => {
  it.each(['volatile-lru', 'volatile-lfu', 'volatile-random', 'volatile-ttl'] as const)(
    'shows the selected description and volatile callout for %s',
    (policy) => {
      const html = renderCacheInspector({ evictionPolicy: policy })

      expect(html).toContain(`>${REDIS_EVICTION_POLICY_DESCRIPTION[policy]}</p>`)
      expect(html).toContain('This policy can only evict keys that have a TTL.')
    },
  )

  it.each(['noeviction', 'allkeys-lru', 'allkeys-lfu', 'allkeys-random'] as const)(
    'shows the selected description without the volatile callout for %s',
    (policy) => {
      const html = renderCacheInspector({ evictionPolicy: policy })

      expect(html).toContain(`>${REDIS_EVICTION_POLICY_DESCRIPTION[policy]}</p>`)
      expect(html).not.toContain('This policy can only evict keys that have a TTL.')
    },
  )
})

describe('CacheNodeInspectorFields write-behind flush interval', () => {
  it('shows the control for url-shortener write-behind with default 30', () => {
    const html = renderCacheInspector({
      cacheStrategy: 'write-behind',
      templateId: 'url-shortener',
      writeBehindIntervalSeconds: 30,
      topology: 'proxy',
    })

    expect(html).toContain('Write-behind flush interval (seconds)')
    expect(html).toContain('How often the proxy flushes pending writes to the database.')
    expect(html).toContain('id="cache-write-behind-interval"')
    expect(html).toContain('value="30"')
    expect(html).not.toContain(WRITE_BEHIND_INTERVAL_VALIDATION)
  })

  it('hides the control for cache-aside and write-through on url-shortener', () => {
    const aside = renderCacheInspector({
      cacheStrategy: 'cache-aside',
      templateId: 'url-shortener',
      writeBehindIntervalSeconds: 45,
      topology: 'aside',
    })
    expect(aside).not.toContain('Write-behind flush interval (seconds)')
    expect(aside).not.toContain('id="cache-write-behind-interval"')

    const through = renderCacheInspector({
      cacheStrategy: 'write-through',
      templateId: 'url-shortener',
      writeBehindIntervalSeconds: 45,
      topology: 'proxy',
    })
    expect(through).not.toContain('Write-behind flush interval (seconds)')
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
      expect(html).not.toContain('Write-behind flush interval (seconds)')
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
