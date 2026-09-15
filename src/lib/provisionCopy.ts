import type {
  NormalizedComponentProvisionState,
  NormalizedLoadgenState,
  NormalizedSeedingState,
  ReplicaWaitRow,
} from './provisionMetrics'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { clampReadReplicas } from './replicaConfig'

export type UserLine = {
  status: string
  detail?: string
}

export const PROVISION_FAILED_HEADLINE = "Couldn't start your lab"
/** Shown while pods are coming up, after the API has admitted the deploy. */
export const PROVISION_TYPICAL_WAIT =
  'Usually 2–3 minutes after we start building.'
export const PROVISION_STILL_WORKING =
  'Still working. First start can take a few extra minutes.'
export const DEMO_DATA_ROW_TITLE = 'Demo data'
export const LOADGEN_ROW_TITLE = 'Load generator'
export const VALIDATE_STEP_SUBTITLE = 'Design validated'

export function waitCodeToUserLine(code: string | undefined | null): UserLine {
  switch (String(code ?? '').trim().toLowerCase()) {
    case 'ready':
      return { status: 'Ready' }
    case 'pending':
      return { status: 'Waiting…', detail: 'Waiting for its turn to start.' }
    case 'starting':
      return { status: 'Starting…', detail: 'Setting up this server.' }
    case 'pulling_image':
      return {
        status: 'Preparing…',
        detail: 'First start can take 30–60 seconds.',
      }
    case 'crash_loop':
      return {
        status: 'Restarting…',
        detail:
          'This server keeps stopping. Cancel and try again, or simplify the design.',
      }
    case 'config_error':
      return {
        status: "Couldn't start",
        detail:
          "This server can't start with the current design. Simplify and deploy again.",
      }
    case 'timeout':
      return {
        status: 'Stalled',
        detail:
          'This is taking longer than expected. You can keep waiting or cancel and try again.',
      }
    default:
      return { status: 'Checking status…' }
  }
}

export type SeedReplicationMode = 'async' | 'semi-sync' | 'sync'

export type SeedWaitContext = {
  mode: SeedReplicationMode
  replicaCount: number
  replicaRows?: ReplicaWaitRow[]
}

/** How many standbys must be Ready before restore (mirrors ganymede helper). */
export function seedReplicaReadyBeforeRestore(
  mode: SeedReplicationMode,
  replicaCount: number,
): number {
  if (replicaCount <= 0) return 0
  if (mode === 'async') return 0
  if (mode === 'semi-sync') return 1
  return replicaCount
}

export function parseSeedReplicationMode(
  raw: unknown,
  replicaCount: number,
): SeedReplicationMode {
  if (replicaCount <= 0) return 'async'
  const mode = String(raw ?? 'async').trim().toLowerCase()
  if (mode === 'semi-sync' || mode === 'semisync' || mode === 'semi_sync') {
    return 'semi-sync'
  }
  if (mode === 'sync' || mode === 'synchronous') return 'sync'
  return 'async'
}

export function buildSeedWaitContext(
  nodes: Record<string, CanvasNode>,
  replicaStatus: Record<string, ReplicaWaitRow[]>,
): SeedWaitContext | undefined {
  const db = Object.values(nodes).find((n) => n.type === 'database')
  if (!db) return undefined
  const replicaCount = clampReadReplicas(db.config?.readReplicas)
  return {
    mode: parseSeedReplicationMode(db.config?.replicationMode, replicaCount),
    replicaCount,
    replicaRows: replicaStatus[db.id],
  }
}

function primaryReady(rows: ReplicaWaitRow[] | undefined): boolean {
  if (!rows?.length) return false
  const primary = rows.find((row) => row.ordinal === 1) ?? rows[0]
  return Boolean(primary.ready)
}

function standbyReadyCount(rows: ReplicaWaitRow[] | undefined): number {
  if (!rows?.length) return 0
  return rows.filter((row) => row.ordinal > 1 && row.ready).length
}

export function provisionDetailCodeToSubtitle(
  code: string | undefined | null,
  seeding?: NormalizedSeedingState,
  ctx?: SeedWaitContext,
): string {
  const normalized = String(code ?? '').trim().toLowerCase()
  if (seeding === 'seeding') return 'Loading demo data…'
  const generic =
    normalized === '' ||
    normalized === 'layer_deploying' ||
    normalized === 'starting your system…'
  if (seeding === 'pending' && ctx && generic) {
    const pending = seedingStatusToUserLine('pending', ctx)
    if (pending.detail?.includes('every replica') || pending.detail?.includes('a replica first')) {
      return 'Waiting for replicas before demo data…'
    }
    if (
      pending.detail === 'Starts after the primary is ready.' ||
      pending.detail === 'Starts after the database is ready.'
    ) {
      return 'Waiting for the primary…'
    }
  }
  switch (normalized) {
    case 'layer_deploying':
      return 'Starting your system…'
    case 'pulling_image':
      return 'Preparing services…'
    case 'loading_sample_data':
      return 'Loading demo data…'
    case 'starting_traffic_generator':
      return 'Starting load generator…'
    case 'failed':
    case 'timeout':
    case 'crash_loop':
    case 'config_error':
      return 'Lab setup failed'
    default:
      return 'Starting your system…'
  }
}

export function componentStatusToUserLine(
  state: NormalizedComponentProvisionState,
  replicaRows: ReplicaWaitRow[] | undefined,
): UserLine {
  switch (state) {
    case 'pending':
      return { status: 'Waiting…' }
    case 'deploying': {
      const rows = replicaRows ?? []
      if (rows.length > 0 && rows.every((row) => row.ready)) {
        return { status: 'Ready' }
      }
      const readyCount = rows.filter((row) => row.ready).length
      const total = rows.length
      if (total > 1) {
        return {
          status: 'Starting…',
          detail: `${readyCount} of ${total} instances ready`,
        }
      }
      return { status: 'Starting…' }
    }
    case 'ready':
      return { status: 'Ready' }
    case 'failed':
      return {
        status: 'Failed',
        detail: "This component didn't start. Try again or simplify your design.",
      }
    default:
      return { status: 'Checking status…' }
  }
}

export function seedingStatusToUserLine(
  state: NormalizedSeedingState,
  ctx?: SeedWaitContext,
): UserLine {
  switch (state) {
    case 'pending': {
      if (!ctx) return { status: 'Waiting…' }
      const minReady = seedReplicaReadyBeforeRestore(ctx.mode, ctx.replicaCount)
      if (minReady === 0) {
        if (!primaryReady(ctx.replicaRows)) {
          return {
            status: 'Waiting…',
            detail:
              ctx.replicaCount > 0
                ? 'Starts after the primary is ready.'
                : 'Starts after the database is ready.',
          }
        }
        return {
          status: 'Waiting…',
          detail: 'Starting on the primary.',
        }
      }
      if (standbyReadyCount(ctx.replicaRows) < minReady) {
        if (ctx.mode === 'semi-sync') {
          return {
            status: 'Waiting…',
            detail: 'Waiting for a replica first.',
          }
        }
        return {
          status: 'Waiting…',
          detail: 'Waiting for every replica. Sync commits need a standby.',
        }
      }
      return { status: 'Waiting…', detail: 'Starting soon.' }
    }
    case 'seeding': {
      const replicasStillStarting =
        (ctx?.replicaCount ?? 0) > 0 &&
        Boolean(ctx?.replicaRows?.some((row) => !row.ready))
      if (
        ctx &&
        seedReplicaReadyBeforeRestore(ctx.mode, ctx.replicaCount) === 0 &&
        replicasStillStarting
      ) {
        return {
          status: 'Loading demo data…',
          detail: 'Loading into the primary. Replicas copy that data next.',
        }
      }
      return {
        status: 'Loading demo data…',
        detail: 'Adding example records to your database.',
      }
    }
    case 'done':
      return { status: 'Loaded' }
    case 'failed':
      return {
        status: 'Failed',
        detail: "Demo data couldn't load. You can continue without it.",
      }
    case 'skipped':
      return { status: 'Skipped' }
    default:
      return { status: 'Checking status…' }
  }
}

export function loadgenStatusToUserLine(state: NormalizedLoadgenState): UserLine {
  switch (state) {
    case 'pending':
      return { status: 'Waiting…' }
    case 'ready':
      return { status: 'Ready' }
    case 'failed':
      return {
        status: 'Failed',
        detail: "Couldn't start the load generator.",
      }
    case 'skipped':
      return { status: 'Skipped' }
    default:
      return { status: 'Checking status…' }
  }
}

export function instanceLabelForNode(
  backendKind: string,
  ordinal: number,
): string {
  if (backendKind === 'db') {
    if (ordinal <= 1) return 'Primary'
    return `Read replica ${ordinal - 1}`
  }
  return `Instance ${ordinal}`
}

export function shouldDefaultExpanded(replicaRows: ReplicaWaitRow[]): boolean {
  if (replicaRows.length === 0) return true
  return replicaRows.some((row) => !row.ready)
}

export function provisionElapsedCaption(opts: {
  elapsedSeconds: number
  isQueued: boolean
  isDoorwayWait: boolean
  isTerminating: boolean
}): string | null {
  if (opts.isQueued || opts.isDoorwayWait || opts.isTerminating) return null
  if (opts.elapsedSeconds >= 240) return PROVISION_STILL_WORKING
  return PROVISION_TYPICAL_WAIT
}
