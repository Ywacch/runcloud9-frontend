import type { ComponentLayerMetrics, PodReplicaMetrics } from '../editor-core/domain/metricsUiContract'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import type { MetricsTimeframe } from './metricTimeframe'

export type LatencyQuantile = 'p50' | 'p95' | 'p99'

export const DEFAULT_LATENCY_QUANTILE: LatencyQuantile = 'p99'

const STORAGE_KEY = 'runcloud9.inspectorLatencyQuantile'

const QUANTILES: LatencyQuantile[] = ['p50', 'p95', 'p99']

export function isLatencyQuantile(raw: unknown): raw is LatencyQuantile {
  return raw === 'p50' || raw === 'p95' || raw === 'p99'
}

export function readLatencyQuantile(): LatencyQuantile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return isLatencyQuantile(raw) ? raw : DEFAULT_LATENCY_QUANTILE
  } catch {
    return DEFAULT_LATENCY_QUANTILE
  }
}

export function writeLatencyQuantile(quantile: LatencyQuantile): void {
  try {
    localStorage.setItem(STORAGE_KEY, quantile)
  } catch {
    /* private mode / quota */
  }
}

export function latencyGraphTitle(quantile: LatencyQuantile): string {
  return `${quantile} latency`
}

export function bucketLatencyField(
  m: MetricsBucket,
  quantile: LatencyQuantile,
  timeframe: MetricsTimeframe,
): number {
  if (timeframe === 'session') {
    switch (quantile) {
      case 'p50':
        return m.p50Latency9m > 0 ? m.p50Latency9m : m.p50Latency
      case 'p95':
        return m.p95Latency9m > 0 ? m.p95Latency9m : m.p95Latency
      default:
        return m.p99Latency9m > 0 ? m.p99Latency9m : m.p99Latency
    }
  }
  switch (quantile) {
    case 'p50':
      return m.p50Latency
    case 'p95':
      return m.p95Latency
    default:
      return m.p99Latency
  }
}

export function bucketLatencyHistorySeries(
  history: MetricsBucket[],
  quantile: LatencyQuantile,
): number[] {
  switch (quantile) {
    case 'p50':
      return history.map((h) => h.p50Latency)
    case 'p95':
      return history.map((h) => h.p95Latency)
    default:
      return history.map((h) => h.p99Latency)
  }
}

export function podLatencyMs(
  pod: PodReplicaMetrics,
  quantile: LatencyQuantile,
  timeframe: MetricsTimeframe,
): number {
  if (timeframe === 'session') {
    switch (quantile) {
      case 'p50':
        return pod.p50Latency9mMs ?? pod.p50LatencyMs ?? 0
      case 'p95':
        return pod.p95Latency9mMs ?? pod.p95LatencyMs ?? 0
      default:
        return pod.p99Latency9mMs ?? pod.p99LatencyMs
    }
  }
  switch (quantile) {
    case 'p50':
      return pod.p50LatencyMs ?? 0
    case 'p95':
      return pod.p95LatencyMs ?? 0
    default:
      return pod.p99LatencyMs
  }
}

export function layerLatencyMs(
  layer: ComponentLayerMetrics,
  quantile: LatencyQuantile,
  timeframe: MetricsTimeframe,
): number {
  if (timeframe === 'session') {
    switch (quantile) {
      case 'p50':
        return layer.p50Latency9mMs ?? layer.p50LatencyMs ?? 0
      case 'p95':
        return layer.p95Latency9mMs ?? layer.p95LatencyMs ?? 0
      default:
        return layer.p99Latency9mMs ?? layer.p99LatencyMs ?? 0
    }
  }
  switch (quantile) {
    case 'p50':
      return layer.p50LatencyMs ?? 0
    case 'p95':
      return layer.p95LatencyMs ?? 0
    default:
      return layer.p99LatencyMs ?? 0
  }
}

export function bucketSessionQuantileAvailable(
  m: MetricsBucket,
  quantile: LatencyQuantile,
): boolean {
  if (quantile === 'p99') return m.p99Latency9m > 0 || m.p99Latency > 0
  if (quantile === 'p95') return m.p95Latency9m > 0 || m.p95Latency > 0
  return m.p50Latency9m > 0 || m.p50Latency > 0
}

export function podSessionQuantileAvailable(
  pod: PodReplicaMetrics,
  quantile: LatencyQuantile,
): boolean {
  if (quantile === 'p99') {
    return (pod.p99Latency9mMs ?? 0) > 0 || pod.p99LatencyMs > 0
  }
  if (quantile === 'p95') {
    return (pod.p95Latency9mMs ?? 0) > 0 || (pod.p95LatencyMs ?? 0) > 0
  }
  return (pod.p50Latency9mMs ?? 0) > 0 || (pod.p50LatencyMs ?? 0) > 0
}

export function layerSessionQuantileAvailable(
  layer: ComponentLayerMetrics,
  quantile: LatencyQuantile,
): boolean {
  if (quantile === 'p99') {
    return (layer.p99Latency9mMs ?? 0) > 0 || (layer.p99LatencyMs ?? 0) > 0
  }
  if (quantile === 'p95') {
    return (layer.p95Latency9mMs ?? 0) > 0 || (layer.p95LatencyMs ?? 0) > 0
  }
  return (layer.p50Latency9mMs ?? 0) > 0 || (layer.p50LatencyMs ?? 0) > 0
}

export function sessionQuantileOptions(
  available: (quantile: LatencyQuantile) => boolean,
): LatencyQuantile[] {
  return QUANTILES.filter((q) => available(q))
}
