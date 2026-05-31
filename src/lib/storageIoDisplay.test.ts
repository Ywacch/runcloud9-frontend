import { describe, expect, it } from 'vitest'
import {
  hasStorageMetrics,
  storageEngineLabel,
  storageUtilBarClass,
  storageUtilizationPct,
} from './storageIoDisplay'

describe('storageIoDisplay', () => {
  it('hasStorageMetrics is true when storageEngine is set', () => {
    expect(hasStorageMetrics({ storageEngine: 'postgresql', storageIo: null })).toBe(
      true,
    )
  })

  it('storageUtilizationPct warns thresholds', () => {
    const pct = storageUtilizationPct({
      readRate: 0,
      writeRate: 0,
      unit: 'rows/s',
      readLatency: 0,
      writeLatency: 0,
      bytesUsed: 85,
      bytesLimit: 100,
      errorRate: 0,
      source: '',
    })
    expect(pct).toBe(85)
    expect(storageUtilBarClass(pct)).toBe('bg-amber-500')
    expect(storageUtilBarClass(92)).toBe('bg-red-500')
  })

  it('storageEngineLabel maps known engines', () => {
    expect(storageEngineLabel('postgresql')).toBe('PostgreSQL')
    expect(storageEngineLabel('redis')).toBe('Redis')
  })
})
