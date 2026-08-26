import { describe, expect, it } from 'vitest'
import {
  formatDbQueriesPerSec,
  fanoutScanModelEstimate,
  hasStorageMetrics,
  shouldShowHighScanRatioHint,
  shouldShowKeyspaceDriftHint,
  storageEngineLabel,
  storageIoSessionLabel,
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

  it('storageIoSessionLabel drops a trailing /s', () => {
    expect(storageIoSessionLabel('Rows scanned/s')).toBe('Rows scanned')
    expect(storageIoSessionLabel('Rows written/s')).toBe('Rows written')
    expect(storageIoSessionLabel('GET commands/s')).toBe('GET commands')
    expect(storageIoSessionLabel('Rows scanned')).toBe('Rows scanned')
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

  it('uses wire labels for social-feed sorted-set redis commands', () => {
    const io = {
      ...baseIo,
      unit: 'cmd/s',
      readRate: 120,
      writeRate: 8,
      readLabel: 'ZREVRANGE commands/s',
      writeLabel: 'ZADD/ZREMRANGE commands/s',
      footnote: 'Sorted-set timeline reads/writes (social-feed push).',
    }
    expect(storageReadTileLabel(io, 'redis')).toBe('ZREVRANGE commands/s')
    expect(storageWriteTileLabel(io, 'redis')).toBe('ZADD/ZREMRANGE commands/s')
  })

  it('shouldShowKeyspaceDriftHint when hit rates diverge', () => {
    expect(shouldShowKeyspaceDriftHint(90, 10, 70, 30)).toBe(true)
    expect(shouldShowKeyspaceDriftHint(90, 10, 88, 12)).toBe(false)
    expect(shouldShowKeyspaceDriftHint(0, 0, 10, 0)).toBe(false)
  })

  it('fanoutScanModelEstimate multiplies consume and fanout size', () => {
    expect(
      fanoutScanModelEstimate({
        'worker.consume_rate': 15,
        'worker.fanout_size_avg': 1200,
      }),
    ).toBe(18000)
    expect(fanoutScanModelEstimate({})).toBeNull()
  })
})
