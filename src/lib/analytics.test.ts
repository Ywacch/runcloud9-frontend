import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  __resetAnalyticsForTests,
  __setAnalyticsClientForTests,
  __analyticsInitAttemptedForTests,
  authStartedTrigger,
  categorizeSafeError,
  deploymentAnalyticsProperties,
  getDesignOptionSession,
  identifyAnalyticsUser,
  initAnalytics,
  referrerCategory,
  resetAnalytics,
  trackEvent,
  utmFieldsFromSearch,
} from './analytics'
import type { DeploymentDesign } from './deploymentTypes'
import { ApiError } from './apiError'
import {
  __resetCookieConsentForTests,
  setCookieConsent,
} from './cookieConsent'

function installLocalStorageMock() {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
  })
}

describe('analytics wrappers', () => {
  const capture = vi.fn()
  const identify = vi.fn()
  const reset = vi.fn()

  beforeEach(() => {
    installLocalStorageMock()
    capture.mockReset()
    identify.mockReset()
    reset.mockReset()
    __resetCookieConsentForTests()
    __resetAnalyticsForTests()
    setCookieConsent('all')
    __setAnalyticsClientForTests({
      init: vi.fn(),
      capture,
      identify,
      reset,
    })
  })

  it('does not capture events without analytics consent', () => {
    __resetCookieConsentForTests()
    trackEvent('landing_cta_clicked', { ctaName: 'start_building' })
    expect(capture).not.toHaveBeenCalled()
  })

  it('initAnalytics can run after consent is granted', async () => {
    __resetCookieConsentForTests()
    __resetAnalyticsForTests()
    vi.stubEnv('VITE_POSTHOG_KEY', '')

    await initAnalytics()
    expect(__analyticsInitAttemptedForTests()).toBe(false)

    setCookieConsent('all')
    await initAnalytics()
    expect(__analyticsInitAttemptedForTests()).toBe(true)
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
      deploymentId: 'dep-1',
      knobsChanged: false,
      knobCount: 0,
    })
    expect(capture).toHaveBeenCalledWith(
      'deployment_requested',
      expect.objectContaining({
        admitStatus: 'queued',
        deploymentId: 'dep-1',
        knobCount: 0,
      }),
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
      wait_duration_ms: 12000,
      deployment_status_at_exit: 'provisioning',
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
    trackEvent('deploy_blocked', {
      template: 'ecommerce',
      reason: 'auth_required',
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
    expect(capture).toHaveBeenCalledWith('deploy_blocked', {
      template: 'ecommerce',
      reason: 'auth_required',
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
      email: 'a@b.co',
      $email: 'a@b.co',
      name: 'Ada',
      created_at: '2026-01-01T00:00:00Z',
    })
    resetAnalytics()
    expect(identify).toHaveBeenCalledWith('user-123', {
      effectiveTier: 'engineer',
      provider: 'google',
      email: 'a@b.co',
      $email: 'a@b.co',
      name: 'Ada',
      created_at: '2026-01-01T00:00:00Z',
    })
    expect(reset).toHaveBeenCalled()
  })

  it('captures auth and session lifecycle events', () => {
    trackEvent('auth_started', { provider: 'github', trigger: 'dashboard' })
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
      highlightCount: 2,
      hadCascade: false,
    })
    trackEvent('session_summary_dismissed', {
      template: 'social-feed',
      visibleSeconds: 12,
      lastSlideIndex: 1,
      slideCount: 4,
      lastSlideGroup: 'outcome',
      action: 'redeploy',
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
      stepReached: 3,
    })
    trackEvent('deployment_succeeded', {
      template: 'social-feed',
      deploymentId: 'dep-99',
      duration_ms: 180000,
      status: 'success',
    })
    trackEvent('session_ended', {
      template: 'social-feed',
      reason: 'expired',
      durationSeconds: 540,
      durationMs: 540000,
      hadLoadgen: true,
      chaosCount: 1,
    })
    trackEvent('past_run_opened', { template: 'social-feed' })
    trackEvent('preset_mode_switched', {
      template: 'social-feed',
      from: 'full',
      to: 'explorer',
    })
    expect(capture).toHaveBeenCalledWith('auth_started', {
      provider: 'github',
      trigger: 'dashboard',
    })
    expect(capture).toHaveBeenCalledWith(
      'provision_tab_returned',
      expect.objectContaining({ waitKind: 'provisioning' }),
    )
    expect(capture).toHaveBeenCalledWith(
      'loadgen_stopped',
      expect.objectContaining({ liveSeconds: 42 }),
    )
  })

  it('captures deploy_wait_left abandoned with wait_duration_ms', () => {
    trackEvent('deploy_wait_left', {
      template: 'url-shortener',
      waitKind: 'provisioning',
      outcome: 'abandoned',
      waitSeconds: 45,
      wait_duration_ms: 45000,
      deployment_status_at_exit: 'provisioning',
      deploymentId: 'dep-abandon',
    })
    expect(capture).toHaveBeenCalledWith(
      'deploy_wait_left',
      expect.objectContaining({
        outcome: 'abandoned',
        wait_duration_ms: 45000,
      }),
    )
  })

  it('tracks design_option_changed in session counters', () => {
    trackEvent('design_option_changed', {
      template: 'url-shortener',
      optionName: 'replicas',
      previousCategory: '1',
      newCategory: '2',
    })
    expect(getDesignOptionSession().knobCount).toBe(1)
    __resetAnalyticsForTests()
    setCookieConsent('all')
    __setAnalyticsClientForTests({
      init: vi.fn(),
      capture,
      identify,
      reset,
    })
    expect(getDesignOptionSession().knobCount).toBe(0)
  })

  it('authStartedTrigger maps return paths', () => {
    expect(
      authStartedTrigger({ pendingDeployAfterAuth: true, authReturnPath: '/dashboard' }),
    ).toBe('deploy')
    expect(
      authStartedTrigger({ pendingDeployAfterAuth: false, authReturnPath: '/dashboard' }),
    ).toBe('dashboard')
    expect(
      authStartedTrigger({ pendingDeployAfterAuth: false, authReturnPath: '/canvas' }),
    ).toBe('deploy')
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
