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

export type NormalizedLoadgenState =
  | 'pending'
  | 'ready'
  | 'failed'
  | 'skipped'
  | 'unknown'

export type ReplicaWaitRow = {
  ordinal: number
  ready: boolean
  waitCode: string
}

export type ParsedProvisionMetrics = {
  provisionPhase?: string
  componentStatus: Record<string, string>
  seedingStatus?: NormalizedSeedingState
  loadgenStatus?: NormalizedLoadgenState
  replicaStatus: Record<string, ReplicaWaitRow[]>
  provisionDetailCode?: string
}

/** Backend doorway semaphore wait (MAX_CONCURRENT_PROVISIONS). Distinct from status=queued. */
export const PROVISION_PHASE_WAITING_FOR_SLOT = 'waiting_for_provision_slot'

export function isWaitingForProvisionSlot(
  phase: string | null | undefined,
): boolean {
  return (
    String(phase ?? '')
      .trim()
      .toLowerCase() === PROVISION_PHASE_WAITING_FOR_SLOT
  )
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

function pickBool(obj: Record<string, unknown>, keys: readonly string[]): boolean {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'boolean') return v
  }
  return false
}

function pickNumber(obj: Record<string, unknown>, keys: readonly string[]): number {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return 0
}

function parseReplicaWaitRow(raw: unknown): ReplicaWaitRow | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  const waitCode = pickStr(row, ['wait_code', 'waitCode'])
  const ordinal = pickNumber(row, ['ordinal'])
  if (!waitCode || ordinal <= 0) return null
  return {
    ordinal,
    ready: pickBool(row, ['ready']),
    waitCode: waitCode.trim().toLowerCase(),
  }
}

function parseReplicaStatus(
  metricsSummary: Record<string, unknown>,
): Record<string, ReplicaWaitRow[]> {
  const raw = pickNestedObject(metricsSummary, ['replica_status', 'replicaStatus'])
  if (!raw) return {}

  const out: Record<string, ReplicaWaitRow[]> = {}
  for (const [nodeId, value] of Object.entries(raw)) {
    if (!Array.isArray(value)) continue
    const rows: ReplicaWaitRow[] = []
    for (const item of value) {
      const parsed = parseReplicaWaitRow(item)
      if (parsed) rows.push(parsed)
    }
    if (rows.length > 0) {
      rows.sort((a, b) => a.ordinal - b.ordinal)
      out[nodeId] = rows
    }
  }
  return out
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
  const rawLoadgen = pickStr(metricsSummary as Record<string, unknown>, [
    'loadgen_status',
    'loadgenStatus',
  ])
  const rawDetail = pickStr(metricsSummary as Record<string, unknown>, [
    'provision_detail_code',
    'provisionDetailCode',
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

  let loadgenStatus: NormalizedLoadgenState | undefined
  if (rawLoadgen) {
    const s = rawLoadgen.trim().toLowerCase()
    if (
      s === 'pending' ||
      s === 'ready' ||
      s === 'failed' ||
      s === 'skipped'
    )
      loadgenStatus = s
    else loadgenStatus = 'unknown'
  }

  return {
    provisionPhase: phase,
    componentStatus,
    seedingStatus,
    loadgenStatus,
    replicaStatus: parseReplicaStatus(metricsSummary as Record<string, unknown>),
    provisionDetailCode: rawDetail?.trim().toLowerCase(),
  }
}

export function isTerminalSeedingStatus(
  state: NormalizedSeedingState | undefined,
): boolean {
  return state === 'done' || state === 'failed' || state === 'skipped'
}

export function isTerminalLoadgenStatus(
  state: NormalizedLoadgenState | undefined,
): boolean {
  return state === 'ready' || state === 'failed' || state === 'skipped'
}

/** Keep the checklist visible briefly after running when seed/loadgen rows are meaningful. */
export function shouldLingerProvisionOverlay(
  parsed: ParsedProvisionMetrics | null,
): boolean {
  if (!parsed) return false
  const seed = parsed.seedingStatus ?? 'pending'
  const loadgen = parsed.loadgenStatus ?? 'pending'
  if (seed === 'skipped' && loadgen === 'skipped') return false
  return isTerminalSeedingStatus(parsed.seedingStatus) &&
    isTerminalLoadgenStatus(parsed.loadgenStatus)
}

export function canvasInstanceCount(
  node: CanvasNode,
  backendKind: string,
): number {
  if (backendKind === 'db') {
    const readReplicas =
      typeof node.config?.readReplicas === 'number' ? node.config.readReplicas : 0
    return 1 + Math.max(0, readReplicas)
  }
  const replicas = node.config?.replicas
  if (typeof replicas === 'number' && replicas > 0) return replicas
  return 1
}

/** Pad replica_status to canvas expectedCount with pending placeholders. Live rows win. */
export function padReplicaWaitRows(
  rows: ReplicaWaitRow[] | undefined,
  expectedCount: number,
): ReplicaWaitRow[] {
  if (expectedCount <= 0) return rows ?? []
  const byOrdinal = new Map<number, ReplicaWaitRow>()
  for (const row of rows ?? []) {
    byOrdinal.set(row.ordinal, row)
  }
  const out: ReplicaWaitRow[] = []
  for (let ordinal = 1; ordinal <= expectedCount; ordinal++) {
    const live = byOrdinal.get(ordinal)
    if (live) {
      out.push(live)
    } else {
      out.push({ ordinal, ready: false, waitCode: 'pending' })
    }
  }
  return out
}

export function shouldShowReplicaChildren(
  replicaRows: ReplicaWaitRow[] | undefined,
  expectedCount: number,
  state: NormalizedComponentProvisionState,
): boolean {
  if ((replicaRows?.length ?? 0) > 1) return true
  if (expectedCount > 1 && (state === 'deploying' || state === 'pending')) {
    return true
  }
  return false
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
  const hasLoadgen = 'loadgen_status' in m || 'loadgenStatus' in m
  return hasPhase && hasComponents && hasSeeding && hasLoadgen
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
