import { useEffect, useState } from 'react'
import { useCanvasStore } from '../stores/canvasStore'
import { useMetricsStore } from '../stores/metricsStore'
import {
  getTweenedMetricValue,
  subscribeTween,
  type TweenableMetricField,
} from './tweenStore'

/**
 * Smoothed numeric metric for live headline tiles. Returns `null` when the
 * field is absent (e.g. dbQuerySource === "none" for dbQueryRate).
 */
export function useTweenedMetric(
  nodeId: string,
  field: TweenableMetricField,
): number | null {
  const mode = useCanvasStore((s) => s.mode)
  const raw = useMetricsStore((s) => s.metrics[nodeId]?.[field])
  const absent =
    field === 'dbQueryRate' &&
    useMetricsStore((s) => s.metrics[nodeId]?.dbQuerySource) === 'none'
  const [, bump] = useState(0)

  useEffect(() => {
    if (mode !== 'live') return
    return subscribeTween(() => bump((n) => n + 1))
  }, [mode])

  if (mode !== 'live' || absent) return null

  const tweened = getTweenedMetricValue(nodeId, field)
  if (tweened !== null) return tweened

  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0
}
