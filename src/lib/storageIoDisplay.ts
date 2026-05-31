import type { StorageIoMetrics } from '../editor-core/domain/metricsUiContract'
import { fmtRate } from './format'

export type DbQuerySource = 'app' | 'none' | ''

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
      io.writeRate > 0 ||
      io.bytesUsed > 0,
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

/** Tile label: prefer wire `readLabel`, else engine-specific default. */
export function storageReadTileLabel(
  io: StorageIoMetrics,
  engine: string,
): string {
  if (io.readLabel?.trim()) return io.readLabel.trim()
  const key = engine.trim().toLowerCase()
  if (key === 'postgresql') return 'Rows scanned/s'
  if (key === 'redis') return 'GET commands/s'
  const unit = storageUnitLabel(io.unit)
  return `Read (${unit})`
}

export function storageWriteTileLabel(
  io: StorageIoMetrics,
  engine: string,
): string {
  if (io.writeLabel?.trim()) return io.writeLabel.trim()
  const key = engine.trim().toLowerCase()
  if (key === 'postgresql') return 'Rows written/s'
  if (key === 'redis') return 'SET commands/s'
  const unit = storageUnitLabel(io.unit)
  return `Write (${unit})`
}

export function dbLoadSectionTitle(engine: string): string {
  const label = storageEngineLabel(engine)
  return `DB Load · ${label}`
}

export function cacheEngineSectionTitle(engine: string): string {
  const label = storageEngineLabel(engine)
  return `Cache engine · ${label} (commands/s)`
}

/** Subheader: Role · source · scope */
export function storageScopeLine(
  role: string,
  io: StorageIoMetrics,
  defaultScope?: string,
): string {
  const parts: string[] = []
  if (role.trim()) parts.push(`Role: ${role.trim()}`)
  if (io.source.trim()) parts.push(io.source.trim())
  const scope = (io.scope ?? defaultScope ?? '').trim()
  if (scope) parts.push(scope)
  return parts.join(' · ')
}

export function parseDbQuerySource(raw: unknown): DbQuerySource {
  if (raw === 'app' || raw === 'none') return raw
  return ''
}

/**
 * Display value for Queries/s (app-server instrumentation only).
 * Handles idle, missing app metrics, and future dbQuerySource.
 */
export function formatDbQueriesPerSec(
  dbQueryRate: number,
  dbQuerySource: DbQuerySource,
  storageReadRate: number,
  loadgenActive: boolean,
): string {
  if (dbQuerySource === 'none') return 'No app queries'
  if (
    dbQuerySource !== 'app' &&
    dbQueryRate > 0 &&
    dbQueryRate <= 10 &&
    storageReadRate < 1
  ) {
    return 'No app queries'
  }
  if (dbQueryRate === 0 && !loadgenActive) return '—'
  if (dbQueryRate === 0) return `${fmtRate(0)}/s`
  return `${fmtRate(dbQueryRate)}/s`
}

/** Teaching hint when row scans far exceed app query count. */
export function shouldShowHighScanRatioHint(
  dbQueryRate: number,
  readRate: number,
  threshold = 10,
): boolean {
  return dbQueryRate > 0 && readRate / dbQueryRate > threshold
}
