import { describe, expect, it } from 'vitest'
import { FALLBACK_RESOURCE_PROFILES } from './resourceProfileCatalogFallback'
import {
  formatProvisionedLabel,
  formatProvisionedShort,
  resolveProvisionedLimits,
} from './resolveProvisionedLimits'

const catalog = FALLBACK_RESOURCE_PROFILES

describe('resolveProvisionedLimits', () => {
  it('db with no instanceSize uses component default (125m)', () => {
    const limits = resolveProvisionedLimits('database', {}, catalog)
    expect(limits.cpu).toBe('125m')
    expect(limits.memory).toBe('256Mi')
  })

  it('mq with no instanceSize uses component default (200m, not profile small)', () => {
    const limits = resolveProvisionedLimits('message_queue', {}, catalog)
    expect(limits.cpu).toBe('200m')
    expect(limits.memory).toBe('256Mi')
  })

  it('lb with no instanceSize uses component default (250m / 128Mi)', () => {
    const limits = resolveProvisionedLimits('load_balancer', {}, catalog)
    expect(limits.cpu).toBe('250m')
    expect(limits.memory).toBe('128Mi')
  })

  it('db with instanceSize large uses profile large', () => {
    const limits = resolveProvisionedLimits(
      'database',
      { instanceSize: 'large' },
      catalog,
    )
    expect(limits.cpu).toBe('500m')
    expect(limits.memory).toBe('1Gi')
  })

  it('compute with instanceSize medium uses profile medium', () => {
    const limits = resolveProvisionedLimits(
      'compute',
      { instanceSize: 'medium' },
      catalog,
    )
    expect(limits.cpu).toBe('250m')
    expect(limits.memory).toBe('512Mi')
  })

  it('lb with instanceSize small uses profile small (not component lb default)', () => {
    const limits = resolveProvisionedLimits(
      'load_balancer',
      { instanceSize: 'small' },
      catalog,
    )
    expect(limits.cpu).toBe('125m')
    expect(limits.memory).toBe('256Mi')
  })
})

describe('formatProvisionedLabel', () => {
  it('formats cpu and memory for inspector copy', () => {
    expect(formatProvisionedLabel(catalog.components.mq)).toBe(
      '200m CPU · 256Mi RAM',
    )
    expect(formatProvisionedShort(catalog.profiles.large)).toBe('500m · 1Gi')
  })
})

describe('FALLBACK_RESOURCE_PROFILES', () => {
  it('matches backend catalog mq cpu', () => {
    expect(catalog.components.mq.cpu).toBe('200m')
    expect(catalog.profiles.small.cpu).toBe('125m')
  })
})
