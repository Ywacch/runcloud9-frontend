import { describe, expect, it } from 'vitest'
import {
  SESSION_CACHE_THROUGHPUT_LABEL,
  SESSION_CACHE_TOTALS_DISCLOSURE_HINT,
  SESSION_CACHE_TOTALS_HINT,
  SESSION_LATENCY_P99_HELP,
  SESSION_REPLICA_BREAKDOWN_HINT,
  SESSION_STORAGE_ENGINE_HINT,
  SESSION_TIMEFRAME_FOOTER,
  SESSION_TIMEFRAME_LABEL,
} from './metricHelp'

describe('session timeframe copy', () => {
  it('uses Session label without a fixed 9m window', () => {
    expect(SESSION_TIMEFRAME_LABEL).toBe('Session')
    expect(SESSION_TIMEFRAME_LABEL).not.toContain('(9m)')
    expect(SESSION_TIMEFRAME_FOOTER).not.toContain('9-minute')
    expect(SESSION_TIMEFRAME_FOOTER).not.toContain('rolling 9')
    expect(SESSION_TIMEFRAME_FOOTER).not.toContain('shorter windows')
  })

  it('describes session p99 latency without a fixed 9m window', () => {
    expect(SESSION_LATENCY_P99_HELP).toContain('since session start')
    expect(SESSION_LATENCY_P99_HELP).toContain('live pods')
    expect(SESSION_LATENCY_P99_HELP).not.toContain('9-minute')
    expect(SESSION_LATENCY_P99_HELP).not.toContain('(9m)')
  })

  it('explains cluster vs per-replica session totals', () => {
    expect(SESSION_REPLICA_BREAKDOWN_HINT).toContain('Cluster totals')
    expect(SESSION_REPLICA_BREAKDOWN_HINT).toContain('reset on kill')
  })

  it('describes session cache totals without a fixed 9m window', () => {
    expect(SESSION_CACHE_TOTALS_HINT).toContain('deployment')
    expect(SESSION_CACHE_TOTALS_HINT).not.toContain('9-minute')
    expect(SESSION_CACHE_TOTALS_HINT).not.toContain('rolling 9')
  })

  it('uses session wording for cache totals disclosure', () => {
    expect(SESSION_CACHE_THROUGHPUT_LABEL).toBe('Session totals')
    expect(SESSION_CACHE_THROUGHPUT_LABEL).not.toContain('9 min')
    expect(SESSION_CACHE_TOTALS_DISCLOSURE_HINT).toContain('provision')
    expect(SESSION_CACHE_TOTALS_DISCLOSURE_HINT).not.toContain('9 min')
    expect(SESSION_CACHE_TOTALS_DISCLOSURE_HINT).not.toContain('Rolling Prometheus')
  })

  it('explains engine storage counters vs app cache hits', () => {
    expect(SESSION_STORAGE_ENGINE_HINT).toContain('exporter')
    expect(SESSION_STORAGE_ENGINE_HINT).toContain('Not app logical')
    expect(SESSION_STORAGE_ENGINE_HINT).not.toContain('GET/SET')
  })
})
