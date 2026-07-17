import { describe, expect, it } from 'vitest'
import {
  defaultProxyResourceProfile,
  normalizeProxyInstanceSize,
  PROXY_RESOURCE_PROFILES,
  resolveProxyInstanceSize,
  resolveProxyProvisionedLimits,
  redisProfileFromConfig,
} from './cacheProxyResources'

describe('cacheProxyResources', () => {
  it('defaultProxyResourceProfile mirrors BE one-name default from Redis size', () => {
    expect(defaultProxyResourceProfile('small')).toBe('small')
    expect(defaultProxyResourceProfile('alpha')).toBe('small')
    expect(defaultProxyResourceProfile('')).toBe('small')
    expect(defaultProxyResourceProfile('medium')).toBe('medium')
    expect(defaultProxyResourceProfile('large')).toBe('large')
  })

  it('proxy amount table matches CacheProxyResources', () => {
    expect(PROXY_RESOURCE_PROFILES.small).toEqual({
      cpu: '250m',
      memory: '512Mi',
      ephemeralStorage: '100Mi',
    })
    expect(PROXY_RESOURCE_PROFILES.medium).toEqual({
      cpu: '500m',
      memory: '1Gi',
      ephemeralStorage: '200Mi',
    })
    expect(PROXY_RESOURCE_PROFILES.large).toEqual({
      cpu: '750m',
      memory: '1536Mi',
      ephemeralStorage: '200Mi',
    })
  })

  it('resolveProxyProvisionedLimits prefers explicit proxy size over Redis default', () => {
    expect(
      resolveProxyProvisionedLimits({
        instanceSize: 'large',
        proxyInstanceSize: 'small',
      }),
    ).toEqual(PROXY_RESOURCE_PROFILES.small)

    expect(
      resolveProxyProvisionedLimits({
        instanceSize: 'small',
        proxyResourceProfile: 'large',
      }),
    ).toEqual(PROXY_RESOURCE_PROFILES.large)

    // Unset → default from Redis medium → proxy medium (500m).
    expect(resolveProxyProvisionedLimits({ instanceSize: 'medium' })).toEqual(
      PROXY_RESOURCE_PROFILES.medium,
    )
  })

  it('redisProfileFromConfig prefers instanceSize then resourceProfile', () => {
    expect(redisProfileFromConfig({ instanceSize: 'large' })).toBe('large')
    expect(redisProfileFromConfig({ resourceProfile: 'medium' })).toBe('medium')
    expect(redisProfileFromConfig({})).toBe('small')
  })

  it('normalizeProxyInstanceSize falls back to small', () => {
    expect(normalizeProxyInstanceSize('medium')).toBe('medium')
    expect(normalizeProxyInstanceSize('nope')).toBe('small')
    expect(resolveProxyInstanceSize({})).toBe('small')
  })
})
