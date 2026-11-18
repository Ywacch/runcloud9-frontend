import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useAuthStore } from '../product/stores/authStore'
import { buildCacheStrategyPatch } from './cacheStrategyDesignPatch'
import { maxAppServerReplicasForUser } from './userTier'
import {
  autoscaleFromConfig,
  clampAutoscaleCpuTarget,
  clampAutoscaleMax,
  clampAutoscaleMin,
  defaultAutoscale,
} from './autoscaleConfig'
import { syncAutoLoadBalancerForReplicas } from './ensureLoadBalancerForReplicas'
import { normalizeInstanceSize, normalizeInstanceSizes } from './instanceSizes'
import {
  clampAppServerReplicas,
  clampReadReplicas,
  clampWorkerReplicas,
} from './replicaConfig'

export type CanvasDesignLimits = {
  maxAppReplicas: number
}

function enrichAutoscale(
  raw: unknown,
  maxAppReplicas: number,
): CanvasNode['config']['autoscale'] | undefined {
  if (raw === undefined) return undefined
  if (raw == null) return undefined
  const ac = autoscaleFromConfig(raw) ?? defaultAutoscale(maxAppReplicas)
  const max = clampAutoscaleMax(ac.max, ac.min, maxAppReplicas)
  const min = clampAutoscaleMin(ac.min, max)
  return {
    min,
    max,
    targetCPUPercent: clampAutoscaleCpuTarget(ac.targetCPUPercent),
  }
}

function horizontalSizeCount(
  node: CanvasNode,
  config: Record<string, unknown>,
  limits: CanvasDesignLimits,
): number {
  const ac = autoscaleFromConfig(config.autoscale)
  if (node.type === 'database') {
    return 1 + clampReadReplicas(config.readReplicas ?? 0)
  }
  const replicas =
    node.type === 'worker'
      ? clampWorkerReplicas(config.replicas ?? 1, limits.maxAppReplicas)
      : clampAppServerReplicas(config.replicas ?? 1, limits.maxAppReplicas)
  return ac ? ac.max : replicas
}

/** Mirror InspectorPanel patches so deploy, budget, SVG, and auto-LB stay in sync. */
export function enrichCanvasDesignPatch(
  node: CanvasNode,
  patch: Partial<CanvasNode['config']>,
  limits: CanvasDesignLimits,
): Partial<CanvasNode['config']> {
  const merged = { ...node.config, ...patch }
  const out: Partial<CanvasNode['config']> = { ...patch }

  if ('autoscale' in patch && (node.type === 'compute' || node.type === 'worker')) {
    out.autoscale = enrichAutoscale(patch.autoscale, limits.maxAppReplicas)
  }

  if (
    node.type === 'compute' ||
    node.type === 'worker' ||
    node.type === 'database'
  ) {
    const touched =
      'replicas' in patch ||
      'readReplicas' in patch ||
      'autoscale' in patch ||
      'instanceSize' in patch ||
      'resourceProfile' in patch ||
      'instanceSizes' in patch

    if (touched) {
      if (node.type === 'compute') {
        out.replicas = clampAppServerReplicas(
          merged.replicas ?? 1,
          limits.maxAppReplicas,
        )
        const count = horizontalSizeCount(
          node,
          { ...merged, ...out, replicas: out.replicas },
          limits,
        )
        if ('instanceSize' in patch || 'resourceProfile' in patch) {
          const size = normalizeInstanceSize(
            patch.instanceSize ?? patch.resourceProfile ?? merged.instanceSize,
          )
          out.instanceSize = size
          out.resourceProfile = size
          out.instanceSizes = Array.from({ length: count }, () => size)
        } else if ('instanceSizes' in patch && Array.isArray(patch.instanceSizes)) {
          const sizes = normalizeInstanceSizes(
            { ...merged, instanceSizes: patch.instanceSizes },
            count,
          )
          out.instanceSizes = sizes
          out.instanceSize = sizes[0]
        } else {
          const sizes = normalizeInstanceSizes(
            { ...merged, ...out },
            count,
          )
          out.instanceSizes = sizes
          out.instanceSize = sizes[0]
        }
        return out
      }

      if (node.type === 'worker') {
        out.replicas = clampWorkerReplicas(
          merged.replicas ?? 1,
          limits.maxAppReplicas,
        )
        const count = horizontalSizeCount(
          node,
          { ...merged, ...out },
          limits,
        )
        if ('instanceSize' in patch || 'resourceProfile' in patch) {
          const size = normalizeInstanceSize(
            patch.instanceSize ?? patch.resourceProfile ?? merged.instanceSize,
          )
          out.instanceSize = size
          out.resourceProfile = size
          out.instanceSizes = Array.from({ length: count }, () => size)
        } else if ('instanceSizes' in patch && Array.isArray(patch.instanceSizes)) {
          const sizes = normalizeInstanceSizes(
            { ...merged, instanceSizes: patch.instanceSizes },
            count,
          )
          out.instanceSizes = sizes
          out.instanceSize = sizes[0]
        } else {
          const sizes = normalizeInstanceSizes({ ...merged, ...out }, count)
          out.instanceSizes = sizes
          out.instanceSize = sizes[0]
        }
        return out
      }

      if (node.type === 'database') {
        out.readReplicas = clampReadReplicas(merged.readReplicas ?? 0)
        if (out.readReplicas === 0) {
          out.replicationMode = 'async'
        }
        const count = 1 + (out.readReplicas as number)
        if ('instanceSize' in patch || 'resourceProfile' in patch) {
          const size = normalizeInstanceSize(
            patch.instanceSize ?? patch.resourceProfile ?? merged.instanceSize,
          )
          out.instanceSize = size
          out.resourceProfile = size
          out.instanceSizes = Array.from({ length: count }, () => size)
        } else if ('instanceSizes' in patch && Array.isArray(patch.instanceSizes)) {
          const sizes = normalizeInstanceSizes(
            { ...merged, instanceSizes: patch.instanceSizes },
            count,
          )
          out.instanceSizes = sizes
          out.instanceSize = sizes[0]
        } else {
          const sizes = normalizeInstanceSizes({ ...merged, ...out }, count)
          out.instanceSizes = sizes
          out.instanceSize = sizes[0]
        }
        return out
      }
    }
  }

  if (node.type === 'cache') {
    if ('cacheStrategy' in patch || 'strategy' in patch) {
      const next = String(
        patch.cacheStrategy ?? patch.strategy ?? merged.cacheStrategy ?? merged.strategy,
      )
      const st = useCanvasStore.getState()
      const templateId = st.snapshotTemplateId
      return {
        ...patch,
        ...buildCacheStrategyPatch(merged, next, templateId),
      }
    }
  }

  if (node.type === 'worker') {
    if ('workerPrefetch' in patch && (patch.workerPrefetch == null || patch.workerPrefetch === 0)) {
      out.workerPrefetch = undefined
    }
    if (
      'workerConcurrency' in patch &&
      (patch.workerConcurrency == null || patch.workerConcurrency === 0)
    ) {
      out.workerConcurrency = undefined
    }
  }

  if ('instanceSize' in patch || 'resourceProfile' in patch) {
    const size = normalizeInstanceSize(
      patch.instanceSize ?? patch.resourceProfile ?? merged.instanceSize,
    )
    out.instanceSize = size
    out.resourceProfile = size
    if (!('instanceSizes' in patch)) {
      out.instanceSizes = [size]
    }
  }

  return out
}

export function resolveCanvasDesignLimits(): CanvasDesignLimits {
  const currentUser = useAuthStore.getState().currentUser
  const userRecord = useAuthStore.getState().userRecord
  return {
    maxAppReplicas:
      currentUser?.limits.maxAppServerReplicas ??
      maxAppServerReplicasForUser(userRecord),
  }
}

export function commitCanvasNodeConfig(
  nodeId: string,
  patch: Partial<CanvasNode['config']>,
): void {
  commitCanvasDesignConfig(nodeId, patch, resolveCanvasDesignLimits())
}

function shouldSyncAutoLoadBalancer(
  node: CanvasNode,
  patch: Partial<CanvasNode['config']>,
): boolean {
  if (node.type !== 'compute') return false
  return 'replicas' in patch || 'autoscale' in patch
}

export function commitCanvasDesignConfig(
  nodeId: string,
  patch: Partial<CanvasNode['config']>,
  limits: CanvasDesignLimits,
): void {
  const st = useCanvasStore.getState()
  const node = st.nodes[nodeId]
  if (!node) return
  const enriched = enrichCanvasDesignPatch(node, patch, limits)
  if (Object.keys(enriched).length === 0) return
  st.updateNodeConfig(nodeId, enriched)
  if (shouldSyncAutoLoadBalancer(node, patch)) {
    syncAutoLoadBalancerForReplicas()
  }
}