import { computeHealthState, type HealthState } from '../../editor-core/domain/healthThresholds'
import {
  isMetricsViewportMode,
  type CanvasMode,
  type CanvasNode,
} from '../../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../../editor-core/stores/metricsStore'
import { canvasToBackend } from '../../lib/typeMapping'
import type { ChaosTargetComponent } from '../../lib/chaos'

/** Live/sim health rim — `off` hides the rim (design mode). */
export type HealthVisualState = 'off' | HealthState | 'chaos'

export interface HealthRimStyle {
  color: number
  pulseSpeed: number
  baseAlpha: number
}

const RIM_STYLE: Record<Exclude<HealthState, 'idle'>, HealthRimStyle> = {
  healthy: { color: 0x22c55e, pulseSpeed: 0, baseAlpha: 0.35 },
  warning: { color: 0xf59e0b, pulseSpeed: 1.0, baseAlpha: 0.35 },
  error: { color: 0xef4444, pulseSpeed: 2.2, baseAlpha: 0.35 },
}

const CHAOS_RIM_STYLE: HealthRimStyle = {
  color: 0xa78bfa,
  pulseSpeed: 1.6,
  baseAlpha: 0.35,
}

export function healthRimStyle(state: HealthVisualState): HealthRimStyle | null {
  if (state === 'off' || state === 'idle') return null
  if (state === 'chaos') return CHAOS_RIM_STYLE
  return RIM_STYLE[state]
}

export function healthRimAlpha(style: HealthRimStyle, elapsedSec: number): number {
  if (style.pulseSpeed === 0) return style.baseAlpha
  return (
    0.25 +
    0.4 * Math.abs(Math.sin(elapsedSec * Math.PI * style.pulseSpeed))
  )
}

export function isChaosActiveForNode(
  node: CanvasNode,
  isTargetActive: (target: ChaosTargetComponent) => boolean,
): boolean {
  return isTargetActive(canvasToBackend[node.type] as ChaosTargetComponent)
}

export function resolveHealthVisual(
  node: CanvasNode,
  metrics: MetricsBucket | undefined,
  mode: CanvasMode,
  chaosActive: boolean,
): HealthVisualState {
  if (!isMetricsViewportMode(mode)) return 'off'
  if (chaosActive) return 'chaos'
  return computeHealthState(metrics, node.status)
}
