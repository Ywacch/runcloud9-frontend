import { describe, expect, it } from 'vitest'
import {
  appLatencyCommitWaitNote,
  engineClientScopeNote,
  fmtLagBytes,
  fmtReplicationLagSeconds,
  maxConnectedReplicationLagSeconds,
  promotionCandidateLayer,
  replicationConfigGap,
  replicationLagFlag,
  walBehindFoot,
} from './dbReplicationDisplay'
import type { ComponentLayerMetrics } from '../editor-core/domain/metricsUiContract'

function replica(partial: Partial<ComponentLayerMetrics>): ComponentLayerMetrics {
  return {
    id: 'db-replica-1',
    role: 'replica',
    engine: 'postgresql',
    cpuUsage: 0.1,
    memoryBytes: 1,
    cpuLimit: 1,
    memoryLimit: 1,
    cpuIsEstimated: false,
    memIsEstimated: false,
    ...partial,
  }
}

describe('dbReplicationDisplay', () => {
  it('formats lag and bytes', () => {
    expect(fmtReplicationLagSeconds(0)).toBe('0 s')
    expect(fmtLagBytes(8192)).toBe('8.0 KiB')
  })

  it('picks max lag and promotion candidate', () => {
    const layers = [
      replica({ id: 'a', replicationLagSeconds: 0.1, promotionCandidate: true }),
      replica({ id: 'b', replicationLagSeconds: 0.5 }),
    ]
    expect(maxConnectedReplicationLagSeconds(layers)).toBe(0.5)
    expect(promotionCandidateLayer(layers)?.id).toBe('a')
  })

  it('treats async lag as freshness, not durability', () => {
    expect(replicationLagFlag(0.1, 'async', ['async']).text).toBe('CAUGHT UP')
    expect(replicationLagFlag(4, 'async', ['async']).text).toBe('LAGGING')
    expect(walBehindFoot('async', 'on')).toBe('acked locally · not yet replayed')
    expect(appLatencyCommitWaitNote('async', 'on')).toBeNull()
  })

  it('flags sync only when a standby is the commit wait target', () => {
    expect(replicationLagFlag(0.1, 'sync', ['async']).text).toBe('NOT WAITING')
    expect(replicationLagFlag(0.1, 'sync', ['sync']).text).toBe('SYNC WAIT')
    expect(replicationLagFlag(3, 'sync', ['sync']).text).toBe('REPLAY BEHIND')
    expect(replicationLagFlag(0.05, 'semi-sync', ['quorum']).text).toBe('QUORUM')
    expect(replicationConfigGap('sync', ['async'])).toMatch(/not waiting/)
    expect(replicationConfigGap('async', ['sync'])).toMatch(/Canvas is async/)
    expect(replicationConfigGap('semi-sync', ['quorum'])).toBeNull()
    expect(appLatencyCommitWaitNote('semi-sync', 'remote_apply')).toMatch(/remote_apply/)
    expect(engineClientScopeNote(0)).not.toMatch(/replication/)
    expect(engineClientScopeNote(1)).toMatch(/replication/)
  })
})
