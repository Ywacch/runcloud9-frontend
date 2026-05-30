import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { canvasToBackend } from './typeMapping'

export type ChaosScenario = 'pod_kill' | 'cache_flush'

export type ChaosTargetComponent =
  | 'app-server'
  | 'cache'
  | 'db'
  | 'mq'
  | 'worker'
  | 'lb'

export interface ChaosRequest {
  scenario: ChaosScenario
  targetComponent: ChaosTargetComponent
}

export interface ChaosAppliedResponse {
  status: 'applied'
  scenario: ChaosScenario
  targetComponent: ChaosTargetComponent
}

const POD_KILL_TARGETS: ChaosTargetComponent[] = [
  'app-server',
  'cache',
  'db',
  'mq',
  'worker',
  'lb',
]

export function chaosTargetForNode(
  nodeType: CanvasNode['type'],
): ChaosTargetComponent | null {
  if (nodeType === 'client') return null
  const key = canvasToBackend[nodeType]
  if (POD_KILL_TARGETS.includes(key as ChaosTargetComponent)) {
    return key as ChaosTargetComponent
  }
  return null
}

export function chaosScenariosForTarget(
  target: ChaosTargetComponent,
): ChaosScenario[] {
  if (target === 'cache') return ['pod_kill', 'cache_flush']
  return ['pod_kill']
}

export function chaosScenarioLabel(scenario: ChaosScenario): string {
  if (scenario === 'pod_kill') return 'Kill pod'
  return 'Flush cache'
}

export function chaosScenarioConfirm(
  scenario: ChaosScenario,
  target: ChaosTargetComponent,
): string {
  if (scenario === 'cache_flush') {
    return 'Runs FLUSHALL on the Redis pod for this cache. Expect a miss spike on the database.'
  }
  if (target === 'app-server') {
    return 'Deletes one running app-server pod. Kubernetes replaces it. With multiple replicas, only one pod is removed.'
  }
  return `Deletes one running ${target} pod. Kubernetes replaces it.`
}

/** Overlay timing defaults from chaos API contract (client-owned). */
export function chaosOverlayTiming(
  scenario: ChaosScenario,
  target: ChaosTargetComponent,
): { clearAfterMs: number; minDisplayMs: number } {
  if (scenario === 'cache_flush') {
    return { clearAfterMs: 25_000, minDisplayMs: 5_000 }
  }
  const byTarget: Record<ChaosTargetComponent, { clearAfterMs: number; minDisplayMs: number }> =
    {
      lb: { clearAfterMs: 20_000, minDisplayMs: 5_000 },
      cache: { clearAfterMs: 25_000, minDisplayMs: 5_000 },
      'app-server': { clearAfterMs: 60_000, minDisplayMs: 10_000 },
      worker: { clearAfterMs: 75_000, minDisplayMs: 15_000 },
      db: { clearAfterMs: 90_000, minDisplayMs: 20_000 },
      mq: { clearAfterMs: 120_000, minDisplayMs: 20_000 },
    }
  return byTarget[target] ?? { clearAfterMs: 60_000, minDisplayMs: 10_000 }
}

/** Map a metrics WS chaos event to overlay state (description holds scenario id). */
export function chaosOverlayFromWsEvent(e: {
  source?: string
  component?: string
  description?: string
  timestamp?: string
}): {
  scenario: ChaosScenario
  targetComponent: ChaosTargetComponent
  startedAt: number
} | null {
  if (e.source !== 'chaos' || !e.component) return null
  const scenario =
    e.description === 'pod_kill' || e.description === 'cache_flush'
      ? e.description
      : null
  if (!scenario) return null
  const target = e.component as ChaosTargetComponent
  if (scenario === 'cache_flush' && target !== 'cache') return null
  if (scenario === 'pod_kill' && !POD_KILL_TARGETS.includes(target)) return null
  const t = e.timestamp ? Date.parse(e.timestamp) : NaN
  return {
    scenario,
    targetComponent: target,
    startedAt: Number.isFinite(t) ? t : Date.now(),
  }
}
