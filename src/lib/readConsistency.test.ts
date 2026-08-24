import { describe, expect, it } from 'vitest'
import { defaultConfigForType } from './nodeFactory'
import {
  DEFAULT_READ_CONSISTENCY,
  normalizeReadConsistencyForDeploy,
  readConsistencyFromConfig,
  readConsistencyOptionDisabled,
} from './readConsistency'

describe('readConsistencyFromConfig', () => {
  it('defaults to leader-only when missing or invalid', () => {
    expect(readConsistencyFromConfig(undefined)).toBe('leader-only')
    expect(readConsistencyFromConfig('')).toBe('leader-only')
    expect(readConsistencyFromConfig('bogus')).toBe('leader-only')
  })

  it('accepts all wire policies case-insensitively', () => {
    expect(readConsistencyFromConfig('RYW')).toBe('ryw')
    expect(readConsistencyFromConfig('monotonic')).toBe('monotonic')
    expect(readConsistencyFromConfig('ryw+monotonic')).toBe('ryw+monotonic')
  })
})

describe('normalizeReadConsistencyForDeploy', () => {
  it('passes through valid policies when replicas allow them', () => {
    expect(normalizeReadConsistencyForDeploy('replica', 1)).toBe('replica')
    expect(normalizeReadConsistencyForDeploy('ryw', 1)).toBe('ryw')
    expect(normalizeReadConsistencyForDeploy('monotonic', 2)).toBe('monotonic')
    expect(normalizeReadConsistencyForDeploy('ryw+monotonic', 2)).toBe(
      'ryw+monotonic',
    )
  })

  it('clamps monotonic policies to ryw when readReplicas < 2', () => {
    expect(normalizeReadConsistencyForDeploy('monotonic', 0)).toBe('ryw')
    expect(normalizeReadConsistencyForDeploy('monotonic', 1)).toBe('ryw')
    expect(normalizeReadConsistencyForDeploy('ryw+monotonic', 1)).toBe('ryw')
  })

  it('falls back to leader-only for replica policies without replicas', () => {
    expect(normalizeReadConsistencyForDeploy('replica', 0)).toBe('leader-only')
    expect(normalizeReadConsistencyForDeploy('ryw', 0)).toBe('leader-only')
  })
})

describe('readConsistencyOptionDisabled', () => {
  it('disables replica policies without read replicas', () => {
    expect(readConsistencyOptionDisabled('leader-only', 0)).toBe(false)
    expect(readConsistencyOptionDisabled('replica', 0)).toBe(true)
    expect(readConsistencyOptionDisabled('ryw', 0)).toBe(true)
  })

  it('disables monotonic policies until two read replicas', () => {
    expect(readConsistencyOptionDisabled('monotonic', 0)).toBe(true)
    expect(readConsistencyOptionDisabled('monotonic', 1)).toBe(true)
    expect(readConsistencyOptionDisabled('monotonic', 2)).toBe(false)
    expect(readConsistencyOptionDisabled('ryw+monotonic', 1)).toBe(true)
    expect(readConsistencyOptionDisabled('ryw+monotonic', 2)).toBe(false)
  })
})

describe('defaultConfigForType database', () => {
  it('seeds readConsistency leader-only on new db nodes', () => {
    expect(defaultConfigForType('database').readConsistency).toBe(
      DEFAULT_READ_CONSISTENCY,
    )
  })
})
