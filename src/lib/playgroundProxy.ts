import { getAccessToken } from './auth'
import {
  HEADER_ACT_AS,
  type ThreadServedBy,
  isSocialFeedTemplate,
  parseThreadServedBy,
  parseUserPoolUserIds,
} from './playgroundProxyModel'

export {
  HEADER_ACT_AS,
  isSocialFeedTemplate,
  parseThreadServedBy,
  parseUserPoolUserIds,
}
export type { ThreadServedBy }

export interface DeploymentProxyOptions {
  method?: string
  headers?: Record<string, string>
  body?: string
  /** When set, sent as HEADER_ACT_AS; API maps to X-C9-Client-ID on the app. */
  actAsUserId?: string
  requestId?: string
}

const deploymentsApiPrefix =
  (import.meta.env.VITE_DEPLOYMENTS_API_PREFIX as string | undefined)?.replace(/\/$/, '') ??
  '/deployments'

function deploymentProxyUrl(deploymentId: string, component: string, pathSuffix?: string): string {
  const base = `${deploymentsApiPrefix}/${encodeURIComponent(deploymentId)}/proxy/${encodeURIComponent(component)}`
  const raw = (pathSuffix ?? '').trim().replace(/^\/+/, '')
  if (!raw) return base
  const encoded = raw
    .split('/')
    .filter((s) => s.length > 0)
    .map((s) => encodeURIComponent(s))
    .join('/')
  return `${base}/${encoded}`
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
