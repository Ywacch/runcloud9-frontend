import { describe, expect, it } from 'vitest'
import {
  LIVE_LB_ALGORITHMS,
  REPLICATION_MODES,
  SYNC_COMMIT_LEVELS,
  lbAlgorithmForDeploy,
  normalizeReplicationModeForDeploy,
  normalizeSyncCommitLevelForDeploy,
  replicationModeFromConfig,
  requiresSynchronousReplication,
  syncCommitLevelFromConfig,
} from './replicaConfig'

describe('lbAlgorithmForDeploy', () => {
  it('maps live allowlist and aliases', () => {
    expect(lbAlgorithmForDeploy('round-robin')).toBe('round-robin')
    expect(lbAlgorithmForDeploy('round_robin')).toBe('round-robin')
    expect(lbAlgorithmForDeploy('least_conn')).toBe('least_conn')
    expect(lbAlgorithmForDeploy('least-connections')).toBe('least_conn')
    expect(lbAlgorithmForDeploy('random')).toBe('random')
    expect(lbAlgorithmForDeploy('ip_hash')).toBe('ip_hash')
    expect(lbAlgorithmForDeploy('ip-hash')).toBe('ip_hash')
    expect(lbAlgorithmForDeploy('iphash')).toBe('ip_hash')
    expect(lbAlgorithmForDeploy('least_time')).toBe('least_time')
    expect(lbAlgorithmForDeploy('least-time')).toBe('least_time')
    expect(lbAlgorithmForDeploy('least-response-time')).toBe('least_time')
  })

  it('falls back unknown values to round-robin', () => {
    expect(lbAlgorithmForDeploy('sticky')).toBe('round-robin')
    expect(lbAlgorithmForDeploy('')).toBe('round-robin')
  })

  it('exports five live algorithms', () => {
    expect([...LIVE_LB_ALGORITHMS]).toEqual([
      'round-robin',
      'least_conn',
      'random',
      'ip_hash',
      'least_time',
    ])
  })
})

describe('replicationModeFromConfig', () => {
  it('normalizes aliases and defaults', () => {
    expect(replicationModeFromConfig(undefined)).toBe('async')
    expect(replicationModeFromConfig('semi_sync')).toBe('semi-sync')
    expect(replicationModeFromConfig('synchronous')).toBe('sync')
  })
})

describe('syncCommitLevelFromConfig', () => {
  it('normalizes levels and defaults to on', () => {
    expect(syncCommitLevelFromConfig(undefined)).toBe('on')
    expect(syncCommitLevelFromConfig('remote_apply')).toBe('remote_apply')
    expect(syncCommitLevelFromConfig('REMOTE_WRITE')).toBe('remote_write')
  })
})

describe('normalizeReplicationModeForDeploy', () => {
  it('forces async when no read replicas', () => {
    expect(normalizeReplicationModeForDeploy('sync', 0)).toBe('async')
    expect(normalizeReplicationModeForDeploy('semi-sync', 0)).toBe('async')
  })
})

describe('normalizeSyncCommitLevelForDeploy', () => {
  it('clears sync level for async replication', () => {
    expect(normalizeSyncCommitLevelForDeploy('remote_apply', 'async')).toBe('on')
  })

  it('keeps level for semi-sync and sync', () => {
    expect(normalizeSyncCommitLevelForDeploy('remote_apply', 'semi-sync')).toBe(
      'remote_apply',
    )
    expect(normalizeSyncCommitLevelForDeploy(undefined, 'sync')).toBe('on')
  })
})

describe('requiresSynchronousReplication', () => {
  it('matches replication mode exports', () => {
    expect(REPLICATION_MODES).toEqual(['async', 'semi-sync', 'sync'])
    expect(SYNC_COMMIT_LEVELS).toEqual(['remote_write', 'on', 'remote_apply'])
    expect(requiresSynchronousReplication('async')).toBe(false)
    expect(requiresSynchronousReplication('semi-sync')).toBe(true)
    expect(requiresSynchronousReplication('sync')).toBe(true)
  })
})
