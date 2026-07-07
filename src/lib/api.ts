import { getAccessToken } from './auth'
import { ApiError } from './apiError'
import type { ChaosAppliedResponse, ChaosRequest } from './chaos'
import type { DeploymentDesign, ResourceProfilesResponse } from './deploymentTypes'
import { ResourceBudgetApiError } from './resourceBudgetError'
import { isResourceBudgetErrorResponse } from './sumDesignBudget'
import type { StorytellingSpec } from './storytellingTypes'

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

export interface DeploymentResult {
  deploymentId: string
  namespace: string
  status: string
  seeded?: boolean
  error?: string
  assessment?: {
    verdict: string
    explanation: string
  }
}

export interface LoadProfile {
  rps: number
  durationSeconds?: number
  template?: string
  baseUrl?: string
  distribution?: Record<string, number>
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
  /** Template-scoped storytelling (journeys, roles, narrative hints) from GET /templates. */
  storytelling?: StorytellingSpec | null
  /** Default load-generator RPS for this template (from GET /templates). */
  loadgenDefaultRps?: number
  /** Per-component introspection config (tables, Redis key patterns, etc.). */
  introspection?: Record<
    string,
    {
      engine: string
      tables?: string[]
      keyPatterns?: string[]
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

/**
 * Fetch the template registry from the backend.
 * Path: strip "/deployments" suffix from DEPLOYMENTS_API_PREFIX and replace with "/templates".
 */
export async function getTemplates(): Promise<TemplateInfo[]> {
  const base = DEPLOYMENTS_API_PREFIX.replace(/\/?deployments\/?$/, '')
  const res = await fetch(`${base}/templates`)
  if (!res.ok) throw new Error(await readApiErrorMessage(res))
  return res.json() as Promise<TemplateInfo[]>
}

export async function getResourceProfiles(): Promise<ResourceProfilesResponse> {
  const base = DEPLOYMENTS_API_PREFIX.replace(/\/?deployments\/?$/, '')
  const res = await fetch(`${base}/meta/resource-profiles`)
  if (!res.ok) throw new Error(await readApiErrorMessage(res))
  return res.json() as Promise<ResourceProfilesResponse>
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
    const message = text ? await parseErrorMessageFromText(text, res) : res.statusText
    throw new ApiError(res.status, message)
  }
  return res.json() as Promise<DeploymentResult>
}

async function parseErrorMessageFromText(
  text: string,
  res: Response,
): Promise<string> {
  if (!text) return res.statusText || `HTTP ${res.status}`
  try {
    const j = JSON.parse(text) as { error?: string }
    if (typeof j.error === 'string') return j.error
  } catch {
    /* not JSON */
  }
  return text.slice(0, 200)
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
  /** Present after teardown; includes `session_history` and peak aggregates. */
  metricsSummary?: Record<string, unknown>
}

export async function getDeployment(id: string): Promise<DeploymentRecord> {
  const token = getAccessToken()
  const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!res.ok) throw new Error(await readApiErrorMessage(res))
  return res.json() as Promise<DeploymentRecord>
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
  const res = await fetch(API_BASE, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!res.ok) throw new Error(await readApiErrorMessage(res))
  return res.json() as Promise<ActiveDeploymentSummary[]>
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
