import type { StorageIoMetrics } from '../editor-core/domain/metricsUiContract'

export function hasStorageMetrics(m: {
  storageEngine?: string
  storageIo?: StorageIoMetrics | null
}): boolean {
  if ((m.storageEngine ?? '').trim()) return true
  const io = m.storageIo
  if (!io) return false
  return Boolean(
    (io.unit ?? '').trim() ||
      (io.source ?? '').trim() ||
      io.bytesLimit > 0 ||
      io.readRate > 0 ||
      io.writeRate > 0,
  )
}

export function storageEngineLabel(engine: string): string {
  const key = engine.trim().toLowerCase()
  const map: Record<string, string> = {
    postgresql: 'PostgreSQL',
    redis: 'Redis',
    cassandra: 'Cassandra',
  }
  return map[key] ?? (engine.trim() || 'Storage')
}

export function storageUtilizationPct(io: StorageIoMetrics): number {
  if (io.bytesLimit <= 0 || !Number.isFinite(io.bytesLimit)) return 0
  return Math.min(100, (io.bytesUsed / io.bytesLimit) * 100)
}

export function storageUtilBarClass(pct: number): string {
  if (pct >= 90) return 'bg-red-500'
  if (pct >= 80) return 'bg-amber-500'
  return 'bg-emerald-500'
}

export function storageUnitLabel(unit: string): string {
  const u = unit.trim()
  return u || 'ops/s'
}
