import { describe, expect, it } from 'vitest'
import { parseScaleStatus, scaleReplicaLabel } from './scaleStatus'

describe('scaleReplicaLabel', () => {
  it('returns null when scale is null', () => {
    expect(scaleReplicaLabel(null)).toBeNull()
  })

  it('returns null when desired equals ready', () => {
    expect(scaleReplicaLabel({ desired: 2, ready: 2 })).toBeNull()
  })

  it('formats desired and ready when they differ', () => {
    expect(scaleReplicaLabel({ desired: 2, ready: 1 })).toBe('2 desired · 1 ready')
  })
})

describe('parseScaleStatus', () => {
  it('returns null when desired is missing or zero', () => {
    expect(parseScaleStatus(undefined)).toBeNull()
    expect(parseScaleStatus({ desired: 0, ready: 1 })).toBeNull()
  })

  it('parses positive desired and ready', () => {
    expect(parseScaleStatus({ desired: 3, ready: 2 })).toEqual({
      desired: 3,
      ready: 2,
    })
  })
})
