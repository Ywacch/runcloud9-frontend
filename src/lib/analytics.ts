import type { DeploymentDesign } from './deploymentTypes'
import { hasAnalyticsConsent } from './cookieConsent'

const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com'

export interface DeploymentAnalyticsProperties {
  template: string
  archetype?: string
  hasLoadBalancer: boolean
  hasCache: boolean
  cacheStrategy?: string
  evictionPolicy?: string
  hasMessageQueue: boolean
  hasWorker: boolean
  appReplicas: number
  workerReplicas?: number
  appResourceProfile?: string
  cacheResourceProfile?: string
  proxyResourceProfile?: string
}

export type OAuthAnalyticsProvider = 'google' | 'github'

export type AuthFailedCategory =
  | 'oauth_denied'
  | 'signups_disabled'
  | 'exchange_failed'

export type AnalyticsPresetMode = 'full' | 'explorer'

export type AnalyticsEventMap = {
  landing_viewed: {
    referrerCategory: string
    utmSource?: string
    utmMedium?: string
    utmCampaign?: string
  }
  landing_cta_clicked: { ctaName: string }
  login_viewed: Record<string, never>
  auth_started: { provider: OAuthAnalyticsProvider }
  auth_succeeded: {
    effectiveTier: string
    provider?: OAuthAnalyticsProvider
    isNewUser: boolean
  }
  auth_failed: { errorCategory: AuthFailedCategory | SafeErrorCategory }
  canvas_opened: {
    mode: 'new' | 'restored'
    authenticated: boolean
    presetMode?: AnalyticsPresetMode
  }
  template_selected: { template: string; archetype: string }
  deployment_requested: DeploymentAnalyticsProperties & {
    admitStatus: 'provisioning' | 'queued'
    presetMode?: AnalyticsPresetMode
  }
  deployment_running: { template: string; elapsedSeconds: number }
  deployment_failed: {
    template: string
    phase: 'request' | 'provision'
    errorCategory: string
    rejectReason?:
      | 'design_exceeds_cluster'
      | 'queue_full'
      | 'concurrent_active'
      | 'monthly_session_limit'
      | 'resource_budget'
      | 'email_unconfirmed'
  }
  deploy_wait_entered: {
    template: string
    waitKind: 'room' | 'door' | 'provisioning'
    queuePosition?: number
    estimatedWaitSeconds?: number
  }
  deploy_wait_left: {
    template: string
    waitKind: 'room' | 'door' | 'provisioning'
    outcome: 'promoted' | 'cancelled' | 'failed' | 'terminated'
    waitSeconds: number
    queuePosition?: number
  }
  provision_tab_returned: {
    template: string
    waitKind: 'room' | 'door' | 'provisioning'
    hiddenSeconds: number
  }
  session_summary_viewed: {
    template: string
    sessionDuration: string
    usedLoadgen: boolean
  }
  session_summary_dismissed: { template: string; visibleSeconds: number }
  loadgen_started: {
    template: string
    rps: number
    durationSeconds: number
    scheduleId?: string
  }
  loadgen_stopped: { template: string; liveSeconds: number }
  journey_panel_opened: { template: string; context: 'design' | 'live' }
  journey_selected: {
    template: string
    journeyId: string
    context: 'design' | 'live'
  }
  walkthrough_started: { template: string; journeyId: string }
  walkthrough_stopped: {
    template: string
    journeyId: string
    lastStepIndex: number
    stepCount: number
  }
  session_ended: {
    template: string
    reason: 'expired' | 'user_teardown' | 'failed'
    durationSeconds: number
  }
  past_run_opened: { template: string }
  preset_mode_switched: {
    template: string
    from: AnalyticsPresetMode
    to: AnalyticsPresetMode
  }
  chaos_injected: {
    template: string
    chaosKind: string
    targetComponentType: string
  }
  component_inspector_opened: { template: string; componentType: string }
  data_inspector_used: {
    template: string
    componentType: string
    operationCategory: string
  }
  design_option_changed: {
    template: string
    optionName: string
    previousCategory: string
    newCategory: string
  }
  overlay_minimized: {
    template: string
    waitKind?: 'room' | 'door' | 'provisioning'
  }
  overlay_expanded: {
    template: string
    waitKind?: 'room' | 'door' | 'provisioning'
  }
  deploy_tab_signal_shown: {
    template: string
    signalKind: 'room_to_provisioning' | 'running' | 'failed'
  }
  canvas_help_opened: Record<string, never>
  deploy_assessment_shown: {
    template: string
    assessmentVerdict: 'simulation_recommended'
  }
  deploy_blocked: {
    template: string
    reason: DeployBlockedReason
  }
  deploy_modal_dismissed: {
    template: string
    mode: 'request_rejected' | 'simulation_recommended'
    action: 'close' | 'dismiss' | 'simulate' | 'modify'
  }
}

export type DeployBlockedReason =
  | 'empty_canvas'
  | 'no_template'
  | 'template_loading'
  | 'template_not_deployable'
  | 'template_not_available'
  | 'resource_quota_exceeded'
  | 'topology_violation'
  | 'monthly_session_limit'

export type AnalyticsEventName = keyof AnalyticsEventMap

type PostHogClient = {
  init: (key: string, config: Record<string, unknown>) => void
  capture: (event: string, properties?: Record<string, unknown>) => void
  identify: (distinctId: string, properties?: Record<string, unknown>) => void
  reset: () => void
}

let client: PostHogClient | null = null
let initAttempted = false

function debugEnabled(): boolean {
  return String(import.meta.env.VITE_ANALYTICS_DEBUG ?? '') === '1'
}

function debugLog(event: string, properties?: Record<string, unknown>): void {
  if (!debugEnabled()) return
  // Explicit opt-in only — never auto-log in production.
  console.info('[analytics]', event, properties ?? {})
}

export function isAnalyticsEnabled(): boolean {
  const key = import.meta.env.VITE_POSTHOG_KEY
  return typeof key === 'string' && key.trim().length > 0
}

/** Initialize PostHog when a key is present. Safe no-op without a key. */
export async function initAnalytics(): Promise<void> {
  if (initAttempted) return
  if (!hasAnalyticsConsent()) return
  initAttempted = true
  if (!isAnalyticsEnabled()) return
  const key = String(import.meta.env.VITE_POSTHOG_KEY).trim()
  const host =
    (typeof import.meta.env.VITE_POSTHOG_HOST === 'string' &&
      import.meta.env.VITE_POSTHOG_HOST.trim()) ||
    DEFAULT_POSTHOG_HOST
  try {
    const mod = await import('posthog-js')
    const posthog = mod.default as unknown as PostHogClient
    posthog.init(key, {
      api_host: host,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      persistence: 'localStorage+cookie',
    })
    client = posthog
  } catch (err) {
    console.warn('analytics init failed:', err)
    client = null
  }
}

export function identifyAnalyticsUser(
  userId: string,
  traits?: { effectiveTier?: string; provider?: OAuthAnalyticsProvider },
): void {
  if (!userId.trim()) return
  if (!hasAnalyticsConsent()) return
  if (client) {
    client.identify(userId, traits)
  }
  debugLog('identify', { userId, ...traits })
}

export function resetAnalytics(): void {
  if (client) client.reset()
  debugLog('reset')
}

export function trackEvent<E extends AnalyticsEventName>(
  event: E,
  properties: AnalyticsEventMap[E],
): void {
  const props = properties as Record<string, unknown>
  if (!hasAnalyticsConsent()) return
  if (client) client.capture(event, props)
  debugLog(event, props)
}

let sessionEndedForDeploymentId: string | null = null

/** Fire session_ended at most once per deployment id (or once with no id). */
export function trackSessionEndedOnce(
  deploymentId: string | null | undefined,
  properties: AnalyticsEventMap['session_ended'],
): void {
  const key = deploymentId ?? '__none__'
  if (sessionEndedForDeploymentId === key) return
  sessionEndedForDeploymentId = key
  trackEvent('session_ended', properties)
}

export function analyticsPresetModeFromStore(
  mode: 'full' | 'explorer' | null,
): AnalyticsPresetMode | undefined {
  return mode === 'full' || mode === 'explorer' ? mode : undefined
}

export function sessionEndedDurationSeconds(
  liveSessionStartedAt: number | null,
): number {
  if (liveSessionStartedAt == null) return 0
  return Math.max(0, Math.floor((Date.now() - liveSessionStartedAt) / 1000))
}

/** Allowlisted design summary for deployment_requested — no node IDs or edges. */
export function deploymentAnalyticsProperties(
  design: DeploymentDesign,
): DeploymentAnalyticsProperties {
  const nodes = design.nodes ?? []
  const lb = nodes.find((n) => n.type === 'lb')
  const cache = nodes.find((n) => n.type === 'cache')
  const mq = nodes.find((n) => n.type === 'mq')
  const worker = nodes.find((n) => n.type === 'worker')
  const app = nodes.find((n) => n.type === 'app-server')

  const cacheStrategy = cache
    ? String(cache.config.cacheStrategy ?? cache.config.strategy ?? '').trim() ||
      undefined
    : undefined
  const evictionPolicy = cache
    ? String(cache.config.evictionPolicy ?? '').trim() || undefined
    : undefined
  const appReplicas = Math.max(
    1,
    Math.floor(Number(app?.config.replicas ?? 1)) || 1,
  )
  const workerReplicasRaw = worker
    ? Math.floor(Number(worker.config.replicas ?? 1))
    : undefined

  const out: DeploymentAnalyticsProperties = {
    template: String(design.template ?? '').trim() || 'unknown',
    hasLoadBalancer: Boolean(lb),
    hasCache: Boolean(cache),
    hasMessageQueue: Boolean(mq),
    hasWorker: Boolean(worker),
    appReplicas,
  }
  const archetype = String(design.archetype ?? '').trim()
  if (archetype) out.archetype = archetype
  if (cacheStrategy) out.cacheStrategy = cacheStrategy
  if (evictionPolicy) out.evictionPolicy = evictionPolicy
  if (workerReplicasRaw != null && Number.isFinite(workerReplicasRaw)) {
    out.workerReplicas = Math.max(1, workerReplicasRaw)
  }
  const appProfile = String(
    app?.config.resourceProfile ?? app?.config.instanceSize ?? '',
  ).trim()
  if (appProfile) out.appResourceProfile = appProfile
  const cacheProfile = String(
    cache?.config.resourceProfile ?? cache?.config.instanceSize ?? '',
  ).trim()
  if (cacheProfile) out.cacheResourceProfile = cacheProfile
  const proxyProfile = String(
    cache?.config.proxyResourceProfile ?? cache?.config.proxyInstanceSize ?? '',
  ).trim()
  if (proxyProfile) out.proxyResourceProfile = proxyProfile
  return out
}

export type SafeErrorCategory =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'quota'
  | 'network'
  | 'server'
  | 'unknown'

/** Map errors to coarse categories — never free-form backend text. */
export function categorizeSafeError(err: unknown): SafeErrorCategory {
  if (!err) return 'unknown'
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const status = Number((err as { status: unknown }).status)
    if (status === 401) return 'unauthorized'
    if (status === 403) return 'forbidden'
    if (status === 404) return 'not_found'
    if (status === 422) return 'validation'
    if (status === 429) return 'quota'
    if (status >= 500) return 'server'
    if (status >= 400) return 'validation'
  }
  const msg = err instanceof Error ? err.message : String(err)
  const lower = msg.toLowerCase()
  if (lower.includes('network') || lower.includes('fetch')) return 'network'
  if (lower.includes('quota') || lower.includes('budget')) return 'quota'
  return 'unknown'
}

export function referrerCategory(referrer = document.referrer): string {
  if (!referrer) return 'direct'
  try {
    const host = new URL(referrer).hostname.toLowerCase()
    if (host.includes('google.') || host.includes('bing.') || host.includes('duckduckgo.')) {
      return 'search'
    }
    if (
      host.includes('twitter.') ||
      host.includes('x.com') ||
      host.includes('linkedin.') ||
      host.includes('reddit.') ||
      host.includes('facebook.')
    ) {
      return 'social'
    }
    if (host === window.location.hostname) return 'internal'
    return 'referral'
  } catch {
    return 'unknown'
  }
}

export function utmFieldsFromSearch(
  search = window.location.search,
): Pick<
  AnalyticsEventMap['landing_viewed'],
  'utmSource' | 'utmMedium' | 'utmCampaign'
> {
  const params = new URLSearchParams(search)
  const out: ReturnType<typeof utmFieldsFromSearch> = {}
  const source = params.get('utm_source')?.trim()
  const medium = params.get('utm_medium')?.trim()
  const campaign = params.get('utm_campaign')?.trim()
  if (source) out.utmSource = source
  if (medium) out.utmMedium = medium
  if (campaign) out.utmCampaign = campaign
  return out
}

/** Test helper — clears init state between tests. */
export function __resetAnalyticsForTests(): void {
  client = null
  initAttempted = false
  sessionEndedForDeploymentId = null
}

/** Test helper — whether initAnalytics has marked initialization attempted. */
export function __analyticsInitAttemptedForTests(): boolean {
  return initAttempted
}

/** Test helper — inject a fake PostHog client. */
export function __setAnalyticsClientForTests(fake: PostHogClient | null): void {
  client = fake
  initAttempted = true
}
