import type {
  NormalizedComponentProvisionState,
  NormalizedLoadgenState,
  NormalizedSeedingState,
  ReplicaWaitRow,
} from './provisionMetrics'

export type UserLine = {
  status: string
  detail?: string
}

export const PROVISION_FAILED_HEADLINE = "Couldn't start your lab"
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

export function provisionDetailCodeToSubtitle(code: string | undefined | null): string {
  switch (String(code ?? '').trim().toLowerCase()) {
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
      const readyCount = replicaRows?.filter((row) => row.ready).length ?? 0
      const total = replicaRows?.length ?? 0
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

export function seedingStatusToUserLine(state: NormalizedSeedingState): UserLine {
  switch (state) {
    case 'pending':
      return { status: 'Waiting…' }
    case 'seeding':
      return {
        status: 'Loading demo data…',
        detail: 'Adding example records to your database.',
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
