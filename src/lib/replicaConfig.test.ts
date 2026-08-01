import { describe, expect, it } from 'vitest'
import { LIVE_LB_ALGORITHMS, lbAlgorithmForDeploy } from './replicaConfig'

describe('lbAlgorithmForDeploy', () => {
  it('maps live allowlist and aliases', () => {
    expect(lbAlgorithmForDeploy('round-robin')).toBe('round-robin')
    expect(lbAlgorithmForDeploy('round_robin')).toBe('round-robin')
    expect(lbAlgorithmForDeploy('least_conn')).toBe('least_conn')
    expect(lbAlgorithmForDeploy('least-connections')).toBe('least_conn')
    expect(lbAlgorithmForDeploy('random')).toBe('random')
  })

  it('folds legacy ip_hash to round-robin', () => {
    expect(lbAlgorithmForDeploy('ip_hash')).toBe('round-robin')
    expect(lbAlgorithmForDeploy('ip-hash')).toBe('round-robin')
  })

  it('falls back unknown values to round-robin', () => {
    expect(lbAlgorithmForDeploy('least_time')).toBe('round-robin')
    expect(lbAlgorithmForDeploy('')).toBe('round-robin')
  })

  it('exports exactly three live algorithms', () => {
    expect([...LIVE_LB_ALGORITHMS]).toEqual([
      'round-robin',
      'least_conn',
      'random',
    ])
  })
})
