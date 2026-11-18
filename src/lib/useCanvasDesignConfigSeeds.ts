import { useEffect } from 'react'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { defaultCacheTtlSecondsForTemplate } from './cacheTtl'
import { getAvailableCacheStrategies } from './cacheTopologyStrategy'
import {
  defaultProxyResourceProfile,
  redisProfileFromConfig,
} from './cacheProxyResources'
import { isProxyCacheStrategy } from './cacheTopologyStrategy'
import { filterStrategiesForVariation } from './variationTopologyLock'
import { templateSupportsWriteBehindInterval } from './writeBehindInterval'
import { WRITE_BEHIND_INTERVAL_DEFAULT } from './writeBehindInterval'
import { useAuthStore } from '../product/stores/authStore'
import {
  resolveEffectiveTier,
  topologyLimitsForTier,
} from './userTier'
import { commitCanvasNodeConfig } from './canvasDesignConfigCommit'
import { buildCacheStrategyPatch } from './cacheStrategyDesignPatch'

/** One-shot design fixes that InspectorPanel applied on mount (strategy, proxy, TTL seeds). */
export function useCanvasDesignConfigSeeds(
  node: CanvasNode | null,
  templateId: string | null | undefined,
  loadedVariationId: string | null,
  active: boolean,
) {
  const currentUser = useAuthStore((s) => s.currentUser)
  const userRecord = useAuthStore((s) => s.userRecord)

  useEffect(() => {
    if (!active || !node || node.type !== 'cache') return
    const st = useCanvasStore.getState()
    const freshNode = st.nodes[node.id]
    if (!freshNode) return
    const c = freshNode.config
    const strategy = String(c.cacheStrategy ?? c.strategy ?? 'cache-aside')
    const allowProxyStrategies =
      currentUser?.limits.allowProxyCache ??
      topologyLimitsForTier(resolveEffectiveTier(userRecord)).allowProxyCache
    const available = filterStrategiesForVariation(
      getAvailableCacheStrategies(node.id, st.nodes, st.edges, {
        allowProxyStrategies,
      }),
      loadedVariationId,
    )
    const patch: Partial<CanvasNode['config']> = {}

    if (strategy === 'read-through') {
      Object.assign(patch, buildCacheStrategyPatch(c, 'write-through', templateId))
    } else if (available.length > 0 && !available.includes(strategy)) {
      Object.assign(patch, buildCacheStrategyPatch(c, available[0]!, templateId))
    }

    const mergedStrategy = String(
      patch.strategy ?? patch.cacheStrategy ?? strategy,
    )
    if (
      isProxyCacheStrategy(mergedStrategy) &&
      !String(c.proxyInstanceSize ?? '').trim() &&
      !String(c.proxyResourceProfile ?? '').trim()
    ) {
      const proxySize = defaultProxyResourceProfile(redisProfileFromConfig(c))
      patch.proxyInstanceSize = proxySize
      patch.proxyResourceProfile = proxySize
    }

    if (
      templateSupportsWriteBehindInterval(templateId) &&
      mergedStrategy === 'write-behind' &&
      c.writeBehindIntervalSeconds == null
    ) {
      patch.writeBehindIntervalSeconds = WRITE_BEHIND_INTERVAL_DEFAULT
    }

    const templateTtlDefault = defaultCacheTtlSecondsForTemplate(templateId)
    if (c.cacheTtlSeconds == null && templateTtlDefault != null) {
      patch.cacheTtlSeconds = templateTtlDefault
    }

    if (Object.keys(patch).length === 0) return
    commitCanvasNodeConfig(node.id, patch)
  }, [
    active,
    currentUser?.limits.allowProxyCache,
    loadedVariationId,
    node?.id,
    node?.type,
    templateId,
    userRecord,
  ])
}