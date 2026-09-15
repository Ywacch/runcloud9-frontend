/** Placeholder when a metric or label has no value (tables, tooltips, KPIs). */
export const FMT_EMPTY = '-'

/** Integer metrics — always round (total requests, cache hits, connections, etc.) */
export function fmtInt(v: number | undefined | null): string {
  if (v == null || !Number.isFinite(v)) return FMT_EMPTY
  return Math.round(v).toLocaleString()
}

/** Rate per second — integer when ≥1/s; one decimal only below 1 */
export function fmtRate(v: number | undefined | null): string {
  if (v == null || !Number.isFinite(v)) return FMT_EMPTY
  if (v === 0) return '0'
  if (v < 1) return v.toFixed(1)
  return Math.round(v).toLocaleString()
}

/** Latency in ms — 0 decimals above 10ms, 1 decimal below */
export function fmtMs(v: number | undefined | null): string {
  if (v == null || !Number.isFinite(v)) return FMT_EMPTY
  if (v === 0) return FMT_EMPTY
  if (v > 0 && v < 0.1) return '<0.1ms'
  if (v < 1) return `${v.toFixed(1)}ms`
  return `${Math.round(v)}ms`
}

/** Whole-number percent for bars and labels (MetricsBucket cpuPercent/memPercent are 0–100). */
export function clampPercent(v: number | undefined | null): number {
  if (v == null || !Number.isFinite(v)) return 0
  return Math.max(0, Math.min(100, Math.round(v)))
}

/** Percentage — clamped 0–100; whole numbers without “.0” */
export function fmtPct(v: number | undefined | null): string {
  if (v == null || !Number.isFinite(v)) return FMT_EMPTY
  const x = Math.min(100, Math.max(0, v))
  if (Math.abs(x - Math.round(x)) < 1e-6) return `${Math.round(x)}%`
  return `${x.toFixed(1)}%`
}

/** Error rate — 2 decimals per second */
export function fmtErrorRate(v: number | undefined | null): string {
  if (v == null || !Number.isFinite(v)) return FMT_EMPTY
  if (v === 0) return '0/s'
  return `${v.toFixed(2)}/s`
}

/** Bytes → human readable */
export function fmtBytes(v: number | undefined | null): string {
  if (v == null || !Number.isFinite(v) || v === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(3, Math.floor(Math.log(Math.abs(v)) / Math.log(1024)))
  return `${(v / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

/** CPU fraction (0.0–1.0+) → percentage string */
export function fmtCpu(v: number | undefined | null): string {
  if (v == null || !Number.isFinite(v)) return FMT_EMPTY
  return `${Math.round(v * 100)}%`
}

/** CPU cores → Kubernetes-style millicores (e.g. 0.25 → "250m"). */
export function fmtCpuMilliCores(cores: number | undefined | null): string {
  if (cores == null || !Number.isFinite(cores) || cores < 0) return FMT_EMPTY
  return `${Math.round(cores * 1000)}m`
}

/** Bytes → megabytes for compact “raw MB” labels (badges / allocations). */
export function fmtMemMB(bytes: number | undefined | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return '0 MB'
  const mb = bytes / (1024 * 1024)
  if (mb >= 10) return `${Math.round(mb)} MB`
  return `${mb.toFixed(1)} MB`
}

/** @deprecated use fmtBytes */
export function formatBytes(bytes: number): string {
  return fmtBytes(bytes)
}
