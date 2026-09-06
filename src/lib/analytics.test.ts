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

  it('captures deploy wait and admit fields', () => {
    trackEvent('deployment_requested', {
      template: 'url-shortener',
      hasLoadBalancer: false,
      hasCache: false,
      hasMessageQueue: false,
      hasWorker: false,
      appReplicas: 1,
      admitStatus: 'queued',
    })
    expect(capture).toHaveBeenCalledWith(
      'deployment_requested',
      expect.objectContaining({ admitStatus: 'queued' }),
    )

    trackEvent('deploy_wait_entered', {
      template: 'url-shortener',
      waitKind: 'door',
      queuePosition: 1,
      estimatedWaitSeconds: 40,
    })
    trackEvent('deploy_wait_left', {
      template: 'url-shortener',
      waitKind: 'door',
      outcome: 'promoted',
      waitSeconds: 12,
      queuePosition: 1,
    })
    trackEvent('deployment_failed', {
      template: 'url-shortener',
      phase: 'request',
      errorCategory: 'validation',
      rejectReason: 'design_exceeds_cluster',
    })
    expect(capture).toHaveBeenCalledWith(
      'deploy_wait_entered',
      expect.objectContaining({ waitKind: 'door', queuePosition: 1 }),
    )
    expect(capture).toHaveBeenCalledWith(
      'deployment_failed',
      expect.objectContaining({ rejectReason: 'design_exceeds_cluster' }),
    )

    trackEvent('overlay_minimized', {
      template: 'url-shortener',
      waitKind: 'room',
    })
    trackEvent('deploy_tab_signal_shown', {
      template: 'url-shortener',
      signalKind: 'running',
    })
    expect(capture).toHaveBeenCalledWith(
      'overlay_minimized',
      expect.objectContaining({ waitKind: 'room' }),
    )
    expect(capture).toHaveBeenCalledWith(
      'deploy_tab_signal_shown',
      expect.objectContaining({ signalKind: 'running' }),
    )
  })

  it('captures deploy assessment, blocked, and modal dismissed events', () => {
    trackEvent('deploy_assessment_shown', {
      template: 'ecommerce',
      assessmentVerdict: 'simulation_recommended',
    })
    trackEvent('deploy_blocked', {
      template: 'ecommerce',
      reason: 'resource_quota_exceeded',
    })
    trackEvent('deploy_modal_dismissed', {
      template: 'ecommerce',
      mode: 'simulation_recommended',
      action: 'simulate',
    })
    expect(capture).toHaveBeenCalledWith('deploy_assessment_shown', {
      template: 'ecommerce',
      assessmentVerdict: 'simulation_recommended',
    })
    expect(capture).toHaveBeenCalledWith('deploy_blocked', {
      template: 'ecommerce',
      reason: 'resource_quota_exceeded',
    })
    expect(capture).toHaveBeenCalledWith('deploy_modal_dismissed', {
      template: 'ecommerce',
      mode: 'simulation_recommended',
      action: 'simulate',
    })
  })

  it('identify and reset go through wrappers', () => {
    identifyAnalyticsUser('user-123', {
      effectiveTier: 'engineer',
      provider: 'google',
    })
    resetAnalytics()
    expect(identify).toHaveBeenCalledWith('user-123', {
      effectiveTier: 'engineer',
      provider: 'google',
    })
    expect(reset).toHaveBeenCalled()
  })

  it('captures auth and session lifecycle events', () => {
    trackEvent('auth_started', { provider: 'github' })
    trackEvent('auth_succeeded', {
      effectiveTier: 'explorer',
      provider: 'github',
      isNewUser: true,
    })
    trackEvent('auth_failed', { errorCategory: 'exchange_failed' })
    trackEvent('canvas_opened', {
      mode: 'new',
      authenticated: true,
      presetMode: 'explorer',
    })
    trackEvent('provision_tab_returned', {
      template: 'social-feed',
      waitKind: 'provisioning',
      hiddenSeconds: 8,
    })
    trackEvent('loadgen_stopped', { template: 'social-feed', liveSeconds: 42 })
    trackEvent('session_summary_viewed', {
      template: 'social-feed',
      sessionDuration: '3m 12s',
      usedLoadgen: true,
    })
    trackEvent('journey_panel_opened', {
      template: 'social-feed',
      context: 'design',
    })
    trackEvent('journey_selected', {
      template: 'social-feed',
      journeyId: 'feed-read',
      context: 'live',
    })
    trackEvent('walkthrough_started', {
      template: 'social-feed',
      journeyId: 'feed-read',
    })
    trackEvent('walkthrough_stopped', {
      template: 'social-feed',
      journeyId: 'feed-read',
      lastStepIndex: 2,
      stepCount: 5,
    })
    trackEvent('session_ended', {
      template: 'social-feed',
      reason: 'expired',
      durationSeconds: 540,
    })
    trackEvent('past_run_opened', { template: 'social-feed' })
    trackEvent('preset_mode_switched', {
      template: 'social-feed',
      from: 'full',
      to: 'explorer',
    })
    expect(capture).toHaveBeenCalledWith('auth_started', { provider: 'github' })
    expect(capture).toHaveBeenCalledWith(
      'provision_tab_returned',
      expect.objectContaining({ waitKind: 'provisioning' }),
    )
    expect(capture).toHaveBeenCalledWith(
      'loadgen_stopped',
      expect.objectContaining({ liveSeconds: 42 }),
    )
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
