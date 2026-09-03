import type {
  ActiveDeploymentSummary,
  CurrentUserResponse,
  DeploymentHistoryItem,
  DeploymentRecord,
} from './api'

/** Vite dev only. Tree-shaken from production builds. */
export function isDevAccountPreviewEnabled(): boolean {
  return import.meta.env.DEV
}

/** Dashboard / profile chrome when unsigned in Vite dev. */
export function hasDevAccountAccess(session: unknown): boolean {
  return Boolean(session) || isDevAccountPreviewEnabled()
}

export function shouldUseDevAccountFixtures(accessToken: string | null): boolean {
  return isDevAccountPreviewEnabled() && !accessToken
}

/** After a live API outage in Vite dev. Keep 4xx so authz still fails. */
export function shouldFallbackToDevAccountFixtures(status?: number): boolean {
  if (!isDevAccountPreviewEnabled()) return false
  if (status == null) return true
  return status >= 500
}

export const DEV_ENGINEER_USER: CurrentUserResponse = {
  userId: 'dev-preview-user',
  isInternal: false,
  isPremium: true,
  premiumExpiresAt: '2027-12-31T00:00:00Z',
  effectiveTier: 'engineer',
  quotaTier: 'engineer',
  limits: {
    maxConcurrent: 1,
    sessionDefaultMins: 9,
    sessionCapMins: 15,
    maxSessionsPerMonth: 20,
    allTemplates: true,
    maxAppServerReplicas: 3,
    allowLoadBalancer: true,
    allowMQWorker: true,
    allowProxyCache: true,
    maxInstanceSize: 'large',
  },
  sessionsUsedThisMonth: 4,
  sessionsRemainingThisMonth: 16,
}

function isoMinutesAgo(minutes: number, now = Date.now()): string {
  return new Date(now - minutes * 60_000).toISOString()
}

export function devActiveDeployments(now = Date.now()): ActiveDeploymentSummary[] {
  const createdAt = isoMinutesAgo(18, now)
  const expiresAt = new Date(now + 9 * 60_000).toISOString()
  return [
    {
      id: 'cloud9-social-feed-devpreview-a1b2c3',
      namespace: 'cloud9-social-feed-devpreview-a1b2c3',
      template: 'social-feed',
      status: 'running',
      createdAt,
      expiresAt,
    },
  ]
}

export function devDeploymentHistory(
  limit = 20,
  now = Date.now(),
): DeploymentHistoryItem[] {
  const clamped = Math.min(50, Math.max(1, Math.floor(Number(limit) || 20)))
  const rows: DeploymentHistoryItem[] = [
    {
      id: 'cloud9-url-shortener-devpreview-c4d5e6',
      namespace: 'cloud9-url-shortener-devpreview-c4d5e6',
      template: 'url-shortener',
      archetype: 'live',
      status: 'terminated',
      createdAt: isoMinutesAgo(140, now),
      expiresAt: isoMinutesAgo(140 - 9, now),
      terminatedAt: isoMinutesAgo(131, now),
      durationSeconds: 540,
      peakRps: 86,
      peakP99Ms: 24,
    },
    {
      id: 'cloud9-ecommerce-devpreview-f7g8h9',
      namespace: 'cloud9-ecommerce-devpreview-f7g8h9',
      template: 'ecommerce',
      archetype: 'live',
      status: 'terminated',
      createdAt: isoMinutesAgo(26 * 60, now),
      expiresAt: isoMinutesAgo(26 * 60 - 9, now),
      terminatedAt: isoMinutesAgo(26 * 60 - 9, now),
      durationSeconds: 540,
      peakRps: 210,
      peakP99Ms: 61,
    },
    {
      id: 'cloud9-social-feed-pull-devpreview-j0k1l2',
      namespace: 'cloud9-social-feed-pull-devpreview-j0k1l2',
      template: 'social-feed-pull',
      archetype: 'live',
      status: 'failed',
      createdAt: isoMinutesAgo(3 * 24 * 60, now),
      expiresAt: isoMinutesAgo(3 * 24 * 60 - 4, now),
      terminatedAt: isoMinutesAgo(3 * 24 * 60 - 6, now),
      durationSeconds: 180,
      peakRps: 44,
      peakP99Ms: 190,
    },
    {
      id: 'cloud9-url-shortener-devpreview-m3n4o5',
      namespace: 'cloud9-url-shortener-devpreview-m3n4o5',
      template: 'url-shortener',
      archetype: 'live',
      status: 'terminated',
      createdAt: isoMinutesAgo(12 * 24 * 60, now),
      expiresAt: isoMinutesAgo(12 * 24 * 60 - 9, now),
      terminatedAt: isoMinutesAgo(12 * 24 * 60 - 9, now),
      durationSeconds: 540,
      peakRps: 72,
      peakP99Ms: 31,
    },
  ]
  return rows.slice(0, clamped)
}

const DEV_METRICS_BY_TEMPLATE: Record<string, Record<string, unknown>> = {
  'url-shortener': {
    peak_rps: 86,
    peak_p99_ms: 24,
    total_requests: 41200,
    cache_hit_rate: 81,
    error_rate: 0.4,
    actual_duration_seconds: 540,
  },
  ecommerce: {
    peak_rps: 210,
    peak_p99_ms: 61,
    total_requests: 98000,
    cache_hit_rate: 64,
    error_rate: 1.2,
    actual_duration_seconds: 540,
  },
  'social-feed': {
    peak_rps: 128,
    peak_p99_ms: 42,
    total_requests: 67000,
    cache_hit_rate: 58,
    error_rate: 0.8,
    actual_duration_seconds: 540,
  },
  'social-feed-pull': {
    peak_rps: 44,
    peak_p99_ms: 190,
    total_requests: 8200,
    cache_hit_rate: 22,
    error_rate: 8.5,
    actual_duration_seconds: 180,
  },
}

export function devDeploymentRecord(
  id: string,
  now = Date.now(),
): DeploymentRecord | null {
  const active = devActiveDeployments(now).find(
    (row) => row.id === id || row.namespace === id,
  )
  if (active) {
    return {
      id: active.id,
      namespace: active.namespace,
      status: active.status,
      expiresAt: active.expiresAt,
      template: active.template,
    }
  }
  const history = devDeploymentHistory(50, now).find(
    (row) => row.id === id || row.namespace === id,
  )
  if (!history) return null
  return {
    id: history.id,
    namespace: history.namespace,
    status: history.status,
    expiresAt: history.expiresAt,
    template: history.template,
    metricsSummary: DEV_METRICS_BY_TEMPLATE[history.template],
  }
}

export function applyDevAccountPreviewUser(
  setCurrentUser: (me: CurrentUserResponse | null) => void,
  session: { user?: { id?: string } } | null | undefined,
): void {
  if (!isDevAccountPreviewEnabled()) return
  if (session?.user?.id) return
  setCurrentUser(DEV_ENGINEER_USER)
}
