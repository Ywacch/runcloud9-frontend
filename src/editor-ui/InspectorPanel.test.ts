import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import {
  REDIS_EVICTION_POLICY_DESCRIPTION,
  type RedisEvictionPolicy,
} from '../lib/redisEvictionPolicy'
import { CacheNodeInspectorFields } from './InspectorPanel'

vi.mock('../product/stores/authStore', () => ({
  useAuthStore: (selector: (state: { isPremium: boolean }) => unknown) =>
    selector({ isPremium: true }),
}))

function renderCacheInspector(evictionPolicy: RedisEvictionPolicy): string {
  const node: CanvasNode = {
    id: 'cache',
    type: 'cache',
    position: [0, 0, 0],
    label: 'Cache',
    config: { cacheStrategy: 'cache-aside', evictionPolicy },
    status: 'idle',
  }

  return renderToStaticMarkup(
    createElement(CacheNodeInspectorFields, {
      node,
      nodes: { cache: node },
      edges: {},
      simulationMode: false,
      updateConfig: vi.fn(),
    }),
  )
}

describe('CacheNodeInspectorFields eviction policy copy', () => {
  it.each(['volatile-lru', 'volatile-lfu', 'volatile-random', 'volatile-ttl'] as const)(
    'shows the selected description and volatile callout for %s',
    (policy) => {
      const html = renderCacheInspector(policy)

      expect(html).toContain(`>${REDIS_EVICTION_POLICY_DESCRIPTION[policy]}</p>`)
      expect(html).toContain('This policy can only evict keys that have a TTL.')
    },
  )

  it.each(['noeviction', 'allkeys-lru', 'allkeys-lfu', 'allkeys-random'] as const)(
    'shows the selected description without the volatile callout for %s',
    (policy) => {
      const html = renderCacheInspector(policy)

      expect(html).toContain(`>${REDIS_EVICTION_POLICY_DESCRIPTION[policy]}</p>`)
      expect(html).not.toContain('This policy can only evict keys that have a TTL.')
    },
  )
})
