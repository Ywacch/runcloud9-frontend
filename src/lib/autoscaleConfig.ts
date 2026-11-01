import {
  APP_SERVER_REPLICA_MAX,
  APP_SERVER_REPLICA_MIN,
  clampAppServerReplicas,
} from './replicaConfig'

export type AutoscaleConfig = {
  min: number
  max: number
  targetCPUPercent: number
}

export const AUTOSCALE_CPU_TARGET_DEFAULT = 70
export const AUTOSCALE_CPU_TARGET_MIN = 1
export const AUTOSCALE_CPU_TARGET_MAX = 100

function intField(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return null
  return Math.floor(n)
}

/** Parse node.config.autoscale; absent or invalid shape returns null. */
export function autoscaleFromConfig(raw: unknown): AutoscaleConfig | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const min = intField(o.min)
  const max = intField(o.max)
  const targetCPUPercent = intField(o.targetCPUPercent)
  if (min == null || max == null || targetCPUPercent == null) return null
  if (
    min < APP_SERVER_REPLICA_MIN ||
    max > APP_SERVER_REPLICA_MAX ||
    max < min ||
    targetCPUPercent < AUTOSCALE_CPU_TARGET_MIN ||
    targetCPUPercent > AUTOSCALE_CPU_TARGET_MAX
  ) {
    return null
  }
  return { min, max, targetCPUPercent }
}

export function defaultAutoscale(maxReplicas: number = APP_SERVER_REPLICA_MAX): AutoscaleConfig {
  const max = clampAppServerReplicas(maxReplicas, maxReplicas)
  return {
    min: APP_SERVER_REPLICA_MIN,
    max,
    targetCPUPercent: AUTOSCALE_CPU_TARGET_DEFAULT,
  }
}

export function clampAutoscaleMin(raw: unknown, max: number): number {
  const ceiling = clampAppServerReplicas(max, max)
  const n = clampAppServerReplicas(raw, ceiling)
  return Math.min(n, ceiling)
}

export function clampAutoscaleMax(raw: unknown, min: number, planMax: number): number {
  const floor = clampAppServerReplicas(min, planMax)
  const ceiling = clampAppServerReplicas(planMax, planMax)
  const n = clampAppServerReplicas(raw, ceiling)
  return Math.max(floor, Math.min(ceiling, n))
}

export function clampAutoscaleCpuTarget(raw: unknown): number {
  const n = intField(raw)
  if (n == null) return AUTOSCALE_CPU_TARGET_DEFAULT
  return Math.min(
    AUTOSCALE_CPU_TARGET_MAX,
    Math.max(AUTOSCALE_CPU_TARGET_MIN, n),
  )
}
