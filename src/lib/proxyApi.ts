import { DEPLOYMENTS_API_PREFIX } from './api'
import { getAccessToken } from './auth'

function authHeaders(): Record<string, string> {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export interface ProxyResponse {
  status: number
  body: unknown
  requestId: string
}

/**
 * Dispatch a proxied HTTP request to a component inside the deployment.
 * Injects X-Request-ID so the trace can be correlated in the log stream.
 */
export async function proxyRequest(
  deploymentId: string,
  component: string,
  path: string,
  opts?: {
    method?: string
    body?: unknown
    requestId?: string
  },
): Promise<ProxyResponse> {
  const method = opts?.method ?? 'GET'
  const requestId = opts?.requestId ?? crypto.randomUUID()
  const url = `${DEPLOYMENTS_API_PREFIX}/${encodeURIComponent(deploymentId)}/proxy/${encodeURIComponent(component)}/${path}`
  const headers: Record<string, string> = {
    ...authHeaders(),
    'X-Request-ID': requestId,
    'Content-Type': 'application/json',
  }
  const res = await fetch(url, {
    method,
    headers,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  })
  const body = await res.json().catch(() => null)
  return {
    status: res.status,
    body,
    requestId: res.headers.get('X-Request-ID') ?? requestId,
  }
}
