import { deploymentProxyUrl } from './api'
import { getAccessToken } from './auth'

/** Browser header for act-as user id (digits only); validated by the API. */
export const HEADER_ACT_AS = 'X-C9-Act-As'

export interface DeploymentProxyOptions {
  method?: string
  headers?: Record<string, string>
  body?: string
  /** When set, sent as HEADER_ACT_AS; API maps to X-C9-Client-ID on the app. */
  actAsUserId?: string
  requestId?: string
}

/**
 * Authenticated fetch to `/deployments/{id}/proxy/{component}/…`.
 */
export async function fetchDeploymentProxy(
  deploymentId: string,
  component: string,
  pathSuffix: string,
  options: DeploymentProxyOptions = {},
): Promise<Response> {
  const method = options.method ?? 'GET'
  const requestId = options.requestId ?? crypto.randomUUID()
  const token = getAccessToken()
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Request-ID': requestId,
    ...options.headers,
  }
  if (token) headers.Authorization = `Bearer ${token}`
  const actAs = options.actAsUserId?.trim()
  if (actAs) headers[HEADER_ACT_AS] = actAs
  const url = deploymentProxyUrl(deploymentId, component, pathSuffix)
  return fetch(url, {
    method,
    headers,
    body: options.body,
  })
}

export function parseUserPoolUserIds(body: unknown, max = 50): string[] {
  if (!body || typeof body !== 'object') return []
  const raw = (body as Record<string, unknown>).userIds
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item === 'number' && Number.isFinite(item)) {
      out.push(String(Math.trunc(item)))
    } else if (typeof item === 'string' && /^\d+$/.test(item.trim())) {
      out.push(item.trim())
    }
    if (out.length >= max) break
  }
  return out
}

export interface ThreadServedBy {
  replies?: string
  parents?: string
}

export function parseThreadServedBy(bodyText: string): ThreadServedBy | null {
  try {
    const v = JSON.parse(bodyText) as Record<string, unknown>
    const sb = v.servedBy
    if (!sb || typeof sb !== 'object' || Array.isArray(sb)) return null
    const o = sb as Record<string, unknown>
    const replies = typeof o.replies === 'string' ? o.replies : undefined
    const parents = typeof o.parents === 'string' ? o.parents : undefined
    if (!replies && !parents) return null
    return { replies, parents }
  } catch {
    return null
  }
}

export function isSocialFeedTemplate(templateId: string | null | undefined): boolean {
  return typeof templateId === 'string' && templateId.startsWith('social-feed')
}
