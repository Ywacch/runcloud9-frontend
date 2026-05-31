import { describe, expect, it } from 'vitest'
import {
  formatDbQueriesPerSec,
  hasStorageMetrics,
  shouldShowHighScanRatioHint,
  storageEngineLabel,
  storageReadTileLabel,
  storageScopeLine,
  storageUtilBarClass,
  storageUtilizationPct,
  storageWriteTileLabel,
} from './storageIoDisplay'
import type { StorageIoMetrics } from '../editor-core/domain/metricsUiContract'

const baseIo: StorageIoMetrics = {
  readRate: 0,
  writeRate: 0,
  unit: 'rows/s',
  readLatency: 0,
  writeLatency: 0,
  bytesUsed: 0,
  bytesLimit: 0,
  errorRate: 0,
  source: 'postgres_exporter',
}

describe('storageIoDisplay', () => {
  it('hasStorageMetrics is true when storageEngine is set', () => {
    expect(hasStorageMetrics({ storageEngine: 'postgresql', storageIo: null })).toBe(
      true,
    )
  })

  it('storageUtilizationPct warns thresholds', () => {
    const pct = storageUtilizationPct({
      ...baseIo,
      bytesUsed: 85,
      bytesLimit: 100,
    })
    expect(pct).toBe(85)
    expect(storageUtilBarClass(pct)).toBe('bg-amber-500')
    expect(storageUtilBarClass(92)).toBe('bg-red-500')
  })

  it('storageEngineLabel maps known engines', () => {
    expect(storageEngineLabel('postgresql')).toBe('PostgreSQL')
    expect(storageEngineLabel('redis')).toBe('Redis')
  })

  it('uses wire labels when present', () => {
    const io = { ...baseIo, readLabel: 'Custom read', writeLabel: 'Custom write' }
    expect(storageReadTileLabel(io, 'postgresql')).toBe('Custom read')
    expect(storageWriteTileLabel(io, 'postgresql')).toBe('Custom write')
  })

  it('defaults postgres tile labels', () => {
    expect(storageReadTileLabel(baseIo, 'postgresql')).toBe('Rows scanned/s')
    expect(storageWriteTileLabel(baseIo, 'postgresql')).toBe('Rows written/s')
  })

  it('defaults redis tile labels', () => {
    expect(storageReadTileLabel({ ...baseIo, unit: 'cmd/s' }, 'redis')).toBe(
      'GET commands/s',
    )
    expect(storageWriteTileLabel({ ...baseIo, unit: 'cmd/s' }, 'redis')).toBe(
      'SET commands/s',
    )
  })

  it('storageScopeLine joins role source scope', () => {
    expect(
      storageScopeLine('primary', {
        ...baseIo,
        scope: 'all-db-clients',
      }),
    ).toBe('Role: primary · postgres_exporter · all-db-clients')
  })

  it('formatDbQueriesPerSec handles idle and backfill', () => {
    expect(formatDbQueriesPerSec(0, '', 0, false)).toBe('—')
    expect(formatDbQueriesPerSec(0, 'none', 0, false)).toBe('No app queries')
    expect(formatDbQueriesPerSec(6, '', 0, false)).toBe('No app queries')
    expect(formatDbQueriesPerSec(50, 'app', 1000, true)).toBe('50/s')
  })

  it('shouldShowHighScanRatioHint when scan ratio high', () => {
    expect(shouldShowHighScanRatioHint(50, 14731)).toBe(true)
    expect(shouldShowHighScanRatioHint(50, 100)).toBe(false)
  })
})
