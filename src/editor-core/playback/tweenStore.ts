import type { MetricsBucket } from '../stores/metricsStore'
import { useCanvasStore } from '../stores/canvasStore'
import { useMetricsStore } from '../stores/metricsStore'

/** Per rAF damping factor — headlines converge in ~0.5s at 60fps. */
export const TWEEN_DAMPING = 0.12

/** Cap elapsed ms per frame so tab refocus does not overshoot in one tick. */
export const MAX_DELTA_MS = 200

const FRAME_MS = 1000 / 60

/** Numeric headline fields tweened in live mode (F1). */
export const TWEENABLE_METRIC_FIELDS = [
  'requestRate',
  'p99Latency',
  'p50Latency',
  'p95Latency',
  'cpuPercent',
  'memPercent',
  'errorRate',
  'dbQueryRate',
  'cacheHits',
  'cacheMisses',
  'cacheErrors',
] as const

export type TweenableMetricField = (typeof TWEENABLE_METRIC_FIELDS)[number]

const displays = new Map<string, number>()
const listeners = new Set<() => void>()
let rafId = 0
let lastFrameMs = 0
let subscriberCount = 0

function metricKey(nodeId: string, field: TweenableMetricField): string {
  return `${nodeId}:${field}`
}

/** True when this field should not tween (UI shows non-numeric copy). */
export function isTweenFieldAbsent(
  bucket: MetricsBucket | undefined,
  field: TweenableMetricField,
): boolean {
  if (!bucket) return true
  if (field === 'dbQueryRate' && bucket.dbQuerySource === 'none') return true
  return false
}

export function readTweenTarget(
  bucket: MetricsBucket,
  field: TweenableMetricField,
): number | null {
  if (isTweenFieldAbsent(bucket, field)) return null
  const v = bucket[field]
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function shouldRunTweenLoop(): boolean {
  return useCanvasStore.getState().mode === 'live'
}

/** One damping step toward targets (exported for unit tests). */
export function applyTweenDampingStep(
  metrics: Record<string, MetricsBucket>,
  damping = TWEEN_DAMPING,
): boolean {
  let changed = false
  for (const [nodeId, bucket] of Object.entries(metrics)) {
    for (const field of TWEENABLE_METRIC_FIELDS) {
      const target = readTweenTarget(bucket, field)
      const k = metricKey(nodeId, field)
      if (target === null) {
        displays.delete(k)
        continue
      }
      const prev = displays.get(k) ?? target
      const next = prev + (target - prev) * damping
      if (Math.abs(next - prev) > 1e-6 || !displays.has(k)) changed = true
      displays.set(k, next)
    }
  }
  return changed
}

/** Sub-steps for elapsed wall time (tab-sleep cap). */
export function dampingStepsForDelta(deltaMs: number): number {
  const capped = Math.min(Math.max(0, deltaMs), MAX_DELTA_MS)
  return Math.max(1, Math.round(capped / FRAME_MS))
}

export function runTweenSteps(
  metrics: Record<string, MetricsBucket>,
  deltaMs: number,
  damping = TWEEN_DAMPING,
): boolean {
  const steps = dampingStepsForDelta(deltaMs)
  let changed = false
  for (let i = 0; i < steps; i++) {
    if (applyTweenDampingStep(metrics, damping)) changed = true
  }
  return changed
}

function tick(now: number): void {
  rafId = requestAnimationFrame(tick)
  if (!shouldRunTweenLoop()) return

  const deltaMs = lastFrameMs > 0 ? now - lastFrameMs : FRAME_MS
  lastFrameMs = now
  const metrics = useMetricsStore.getState().metrics
  if (runTweenSteps(metrics, deltaMs) && listeners.size > 0) {
    for (const listener of listeners) listener()
  }
}

function startLoop(): void {
  if (rafId !== 0) return
  lastFrameMs = 0
  rafId = requestAnimationFrame(tick)
}

function stopLoop(): void {
  if (rafId === 0) return
  cancelAnimationFrame(rafId)
  rafId = 0
  lastFrameMs = 0
}

export function subscribeTween(listener: () => void): () => void {
  listeners.add(listener)
  subscriberCount++
  startLoop()
  return () => {
    listeners.delete(listener)
    subscriberCount--
    if (subscriberCount <= 0) {
      subscriberCount = 0
      stopLoop()
    }
  }
}

export function getTweenedMetricValue(
  nodeId: string,
  field: TweenableMetricField,
): number | null {
  const k = metricKey(nodeId, field)
  if (displays.has(k)) return displays.get(k)!
  const bucket = useMetricsStore.getState().metrics[nodeId]
  if (isTweenFieldAbsent(bucket, field)) return null
  return bucket ? readTweenTarget(bucket, field) : null
}

/** Reset smoothed values (metrics cleared / session ended). */
export function resetTweenStore(): void {
  displays.clear()
  for (const listener of listeners) listener()
}
