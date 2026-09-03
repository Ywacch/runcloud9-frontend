import { getAccessToken } from './auth'
import { ApiError } from './apiError'
import {
  DEV_ENGINEER_USER,
  devActiveDeployments,
  devDeploymentHistory,
  devDeploymentRecord,
  shouldFallbackToDevAccountFixtures,
  shouldUseDevAccountFixtures,
} from './devAccountPreview'
import type { ChaosAppliedResponse, ChaosRequest } from './chaos'
import type { DeploymentDesign, ResourceProfilesResponse } from './deploymentTypes'
import { ResourceBudgetApiError } from './resourceBudgetError'
import { isResourceBudgetErrorResponse } from './sumDesignBudget'
import type { StorytellingSpec } from './storytellingTypes'
import type { TopologyRulesResponse } from './topologyRulesTypes'

export type {
  DeploymentConn,
  DeploymentDesign,
  DeploymentNode,
  ResourceLimitsJSON,
  ResourceProfilesResponse,
} from './deploymentTypes'

/**
 * Same-origin prefix for deployment APIs (`/deployments/...`).
 * Override with `VITE_DEPLOYMENTS_API_PREFIX` when the dashboard is served from a different host than the API.
 */
export const DEPLOYMENTS_API_PREFIX =
  (import.meta.env.VITE_DEPLOYMENTS_API_PREFIX as string | undefined)?.replace(
    /\/$/,
    '',
  ) ?? '/deployments'

const API_BASE = DEPLOYMENTS_API_PREFIX

function authHeader(): Record<string, string> | undefined {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : undefined
}

export function buildWsBaseForApi(apiBase: string, current: Location): string {
  if (/^https?:\/\//i.test(apiBase)) {
    const parsed = new URL(apiBase)
    const proto = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${parsed.host}${parsed.pathname}`
  }
  const proto = current.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${current.host}${apiBase}`
}

export interface TopologyWarning {
  code: string
  message: string
  nodeIds?: string[]
  edgeIds?: string[]
}

export interface CreateAssessment {
  verdict: string
  explanation: string
  warnings?: TopologyWarning[]
}

export interface DeploymentResult {
  deploymentId: string
  namespace: string
  status: string
  /** Present when status === 'queued'. */
  queuePosition?: number
  /** Present when status === 'queued' (rough ETA). */
  estimatedWaitSeconds?: number
  seeded?: boolean
  error?: string
  assessment?: CreateAssessment
}

export interface LoadProfile {
  rps: number
  durationSeconds?: number
  template?: string
  baseUrl?: string
  distribution?: Record<string, number>
  scheduleId?: string
  actorParams?: Record<string, number>
}

export interface LoadgenPhaseSpec {
  durationSeconds: number
  rpsMultiplier: number
  endpointBoost?: Record<string, number>
  actorOverride?: Record<string, number>
  note?: string
}

export interface LoadgenScheduleSpec {
  id: string
  label: string
  phases: LoadgenPhaseSpec[]
}

export interface LoadgenActorParamSpec {
  key: string
  type: string
  default: number
  min?: number
  max?: number
  pools?: { name: string; poolEndpoint: string; poolField: string }[]
  applyTo?: string[]
  tier?: string
}

export interface LoadgenEndpointSpec {
  method: string
  pathTemplate: string
  weight: number
}

/** Projected load UI config from GET /templates/{id}/loadgen. */
export interface LoadgenConfigView {
  defaultRps?: number
  endpoints?: LoadgenEndpointSpec[]
  params?: LoadgenActorParamSpec[]
  schedules?: LoadgenScheduleSpec[]
}

export interface TemplateInfo {
  id: string
  name: string
  description: string
  components: number
  bottleneck: string
  /** Explorer/free-tier modal copy when presetLite differs from full preset. */
  descriptionLite?: string
  componentsLite?: number
  bottleneckLite?: string
  available: boolean
  premium: boolean
  simulatable: boolean
  deployable: boolean
  tags: string[]
  preset?: TemplatePreset
  /** Explorer/free-tier canvas variant (app + cache + db, no LB/MQ/worker). */
  presetLite?: TemplatePreset
  /** Named topology graphs for the variation picker (PR2). */
  variations?: TemplateVariation[]
  /** Template-scoped storytelling (journeys, roles, narrative hints) from GET /templates. */
  storytelling?: StorytellingSpec | null
  /** Default load-generator RPS for this template (from GET /templates). */
  loadgenDefaultRps?: number
  /** False when template has no worker image (mq/worker edges are decorative). */
  supportsWorker?: boolean
  /** Per-component introspection config (tables, Redis key patterns, etc.). */
  introspection?: Record<
    string,
    {
      engine: string
      tables?: string[]
      keyPatterns?: string[]
      queues?: string[]
    }
  >
}

export interface TemplatePresetNode {
  id: string
  type: string
  position: [number, number, number]
  label: string
  config: Record<string, unknown>
}

export interface TemplatePresetEdge {
  id: string
  sourceId: string
  targetId: string
  protocol: string
}

export interface TemplatePreset {
  nodes: TemplatePresetNode[]
  edges: TemplatePresetEdge[]
}

export interface TemplateVariation {
  id: string
  label: string
  description: string
  nodes: TemplatePresetNode[]
  edges: TemplatePresetEdge[]
}

export { ApiError } from './apiError'
export type {
  ResourceBudgetErrorResponse,
  ResourceBudgetLine,
} from './sumDesignBudget'
export {
  ResourceBudgetApiError,
  isResourceBudgetApiError,
} from './resourceBudgetError'
export { isResourceBudgetErrorResponse } from './sumDesignBudget'

function templatesApiBase(): string {
  return DEPLOYMENTS_API_PREFIX.replace(/\/?deployments\/?$/, '')
}

/**
 * Fetch the template registry from the backend.
 * Path: strip "/deployments" suffix from DEPLOYMENTS_API_PREFIX and replace with "/templates".
 */
export async function getTemplates(): Promise<TemplateInfo[]> {
  const res = await fetch(`${templatesApiBase()}/templates`)
  if (!res.ok) throw new Error(await readApiErrorMessage(res))
  return res.json() as Promise<TemplateInfo[]>
}

export async function getTemplateLoadgen(
  templateId: string,
): Promise<LoadgenConfigView> {
  const res = await fetch(
    `${templatesApiBase()}/templates/${encodeURIComponent(templateId)}/loadgen`,
  )
  if (!res.ok) throw new ApiError(res.status, await readApiErrorMessage(res))
  return res.json() as Promise<LoadgenConfigView>
}

export async function getResourceProfiles(): Promise<ResourceProfilesResponse> {
  const base = DEPLOYMENTS_API_PREFIX.replace(/\/?deployments\/?$/, '')
  const res = await fetch(`${base}/meta/resource-profiles`)
  if (!res.ok) throw new Error(await readApiErrorMessage(res))
  return res.json() as Promise<ResourceProfilesResponse>
}

export async function getTopologyRules(): Promise<TopologyRulesResponse> {
  const base = DEPLOYMENTS_API_PREFIX.replace(/\/?deployments\/?$/, '')
  const res = await fetch(`${base}/meta/topology-rules`)
  if (!res.ok) throw new Error(await readApiErrorMessage(res))
  return res.json() as Promise<TopologyRulesResponse>
}

export interface CurrentUserLimits {
  maxConcurrent: number
  sessionDefaultMins: number
  sessionCapMins: number
  /** Null when unlimited (internal). */
  maxSessionsPerMonth: number | null
  allTemplates: boolean
  maxAppServerReplicas: number
  allowLoadBalancer: boolean
  allowMQWorker: boolean
  allowProxyCache: boolean
  maxInstanceSize: string
}

export interface CurrentUserResponse {
  userId: string
  isInternal: boolean
  isPremium: boolean
  premiumExpiresAt: string | null
  effectiveTier: 'free' | 'engineer' | 'internal'
  quotaTier: string
  limits: CurrentUserLimits
  /** Successful (live) sessions this UTC month; 0 when unlimited. */
  sessionsUsedThisMonth: number
  /** Null when unlimited (internal). */
  sessionsRemainingThisMonth: number | null
}

/** GET /me — authenticated caller profile (tier, quota, deployment limits). */
export async function getMe(): Promise<CurrentUserResponse> {
  if (shouldUseDevAccountFixtures(getAccessToken())) {
    return DEV_ENGINEER_USER
  }
  try {
    const base = DEPLOYMENTS_API_PREFIX.replace(/\/?deployments\/?$/, '')
    const res = await fetch(`${base}/me`, {
      headers: authHeader() ?? {},
    })
    if (!res.ok) {
      if (shouldFallbackToDevAccountFixtures(res.status)) {
        return DEV_ENGINEER_USER
      }
      const message = await readApiErrorMessage(res)
      throw new ApiError(res.status, message)
    }
    return res.json() as Promise<CurrentUserResponse>
  } catch (err) {
    if (err instanceof ApiError) throw err
    if (shouldFallbackToDevAccountFixtures()) return DEV_ENGINEER_USER
    throw err
  }
}

/** JSON `{ "error": "..." }` or plain text — same parsing as other deployment API calls. */
export async function readApiErrorMessage(res: Response): Promise<string> {
  const text = await res.text()
  if (!text) return res.statusText || `HTTP ${res.status}`
  try {
    const j = JSON.parse(text) as { error?: string }
    if (typeof j.error === 'string') return j.error
  } catch {
    /* not JSON */
  }
  return text.slice(0, 200)
}

export async function createDeployment(
  design: DeploymentDesign
): Promise<DeploymentResult> {
  const token = getAccessToken()
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(design),
  })
  if (!res.ok) {
    const text = await res.text()
    if (res.status === 422 && text) {
      try {
        const body = JSON.parse(text) as unknown
        if (isResourceBudgetErrorResponse(body)) {
          throw new ResourceBudgetApiError(body)
        }
      } catch (error) {
        if (error instanceof ResourceBudgetApiError) throw error
      }
    }
    const { message, reason } = parseApiErrorBody(text, res)
    throw new ApiError(res.status, message, reason)
  }
  return res.json() as Promise<DeploymentResult>
}

function parseApiErrorBody(
  text: string,
  res: Response,
): { message: string; reason?: string } {
  if (!text) return { message: res.statusText || `HTTP ${res.status}` }
  try {
    const j = JSON.parse(text) as { error?: string; reason?: string }
    const message =
      typeof j.error === 'string' ? j.error : text.slice(0, 200)
    const reason = typeof j.reason === 'string' ? j.reason : undefined
    return { message, reason }
  } catch {
    return { message: text.slice(0, 200) }
  }
}

export async function deleteDeployment(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeader(),
  })
  if (!res.ok) {
    const message = await readApiErrorMessage(res)
    throw new ApiError(res.status, message)
  }
}

/** GET /deployments/{id} — id is the deployment namespace (e.g. runcloud9-url-shortener-…). */
export interface DeploymentRecord {
  id: string
  namespace?: string
  status: string
  expiresAt: string
  template?: string
  /** Present when status === 'queued'. */
  queuePosition?: number
  /** Present when status === 'queued' (rough ETA). */
  estimatedWaitSeconds?: number
  /** Present after teardown; includes `session_history` and peak aggregates. */
  metricsSummary?: Record<string, unknown>
}

export async function getDeployment(id: string): Promise<DeploymentRecord> {
  const token = getAccessToken()
  if (shouldUseDevAccountFixtures(token)) {
    const rec = devDeploymentRecord(id)
    if (!rec) throw new Error(`Deployment not found: ${id}`)
    return rec
  }
  try {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    if (!res.ok) {
      const preview = shouldFallbackToDevAccountFixtures(res.status)
        ? devDeploymentRecord(id)
        : null
      if (preview) return preview
      throw new Error(await readApiErrorMessage(res))
    }
    return res.json() as Promise<DeploymentRecord>
  } catch (err) {
    if (shouldFallbackToDevAccountFixtures()) {
      const preview = devDeploymentRecord(id)
      if (preview) return preview
    }
    throw err
  }
}

/** GET /deployments — list active deployments for the current user (or all, if unauthenticated). */
export interface ActiveDeploymentSummary {
  id: string
  namespace: string
  template: string
  status: string
  expiresAt: string
  createdAt: string
}

export async function listActiveDeployments(): Promise<ActiveDeploymentSummary[]> {
  const token = getAccessToken()
  if (shouldUseDevAccountFixtures(token)) {
    return devActiveDeployments()
  }
  try {
    const res = await fetch(API_BASE, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    if (!res.ok) {
      if (shouldFallbackToDevAccountFixtures(res.status)) {
        return devActiveDeployments()
      }
      throw new Error(await readApiErrorMessage(res))
    }
    return res.json() as Promise<ActiveDeploymentSummary[]>
  } catch (err) {
    if (shouldFallbackToDevAccountFixtures()) return devActiveDeployments()
    throw err
  }
}

/** Past terminated/failed deployments for the signed-in user (newest first). */
export interface DeploymentHistoryItem {
  id: string
  namespace: string
  template: string
  archetype: string
  status: 'terminated' | 'failed'
  createdAt: string
  expiresAt: string
  terminatedAt?: string
  durationSeconds?: number
  peakRps?: number
  peakP99Ms?: number
}

export async function listDeploymentHistory(
  limit = 20,
): Promise<DeploymentHistoryItem[]> {
  const clamped = Math.min(50, Math.max(1, Math.floor(Number(limit) || 20)))
  if (shouldUseDevAccountFixtures(getAccessToken())) {
    return devDeploymentHistory(clamped)
  }
  let res: Response
  try {
    res = await fetch(`${API_BASE}/history?limit=${clamped}`, {
      headers: authHeader() ?? {},
    })
  } catch (err) {
    if (shouldFallbackToDevAccountFixtures()) return devDeploymentHistory(clamped)
    throw err
  }
  if (!res.ok) {
    if (shouldFallbackToDevAccountFixtures(res.status)) {
      return devDeploymentHistory(clamped)
    }
    const message = await readApiErrorMessage(res)
    throw new ApiError(res.status, message)
  }
  const raw = (await res.json()) as unknown
  if (!Array.isArray(raw)) return []
  return raw
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    .map((row) => {
      const status = row.status === 'failed' ? 'failed' : 'terminated'
      const item: DeploymentHistoryItem = {
        id: String(row.id ?? ''),
        namespace: String(row.namespace ?? ''),
        template: String(row.template ?? ''),
        archetype: String(row.archetype ?? ''),
        status,
        createdAt: String(row.createdAt ?? ''),
        expiresAt: String(row.expiresAt ?? ''),
      }
      if (typeof row.terminatedAt === 'string' && row.terminatedAt.trim()) {
        item.terminatedAt = row.terminatedAt
      }
      const duration = Number(row.durationSeconds)
      if (Number.isFinite(duration) && duration >= 0) item.durationSeconds = duration
      const peakRps = Number(row.peakRps)
      if (Number.isFinite(peakRps) && peakRps >= 0) item.peakRps = peakRps
      const peakP99 = Number(row.peakP99Ms)
      if (Number.isFinite(peakP99) && peakP99 >= 0) item.peakP99Ms = peakP99
      return item
    })
    .filter((item) => item.id && item.namespace)
}

export async function startLoadGen(
  id: string,
  profile?: Partial<LoadProfile>
): Promise<void> {
  const auth = authHeader()
  const body: LoadProfile = {
    rps: profile?.rps ?? 50,
    durationSeconds: profile?.durationSeconds ?? 0,
    template: profile?.template,
    baseUrl: profile?.baseUrl,
    distribution: profile?.distribution,
    scheduleId: profile?.scheduleId,
    actorParams: profile?.actorParams,
  }
  const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}/loadgen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ?? {}) },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const message = await readApiErrorMessage(res)
    throw new ApiError(res.status, message)
  }
}

export async function stopLoadGen(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}/loadgen`, {
    method: 'DELETE',
    headers: authHeader(),
  })
  if (!res.ok) {
    const message = await readApiErrorMessage(res)
    throw new ApiError(res.status, message)
  }
}

export interface LoadGenPatch {
  rps?: number
  distribution?: Record<string, number>
}

export async function updateLoadGen(
  id: string,
  patch: LoadGenPatch,
): Promise<void> {
  const body: Record<string, unknown> = {}
  if (patch.rps != null) body.rps = patch.rps
  if (patch.distribution != null) body.distribution = patch.distribution
  if (Object.keys(body).length === 0) return

  const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}/loadgen`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(authHeader() ?? {}) },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const message = await readApiErrorMessage(res)
    throw new ApiError(res.status, message)
  }
}

export async function triggerChaos(
  deploymentId: string,
  body: ChaosRequest,
): Promise<ChaosAppliedResponse> {
  const res = await fetch(
    `${API_BASE}/${encodeURIComponent(deploymentId)}/chaos`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(authHeader() ?? {}) },
      body: JSON.stringify(body),
    },
  )
  if (!res.ok) {
    const message = await readApiErrorMessage(res)
    throw new ApiError(res.status, message)
  }
  return res.json() as Promise<ChaosAppliedResponse>
}

/**
 * Build `/deployments/{id}/proxy/{component}` with optional path segments.
 * `pathSuffix` may be e.g. `shorten`, `abc123`, or `a/b` (each segment URL-encoded).
 */
export function deploymentProxyUrl(
  deploymentId: string,
  component: string,
  pathSuffix?: string
): string {
  const base = `${API_BASE}/${encodeURIComponent(deploymentId)}/proxy/${encodeURIComponent(component)}`
  const raw = (pathSuffix ?? '').trim().replace(/^\/+/, '')
  if (!raw) return base
  const encoded = raw
    .split('/')
    .filter((s) => s.length > 0)
    .map((s) => encodeURIComponent(s))
    .join('/')
  return `${base}/${encoded}`
}

export function connectMetricsWS(id: string): WebSocket {
  const base = `${buildWsBaseForApi(API_BASE, location)}/${encodeURIComponent(id)}/metrics`
  const token = getAccessToken()
  const url = token ? `${base}?token=${encodeURIComponent(token)}` : base
  return new WebSocket(url)
}

export function connectLogsWS(id: string): WebSocket {
  const base = `${buildWsBaseForApi(API_BASE, location)}/${encodeURIComponent(id)}/logs`
  const token = getAccessToken()
  const url = token ? `${base}?token=${encodeURIComponent(token)}` : base
  return new WebSocket(url)
}
