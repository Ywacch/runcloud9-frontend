import { describe, expect, it } from 'vitest'
import { LIVE_LB_ALGORITHMS, lbAlgorithmForDeploy } from './replicaConfig'

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
