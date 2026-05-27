import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { canvasToBackend } from './typeMapping'

export type NormalizedComponentProvisionState =
  | 'pending'
  | 'deploying'
  | 'ready'
  | 'failed'
  | 'unknown'

export type NormalizedSeedingState =
  | 'pending'
  | 'seeding'
  | 'done'
  | 'failed'
  | 'skipped'
  | 'unknown'

export type ParsedProvisionMetrics = {
  provisionPhase?: string
  componentStatus: Record<string, string>
  seedingStatus?: NormalizedSeedingState
}

function pickStr(
  m: Record<string, unknown>,
  keys: readonly string[],
): string | undefined {
  for (const k of keys) {
    const v = m[k]
    if (typeof v === 'string' && v.trim()) return v
  }
  return undefined
}

function pickNestedObject(
  m: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> | null {
  for (const k of keys) {
    const v = m[k]
    if (v && typeof v === 'object' && !Array.isArray(v))
      return v as Record<string, unknown>
  }
  return null
}

/** Normalize API casing (camelCase JSON vs snake_case in DB payloads). */
export function parseProvisionMetrics(
  metricsSummary: Record<string, unknown> | undefined | null,
): ParsedProvisionMetrics | null {
  if (!metricsSummary || typeof metricsSummary !== 'object') return null

  const phase = pickStr(metricsSummary as Record<string, unknown>, [
    'provision_phase',
    'provisionPhase',
  ])
  const rawComp = pickNestedObject(metricsSummary as Record<string, unknown>, [
    'component_status',
    'componentStatus',
  ])
  const rawSeed = pickStr(metricsSummary as Record<string, unknown>, [
    'seeding_status',
    'seedingStatus',
  ])

  const componentStatus: Record<string, string> = {}
  if (rawComp) {
    for (const [k, v] of Object.entries(rawComp)) {
      if (typeof v === 'string') componentStatus[k] = v.trim().toLowerCase()
      else if (typeof v === 'number') componentStatus[k] = String(v)
    }
  }

  let seedingStatus: NormalizedSeedingState | undefined
  if (rawSeed) {
    const s = rawSeed.trim().toLowerCase()
    if (
      s === 'pending' ||
      s === 'seeding' ||
      s === 'done' ||
      s === 'failed' ||
      s === 'skipped'
    )
      seedingStatus = s
    else seedingStatus = 'unknown'
  }

  return {
    provisionPhase: phase,
    componentStatus,
    seedingStatus,
  }
}

/** Per contract §Backward Compatibility: legacy pulse unless all contract keys exist on metricsSummary. */
export function metricsSummaryHasContractFields(
  metricsSummary: Record<string, unknown> | undefined | null,
): boolean {
  if (!metricsSummary || typeof metricsSummary !== 'object') return false
  const m = metricsSummary as Record<string, unknown>
  const hasPhase = 'provision_phase' in m || 'provisionPhase' in m
  const hasComponents = 'component_status' in m || 'componentStatus' in m
  const hasSeeding = 'seeding_status' in m || 'seedingStatus' in m
  return hasPhase && hasComponents && hasSeeding
}

/** When true, show thin indeterminate bar (contract fields missing on metricsSummary). */
export function shouldUseLegacyProvisioningPulse(
  metricsSummary: Record<string, unknown> | undefined | null,
): boolean {
  return !metricsSummaryHasContractFields(metricsSummary)
}

export function normalizeComponentProvisionState(
  raw: string,
): NormalizedComponentProvisionState {
  const s = raw.trim().toLowerCase()
  if (s === 'pending') return 'pending'
  if (s === 'deploying' || s === 'provisioning') return 'deploying'
  if (s === 'ready' || s === 'healthy' || s === 'running') return 'ready'
  if (s === 'failed' || s === 'error') return 'failed'
  return 'unknown'
}

/** Sort order contract: db, cache, mq, app-server, worker, lb; unknown last. */
const BACKEND_RANK: Record<string, number> = {
  db: 0,
  cache: 1,
  mq: 2,
  'app-server': 3,
  worker: 4,
  lb: 5,
}

function backendTypeForNodeId(
  nodeId: string,
  nodes: Record<string, CanvasNode>,
): string {
  const n = nodes[nodeId]
  if (!n || n.type === 'client') return 'unknown'
  return canvasToBackend[n.type]
}

export type ComponentRow = {
  id: string
  label: string
  backendKind: string
  state: NormalizedComponentProvisionState
}

export function buildOrderedComponentRows(
  componentStatus: Record<string, string>,
  nodes: Record<string, CanvasNode>,
): ComponentRow[] {
  const rows: ComponentRow[] = []
  for (const [id, raw] of Object.entries(componentStatus)) {
    const n = nodes[id]
    const label = n?.label?.trim() || id
    const backendKind = backendTypeForNodeId(id, nodes)
    rows.push({
      id,
      label,
      backendKind,
      state: normalizeComponentProvisionState(raw),
    })
  }

  rows.sort((a, b) => {
    const ra = BACKEND_RANK[a.backendKind] ?? 99
    const rb = BACKEND_RANK[b.backendKind] ?? 99
    const cmp = ra - rb
    if (cmp !== 0) return cmp
    return a.label.localeCompare(b.label)
  })
  return rows
}
