import type { ComponentLayerMetrics } from '../editor-core/domain/metricsUiContract'
import { FMT_EMPTY, fmtInt } from './format'
import type { ReadConsistencyPolicy } from './readConsistency'
import type { ReplicationMode, SyncCommitLevel } from './replicaConfig'

/** Replay freshness cutoff. Durability is sync_state, not this threshold. */
export const REPLAY_CAUGHT_UP_SECONDS = 2

const DURABILITY_SYNC_STATES = new Set(['sync', 'quorum'])

export function isReplicaConnectedOnPrimary(layer: ComponentLayerMetrics): boolean {
  return layer.connectedOnPrimary !== false
}

export function fmtReplicationLagSeconds(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds)) return FMT_EMPTY
  if (seconds < 0.01) return '0 s'
  if (seconds < 10) return `${seconds.toFixed(2)} s`
  return `${seconds.toFixed(1)} s`
}

export function fmtLagBytes(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes)) return FMT_EMPTY
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}

export function fmtReplicaSyncState(syncState: string | undefined): string {
  const state = syncState?.trim()
  if (!state) return 'async'
  if (state === 'quorum') return 'quorum (any 1)'
  return state
}

/** Standby table: keep sync_state on one line. */
export function fmtReplicaSyncStateCompact(syncState: string | undefined): string {
  const state = syncState?.trim()
  if (!state) return 'async'
  if (state === 'quorum') return 'quorum'
  return state
}

export function maxConnectedReplicationLagSeconds(
  layers: ComponentLayerMetrics[],
): number | undefined {
  const lagValues = layers
    .filter(isReplicaConnectedOnPrimary)
    .map((layer) => layer.replicationLagSeconds)
    .filter((seconds): seconds is number => seconds !== undefined && Number.isFinite(seconds))
  return lagValues.length > 0 ? Math.max(...lagValues) : undefined
}

export function maxReplicaLagBytes(layers: ComponentLayerMetrics[]): number | undefined {
  const values = layers
    .filter(isReplicaConnectedOnPrimary)
    .map((layer) => layer.lagBytes)
    .filter((b): b is number => b !== undefined && Number.isFinite(b))
  return values.length > 0 ? Math.max(...values) : undefined
}

export function replicaLayersFromMetrics(layers: ComponentLayerMetrics[]): ComponentLayerMetrics[] {
  return layers.filter((layer) => layer.role === 'replica')
}

export function promotionCandidateLayer(
  layers: ComponentLayerMetrics[],
): ComponentLayerMetrics | undefined {
  return layers
    .filter(isReplicaConnectedOnPrimary)
    .find((layer) => layer.promotionCandidate)
}

export function liveSyncStateSummary(layers: ComponentLayerMetrics[]): string {
  const states = layers
    .filter(isReplicaConnectedOnPrimary)
    .map((layer) => layer.syncState?.trim())
    .filter((s): s is string => Boolean(s))
  if (states.length === 0) return FMT_EMPTY
  const unique = [...new Set(states.map((s) => fmtReplicaSyncState(s)))]
  return unique.join(', ')
}

export function fmtReplicaRollout(ready: number, desired: number): string {
  return `${fmtInt(ready)} / ${fmtInt(desired)} ready`
}

export function connectedReplicaSyncStates(layers: ComponentLayerMetrics[]): string[] {
  return layers
    .filter(isReplicaConnectedOnPrimary)
    .map((layer) => layer.syncState?.trim().toLowerCase() ?? '')
    .filter((state) => state.length > 0)
}

export function reportsDurabilitySync(states: string[]): boolean {
  return states.some((state) => DURABILITY_SYNC_STATES.has(state))
}

export interface ReplicationLagFlag {
  text: string
  tone: 'green' | 'amber'
}

/**
 * Lag tile flag. Async uses replay freshness. Sync and semi-sync use whether
 * a connected standby is actually the commit wait target.
 */
export function replicationLagFlag(
  maxLag: number | undefined,
  mode: ReplicationMode,
  states: string[],
): ReplicationLagFlag {
  if (maxLag === undefined) return { text: 'NO DATA', tone: 'amber' }
  const caughtUp = maxLag < REPLAY_CAUGHT_UP_SECONDS
  if (mode === 'async') {
    return caughtUp
      ? { text: 'CAUGHT UP', tone: 'green' }
      : { text: 'LAGGING', tone: 'amber' }
  }
  if (!reportsDurabilitySync(states)) return { text: 'NOT WAITING', tone: 'amber' }
  if (!caughtUp) return { text: 'REPLAY BEHIND', tone: 'amber' }
  return mode === 'semi-sync'
    ? { text: 'QUORUM', tone: 'green' }
    : { text: 'SYNC WAIT', tone: 'green' }
}

/** Canvas mode vs live pg_stat_replication.sync_state. Null when they agree or there is no live state. */
export function replicationConfigGap(
  mode: ReplicationMode,
  states: string[],
): string | null {
  if (states.length === 0) return null
  const durable = reportsDurabilitySync(states)
  if (mode === 'async' && durable) {
    return 'Canvas is async, but a standby reports sync or quorum. The primary is waiting on replication this config does not ask for.'
  }
  if (mode === 'sync' && !durable) {
    return 'Canvas is sync, but no connected standby reports sync_state=sync. Commits are not waiting on a replica.'
  }
  if (mode === 'semi-sync' && !durable) {
    return 'Canvas is semi-sync, but no connected standby reports quorum. Commits are not waiting on a replica.'
  }
  return null
}

export function syncCommitCaption(level: SyncCommitLevel): string {
  switch (level) {
    case 'remote_write':
      return 'synchronous_commit=remote_write: the client returns once a standby has received the WAL, before replay.'
    case 'remote_apply':
      return 'synchronous_commit=remote_apply: the client returns only after a standby has replayed the WAL.'
    default:
      return 'synchronous_commit=on: the client returns once a standby has flushed the WAL. Replay can still trail.'
  }
}

function readRoutingClause(policy: ReadConsistencyPolicy): string {
  switch (policy) {
    case 'leader-only':
      return 'Reads stay on the primary, so this lag does not stale app reads.'
    case 'replica':
      return 'App reads may use a standby, so this lag is visible staleness.'
    case 'ryw':
      return 'Read-your-writes holds a session on the primary until that client’s write is replayed.'
    case 'monotonic':
      return 'Monotonic reads stick to one replica; lag is how far that replica trails.'
    case 'ryw+monotonic':
      return 'Read-your-writes keeps a session on the primary until its write is replayed, then sticks to one replica.'
  }
}

export function replicationModeMeaning(
  mode: ReplicationMode,
  readConsistency: ReadConsistencyPolicy,
): string {
  const routing = readRoutingClause(readConsistency)
  if (mode === 'async') {
    return `Async commits after the primary flushes WAL locally. Replay lag is standby freshness, not a durability ack. ${routing}`
  }
  if (mode === 'semi-sync') {
    return `Semi-sync waits for any one quorum standby before commit returns. ${routing}`
  }
  return `Sync waits for the synchronous standby before commit returns. ${routing}`
}

export function walBehindFoot(mode: ReplicationMode, level: SyncCommitLevel): string {
  if (mode === 'async') return 'acked locally · not yet replayed'
  if (level === 'remote_apply') return 'commits wait for replay'
  if (level === 'remote_write') return 'commits wait for WAL receive'
  return 'commits wait for standby flush'
}

/** Primary app-SQL latency includes commit wait only when replication is synchronous. */
export function appLatencyCommitWaitNote(
  mode: ReplicationMode,
  level: SyncCommitLevel,
): string | null {
  if (mode === 'async') return null
  return `Primary write latency includes synchronous commit wait (${mode}, ${level}). Replica reads do not.`
}

export function engineClientScopeNote(readReplicas: number): string {
  if (readReplicas >= 1) {
    return 'Engine work counts every client (app, workers, replication), not app SQL totals.'
  }
  return 'Engine work counts every client on this database (app and workers), not app SQL totals.'
}
