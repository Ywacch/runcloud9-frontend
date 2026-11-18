import type { CanvasNode } from '../editor-core/stores/canvasStore'
import {
  defaultProxyResourceProfile,
  redisProfileFromConfig,
} from './cacheProxyResources'
import { isProxyCacheStrategy } from './cacheTopologyStrategy'
import { templateSupportsWriteBehindInterval } from './writeBehindInterval'
import { WRITE_BEHIND_INTERVAL_DEFAULT } from './writeBehindInterval'

/** Same patch shape as InspectorPanel `applyStrategy`. */
export function buildCacheStrategyPatch(
  config: Record<string, unknown>,
  nextStrategy: string,
  templateId: string | null | undefined,
): Partial<CanvasNode['config']> {
  const patch: Partial<CanvasNode['config']> = {
    cacheStrategy: nextStrategy,
    strategy: nextStrategy,
  }
  const proxyInstanceSize = String(config.proxyInstanceSize ?? '').trim()
  const proxyResourceProfile = String(config.proxyResourceProfile ?? '').trim()
  if (isProxyCacheStrategy(nextStrategy)) {
    if (!proxyInstanceSize && !proxyResourceProfile) {
      const proxySize = defaultProxyResourceProfile(redisProfileFromConfig(config))
      patch.proxyInstanceSize = proxySize
      patch.proxyResourceProfile = proxySize
    }
  } else {
    patch.proxyInstanceSize = undefined
    patch.proxyResourceProfile = undefined
  }
  if (
    templateSupportsWriteBehindInterval(templateId) &&
    nextStrategy === 'write-behind' &&
    config.writeBehindIntervalSeconds == null
  ) {
    patch.writeBehindIntervalSeconds = WRITE_BEHIND_INTERVAL_DEFAULT
  }
  return patch
}