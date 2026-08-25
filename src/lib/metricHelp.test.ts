import { describe, expect, it } from 'vitest'
import {
  SESSION_CACHE_TOTALS_HINT,
  SESSION_REPLICA_BREAKDOWN_HINT,
  SESSION_TIMEFRAME_FOOTER,
  SESSION_TIMEFRAME_LABEL,
} from './metricHelp'

describe('session timeframe copy', () => {
  it('uses Session label without a fixed 9m window', () => {
    expect(SESSION_TIMEFRAME_LABEL).toBe('Session')
    expect(SESSION_TIMEFRAME_LABEL).not.toContain('(9m)')
    expect(SESSION_TIMEFRAME_FOOTER).not.toContain('9-minute')
    expect(SESSION_TIMEFRAME_FOOTER).not.toContain('rolling 9')
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
})
