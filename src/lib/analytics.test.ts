import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  __resetAnalyticsForTests,
  __setAnalyticsClientForTests,
  categorizeSafeError,
  deploymentAnalyticsProperties,
  identifyAnalyticsUser,
  referrerCategory,
  resetAnalytics,
  trackEvent,
  utmFieldsFromSearch,
} from './analytics'
import type { DeploymentDesign } from './deploymentTypes'
import { ApiError } from './apiError'

describe('analytics wrappers', () => {
  const capture = vi.fn()
  const identify = vi.fn()
  const reset = vi.fn()

  beforeEach(() => {
    capture.mockReset()
    identify.mockReset()
    reset.mockReset()
    __resetAnalyticsForTests()
    __setAnalyticsClientForTests({
      init: vi.fn(),
      capture,
      identify,
      reset,
    })
  })

  it('trackEvent forwards typed events to the client', () => {
    trackEvent('landing_cta_clicked', { ctaName: 'start_building' })
    expect(capture).toHaveBeenCalledWith('landing_cta_clicked', {
      ctaName: 'start_building',
    })
  })

  it('identify and reset go through wrappers', () => {
    identifyAnalyticsUser('user-123', { effectiveTier: 'engineer' })
    resetAnalytics()
    expect(identify).toHaveBeenCalledWith('user-123', {
      effectiveTier: 'engineer',
    })
    expect(reset).toHaveBeenCalled()
  })

  it('deploymentAnalyticsProperties allowlists design fields only', () => {
    const design: DeploymentDesign = {
      version: '1.0',
      template: 'url-shortener',
      archetype: 'standard',
      nodes: [
        {
          id: 'secret-node-id',
          type: 'app-server',
          name: 'App',
          config: { replicas: 2, instanceSize: 'medium' },
        },
        {
          id: 'cache-id',
          type: 'cache',
          name: 'Redis',
          config: {
            cacheStrategy: 'write-through',
            evictionPolicy: 'allkeys-lru',
            instanceSize: 'small',
            proxyInstanceSize: 'medium',
          },
        },
        { id: 'lb-id', type: 'lb', name: 'LB', config: {} },
        { id: 'mq-id', type: 'mq', name: 'MQ', config: {} },
        {
          id: 'worker-id',
          type: 'worker',
          name: 'Worker',
          config: { replicas: 3 },
        },
      ],
      connections: [
        { sourceId: 'lb-id', targetId: 'secret-node-id', protocol: 'http' },
      ],
    }
    const props = deploymentAnalyticsProperties(design)
    expect(props).toEqual({
      template: 'url-shortener',
      archetype: 'standard',
      hasLoadBalancer: true,
      hasCache: true,
      cacheStrategy: 'write-through',
      evictionPolicy: 'allkeys-lru',
      hasMessageQueue: true,
      hasWorker: true,
      appReplicas: 2,
      workerReplicas: 3,
      appResourceProfile: 'medium',
      cacheResourceProfile: 'small',
      proxyResourceProfile: 'medium',
    })
    expect(JSON.stringify(props)).not.toContain('secret-node-id')
    expect(JSON.stringify(props)).not.toContain('connections')
  })
})

describe('analytics helpers', () => {
  it('categorizes safe errors without leaking messages', () => {
    expect(categorizeSafeError(new ApiError(401, 'nope'))).toBe('unauthorized')
    expect(categorizeSafeError(new ApiError(422, 'bad design details'))).toBe(
      'validation',
    )
    expect(categorizeSafeError(new ApiError(429, 'quota exceeded forever'))).toBe(
      'quota',
    )
    expect(categorizeSafeError(new Error('Failed to fetch'))).toBe('network')
  })

  it('parses UTM and referrer categories', () => {
    expect(utmFieldsFromSearch('?utm_source=gh&utm_medium=social&utm_campaign=launch')).toEqual({
      utmSource: 'gh',
      utmMedium: 'social',
      utmCampaign: 'launch',
    })
    expect(referrerCategory('')).toBe('direct')
    expect(referrerCategory('https://www.google.com/search?q=x')).toBe('search')
  })
})
