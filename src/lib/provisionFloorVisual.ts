import type { CanvasNode } from '../editor-core/stores/canvasStore'
import {
  DOOR_WAIT_TITLE,
  ROOM_QUEUE_TITLE,
  formatQueueWaitingDetail,
  formatRoomWaitingDetail,
  hasQueueWaitFields,
} from './deployQueue'
import {
  PROVISION_FAILED_HEADLINE,
  buildSeedWaitContext,
  componentStatusToUserLine,
  provisionDetailCodeToSubtitle,
  provisionElapsedCaption,
  seedingStatusToUserLine,
} from './provisionCopy'
import {
  canvasInstanceCount,
  isWaitingForProvisionSlot,
  normalizeComponentProvisionState,
  padReplicaWaitRows,
  type ParsedProvisionMetrics,
} from './provisionMetrics'
import { canvasToBackend } from './typeMapping'

export type ProvisionGlyphPhase = 'off' | 'pending' | 'building' | 'ready'

export function formatProvisionStripClock(sec: number): string {
  const n = Math.max(0, Math.floor(sec))
  const m = Math.floor(n / 60)
  const s = n % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function provisionGlyphPhaseForNode(
  node: CanvasNode | undefined,
  parsed: ParsedProvisionMetrics | null,
  active: boolean,
): ProvisionGlyphPhase {
  if (!active || !node || node.type === 'client') return 'off'
  const raw = parsed?.componentStatus[node.id]
  const state = raw
    ? normalizeComponentProvisionState(raw)
    : 'pending'
  if (state === 'ready') return 'ready'
  if (state === 'failed') return 'building'
  if (state === 'deploying') {
    const expected = canvasInstanceCount(node, canvasToBackend[node.type])
    const rows = padReplicaWaitRows(
      parsed?.replicaStatus[node.id],
      expected,
    )
    if (rows.length > 0 && rows.every((row) => row.ready)) return 'ready'
    return 'building'
  }
  return 'pending'
}

export function provisionFloorLineForNode(
  node: CanvasNode | undefined,
  parsed: ParsedProvisionMetrics | null,
): string | null {
  if (!node || node.type === 'client') return null
  const raw = parsed?.componentStatus[node.id]
  const state = raw
    ? normalizeComponentProvisionState(raw)
    : 'pending'
  const expected = canvasInstanceCount(node, canvasToBackend[node.type])
  const rows = padReplicaWaitRows(parsed?.replicaStatus[node.id], expected)
  if (state === 'pending') return 'Waiting…'
  const line = componentStatusToUserLine(state, rows)
  if (node.type === 'database' && parsed?.seedingStatus) {
    const seed = seedingStatusToUserLine(
      parsed.seedingStatus,
      buildSeedWaitContext({ [node.id]: node }, parsed.replicaStatus),
    )
    if (parsed.seedingStatus === 'seeding') {
      return seed.detail ? `${seed.status} · ${seed.detail}` : seed.status
    }
  }
  if (line.detail && state === 'deploying') {
    return `${line.status} · ${line.detail}`
  }
  return line.status
}

export function provisionStripCopy(opts: {
  parsed: ParsedProvisionMetrics | null
  nodes: Record<string, CanvasNode>
  elapsedSeconds: number
  isQueued: boolean
  isTerminating: boolean
  isSubmitting?: boolean
  queuePosition: number | null
  estimatedWaitSeconds: number | null
  error?: string | null
}): {
  step: string
  estimate: string | null
  phase: 'deploying' | 'queued' | 'teardown' | 'error'
} {
  if (opts.error) {
    return {
      step: PROVISION_FAILED_HEADLINE,
      estimate: opts.error,
      phase: 'error',
    }
  }
  if (opts.isTerminating) {
    return {
      step: 'Tearing down',
      estimate: null,
      phase: 'teardown',
    }
  }
  if (opts.isQueued) {
    return {
      step: ROOM_QUEUE_TITLE,
      estimate: formatRoomWaitingDetail({
        estimatedWaitSeconds: opts.estimatedWaitSeconds,
      }),
      phase: 'queued',
    }
  }
  const doorway =
    !opts.isQueued &&
    isWaitingForProvisionSlot(opts.parsed?.provisionPhase)
  if (doorway) {
    const fields = {
      queuePosition: opts.queuePosition,
      estimatedWaitSeconds: opts.estimatedWaitSeconds,
    }
    return {
      step: DOOR_WAIT_TITLE,
      estimate: hasQueueWaitFields(fields)
        ? formatQueueWaitingDetail(fields)
        : 'A few deploys are starting ahead of you.',
      phase: 'queued',
    }
  }
  if (opts.isSubmitting && !opts.parsed) {
    return {
      step: 'Submitting deployment request',
      estimate: null,
      phase: 'deploying',
    }
  }
  const seedCtx = opts.parsed
    ? buildSeedWaitContext(opts.nodes, opts.parsed.replicaStatus)
    : undefined
  const step = opts.parsed
    ? provisionDetailCodeToSubtitle(
        opts.parsed.provisionDetailCode,
        opts.parsed.seedingStatus,
        seedCtx,
      )
    : 'Starting your system…'
  const estimate = provisionElapsedCaption({
    elapsedSeconds: opts.elapsedSeconds,
    isQueued: false,
    isDoorwayWait: false,
    isTerminating: false,
  })
  return { step, estimate, phase: 'deploying' }
}
