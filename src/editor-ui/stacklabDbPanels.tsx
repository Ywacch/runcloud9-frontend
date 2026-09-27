import type { CanvasNode } from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { FMT_EMPTY, fmtInt, fmtRate } from '../lib/format'
import {
  connectedReplicaSyncStates,
  fmtLagBytes,
  fmtReplicaRollout,
  fmtReplicaSyncState,
  fmtReplicationLagSeconds,
  isReplicaConnectedOnPrimary,
  liveSyncStateSummary,
  maxConnectedReplicationLagSeconds,
  maxReplicaLagBytes,
  promotionCandidateLayer,
  replicaLayersFromMetrics,
  replicationConfigGap,
  replicationLagFlag,
  replicationModeMeaning,
  syncCommitCaption,
  walBehindFoot,
} from '../lib/dbReplicationDisplay'
import { readConsistencyFromConfig } from '../lib/readConsistency'
import {
  clampReadReplicas,
  normalizeReplicationModeForDeploy,
  normalizeSyncCommitLevelForDeploy,
  replicationModeFromConfig,
  requiresSynchronousReplication,
  syncCommitLevelFromConfig,
} from '../lib/replicaConfig'
import { shouldShowHighScanRatioHint, storageScopeLine } from '../lib/storageIoDisplay'
import type { StorageIoMetrics } from '../editor-core/domain/metricsUiContract'
import {
  SlSecHead,
  SlSpacer,
  SlTile,
  SlTileFoot,
  SlTileLab,
  SlTileVal,
  SlKv,
  SlKvList,
  SlTiles,
} from './stacklabPanePrimitives'
import { StacklabNote as Note } from './stacklabMetricsUi'

export function StacklabDbPatternBridge({
  m,
  dbQueryRate,
  modelEstimate,
}: {
  m: MetricsBucket
  dbQueryRate: number
  modelEstimate?: number | null
}) {
  const io = m.storageIo
  if (!io) return null
  const patternLabel = io.pattern?.trim()
  const note = io.patternNote?.trim() || io.footnote?.trim()
  const showRatioHint = shouldShowHighScanRatioHint(dbQueryRate, io.readRate)
  const showModel =
    modelEstimate != null &&
    modelEstimate > 0 &&
    (showRatioHint || modelEstimate > io.readRate * 2)
  const modelSuffix =
    showModel
      ? ` Modeled fanout load ~${fmtInt(Math.round(modelEstimate))} rows/s (worker telemetry, not this counter).`
      : ''
  if (!patternLabel && !note && !showRatioHint && !showModel) return null

  return (
    <>
      {patternLabel ? (
        <Note mark="?">
          Access pattern · <em>{patternLabel}</em>
          {note ? ` — ${note}` : ''}
          {modelSuffix}
        </Note>
      ) : note ? (
        <Note mark="?">
          {note}
          {modelSuffix}
        </Note>
      ) : null}
      {showRatioHint && !patternLabel ? (
        <Note mark="i">
          {fmtRate(dbQueryRate)} app queries/s vs {fmtRate(io.readRate)} rows scanned/s — scans
          amplify engine work beyond query count.
          {modelSuffix}
        </Note>
      ) : showModel && !patternLabel && !showRatioHint ? (
        <Note mark="~">{modelSuffix.trim()}</Note>
      ) : null}
    </>
  )
}

export function StacklabDbEngineFootnotes({
  io,
  role,
}: {
  io: StorageIoMetrics | null | undefined
  role: string
}) {
  if (!io) return null
  const scope = storageScopeLine(role, io, 'all clients')
  const foot = io.footnote?.trim()
  if (!scope && !foot) return null
  return (
    <Note mark="i">
      {scope}
      {foot && scope ? ` · ${foot}` : foot ?? ''}
    </Note>
  )
}

/** Replication breadcrumb: lag, WAL bytes, sync state, per-standby table. */
export function StacklabDbReplicationBody({
  m,
  node,
}: {
  m: MetricsBucket
  node: CanvasNode
}) {
  const replicaLayers = replicaLayersFromMetrics(m.layers)
  const configured = clampReadReplicas(node.config.readReplicas)
  const connected = replicaLayers.filter(isReplicaConnectedOnPrimary)
  const maxLag = maxConnectedReplicationLagSeconds(replicaLayers)
  const maxBytes = maxReplicaLagBytes(replicaLayers)
  const promote = promotionCandidateLayer(replicaLayers)
  const liveSync = liveSyncStateSummary(replicaLayers)
  const br = m.backendReplicas
  const deploySync = normalizeReplicationModeForDeploy(
    replicationModeFromConfig(node.config.replicationMode),
    configured,
  )
  const commitLevel = normalizeSyncCommitLevelForDeploy(
    syncCommitLevelFromConfig(node.config.syncCommitLevel),
    deploySync,
  )
  const readConsistency = readConsistencyFromConfig(node.config.readConsistency)
  const syncStates = connectedReplicaSyncStates(replicaLayers)
  const lagFlag = replicationLagFlag(maxLag, deploySync, syncStates)
  const configGap = replicationConfigGap(deploySync, syncStates)
  const syncWait = requiresSynchronousReplication(deploySync)

  return (
    <>
      <SlSecHead
        index="04"
        title="Is the replica keeping up?"
        subtitle={replicationModeMeaning(deploySync, readConsistency)}
      />
      <SlTiles>
        <SlTile>
          <SlTileLab>{replicaLayers.length > 1 ? 'Max replay lag' : 'Replay lag'}</SlTileLab>
          <SlTileVal tone={lagFlag.tone === 'green' ? 'green' : 'amber'}>
            {maxLag !== undefined ? fmtReplicationLagSeconds(maxLag) : '—'}
          </SlTileVal>
          <SlTileFoot>
            <span
              className={`flag ${lagFlag.tone}`}
              style={{ border: 'none', padding: 0 }}
            >
              {lagFlag.text}
            </span>
          </SlTileFoot>
        </SlTile>
        <SlTile>
          <SlTileLab>{replicaLayers.length > 1 ? 'Max WAL behind' : 'WAL behind'}</SlTileLab>
          <SlTileVal>{maxBytes !== undefined ? fmtLagBytes(maxBytes) : '—'}</SlTileVal>
          <SlTileFoot left={walBehindFoot(deploySync, commitLevel)} />
        </SlTile>
      </SlTiles>
      <Note mark="i">
        Lag is measured on connected standbys from pg_stat_replication when the primary exporter
        reports it.
        {syncWait ? ` ${syncCommitCaption(commitLevel)}` : ''}
      </Note>
      {configGap ? <Note mark="!">{configGap}</Note> : null}
      <SlKvList>
        <SlKv
          keyLabel="standby instances"
          value={
            br && br.desired > 0
              ? fmtReplicaRollout(br.ready, br.desired)
              : String(replicaLayers.length || configured)
          }
          tone="ok"
        />
        <SlKv keyLabel="deploy sync mode" value={deploySync} />
        {syncWait ? <SlKv keyLabel="synchronous_commit" value={commitLevel} /> : null}
        <SlKv keyLabel="read routing" value={readConsistency} />
        <SlKv
          keyLabel="live sync_state"
          value={liveSync !== FMT_EMPTY ? liveSync : 'not reported'}
        />
        {promote ? (
          <SlKv keyLabel="promote pick" value={promote.id} tone="ok" />
        ) : null}
      </SlKvList>
      {replicaLayers.length > 0 ? (
        <>
          <SlSpacer />
          <div className="pod-table" style={{ marginTop: 0 }}>
            <div className="pt idx h">
              <span>standby</span>
              <span className="r">replay lag</span>
              <span className="r">wal / sync</span>
            </div>
            {replicaLayers.map((layer) => {
              const disconnected = !isReplicaConnectedOnPrimary(layer)
              return (
                <div key={layer.id} className="pt idx">
                  <span>
                    {layer.id}
                    {layer.promotionCandidate && !disconnected ? ' · pick' : ''}
                  </span>
                  <span className="r">
                    {disconnected
                      ? 'not on primary'
                      : fmtReplicationLagSeconds(layer.replicationLagSeconds)}
                  </span>
                  <span className="r">
                    {disconnected
                      ? fmtLagBytes(layer.lagBytes)
                      : `${fmtLagBytes(layer.lagBytes)} · ${fmtReplicaSyncState(layer.syncState)}`}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <Note mark="i">
          No replica layers on the metrics stream yet. With {configured} standby
          {configured === 1 ? '' : 's'} configured, check that postgres_exporter is scraping
          pg_stat_replication.
        </Note>
      )}
      {connected.length === 0 && replicaLayers.length > 0 ? (
        <Note mark="!">All standbys are disconnected from pg_stat_replication on the primary.</Note>
      ) : null}
    </>
  )
}
