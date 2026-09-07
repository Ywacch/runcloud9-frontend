import { DEPLOYMENTS_API_PREFIX } from './api'
import { getAccessToken } from './auth'

const API_BASE = DEPLOYMENTS_API_PREFIX

export type IntrospectTarget = 'primary' | 'replica'

export type IntrospectQueryOpts = {
  target?: IntrospectTarget
  layerId?: string
}

/** Append replica routing query params when needed. */
export function withIntrospectTarget(
  path: string,
  targetOrOpts?: IntrospectTarget | IntrospectQueryOpts,
): string {
  const opts: IntrospectQueryOpts =
    typeof targetOrOpts === 'string' || targetOrOpts == null
      ? { target: targetOrOpts }
      : targetOrOpts
  if (opts.target !== 'replica' && !opts.layerId) return path
  const params = new URLSearchParams()
  if (opts.target === 'replica') params.set('target', 'replica')
  if (opts.layerId) params.set('layerId', opts.layerId)
  const qs = params.toString()
  if (!qs) return path
  return `${path}${path.includes('?') ? '&' : '?'}${qs}`
}

function authHeaders(): Record<string, string> {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// --- Types ---

export interface TableInfo {
  name: string
  rowCount: number
}

export interface ColumnInfo {
  name: string
  dataType: string
  nullable: boolean
  defaultValue?: string | null
  isPrimaryKey: boolean
}

export interface IndexInfo {
  name: string
  table: string
  columns?: string[] | null
  unique: boolean
  primary: boolean
  definition: string
}

export interface RowsResult {
  columns: string[]
  rows: Record<string, unknown>[]
  total: number
  page: number
  limit: number
}

export interface KeyInfo {
  key: string
  type: string
  ttl: number
  memory: number
}

export interface KeyValue {
  key: string
  type: string
  value: unknown
  ttl: number
}

export interface KeyScanResult {
  keys: KeyInfo[]
  cursor: number
  keyCount?: number
}

export interface CacheStatsResult {
  keyCount?: number
}

async function introspectGet<T>(
  deploymentId: string,
  component: string,
  path: string,
): Promise<T> {
  const url = `${API_BASE}/${encodeURIComponent(deploymentId)}/introspect/${encodeURIComponent(component)}/${path}`
  const res = await fetch(url, { headers: authHeaders() })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function fetchCapabilities(deploymentId: string, component: string) {
  return introspectGet<{ capabilities: string[] }>(
    deploymentId,
    component,
    'capabilities',
  )
}

export function fetchTables(
  deploymentId: string,
  component: string,
  targetOrOpts?: IntrospectTarget | IntrospectQueryOpts,
) {
  return introspectGet<TableInfo[]>(
    deploymentId,
    component,
    withIntrospectTarget('tables', targetOrOpts),
  )
}

export function fetchSchema(
  deploymentId: string,
  component: string,
  table: string,
  targetOrOpts?: IntrospectTarget | IntrospectQueryOpts,
) {
  return introspectGet<ColumnInfo[]>(
    deploymentId,
    component,
    withIntrospectTarget(`schema/${encodeURIComponent(table)}`, targetOrOpts),
  )
}

export function fetchRows(
  deploymentId: string,
  component: string,
  table: string,
  opts?: {
    page?: number
    limit?: number
    sort?: string
    order?: string
    target?: IntrospectTarget
    layerId?: string
  },
) {
  const params = new URLSearchParams()
  if (opts?.page != null) params.set('page', String(opts.page))
  if (opts?.limit != null) params.set('limit', String(opts.limit))
  if (opts?.sort) params.set('sort', opts.sort)
  if (opts?.order) params.set('order', opts.order)
  const qs = params.toString()
  const path = `rows/${encodeURIComponent(table)}${qs ? `?${qs}` : ''}`
  return introspectGet<RowsResult>(
    deploymentId,
    component,
    withIntrospectTarget(path, { target: opts?.target, layerId: opts?.layerId }),
  )
}

export function fetchIndexes(
  deploymentId: string,
  component: string,
  targetOrOpts?: IntrospectTarget | IntrospectQueryOpts,
) {
  return introspectGet<IndexInfo[]>(
    deploymentId,
    component,
    withIntrospectTarget('indexes', targetOrOpts),
  )
}

export function fetchKeys(
  deploymentId: string,
  component: string,
  pattern: string,
  cursor?: number,
  count?: number,
) {
  const params = new URLSearchParams({ pattern })
  if (cursor != null) params.set('cursor', String(cursor))
  if (count != null) params.set('count', String(count))
  return introspectGet<KeyScanResult>(
    deploymentId,
    component,
    `keys?${params}`,
  )
}

export function fetchCacheStats(
  deploymentId: string,
  component: string,
): Promise<CacheStatsResult> {
  return introspectGet<CacheStatsResult>(deploymentId, component, 'stats')
}

export function fetchKeyValue(
  deploymentId: string,
  component: string,
  key: string,
) {
  return introspectGet<KeyValue>(
    deploymentId,
    component,
    `key/${encodeURIComponent(key)}`,
  )
}

export interface QueueInfo {
  name: string
  messages: number
  consumers: number
  available: boolean
}

export interface PeekResult {
  queue: string
  empty: boolean
  body?: string
  contentType?: string
  requeued: boolean
}

export function fetchQueues(deploymentId: string, component: string) {
  return introspectGet<QueueInfo[]>(deploymentId, component, 'queues')
}

export function fetchPeek(
  deploymentId: string,
  component: string,
  queue: string,
) {
  return introspectGet<PeekResult>(
    deploymentId,
    component,
    `peek/${encodeURIComponent(queue)}`,
  )
}
