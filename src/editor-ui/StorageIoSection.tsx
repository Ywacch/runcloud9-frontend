import type { ReactNode } from 'react'
import { FMT_EMPTY, fmtBytes, fmtInt, fmtMs, fmtPct, fmtRate } from '../lib/format'
import {
  fanoutScanModelEstimate,
  formatDbQueriesPerSec,
  hasStorageMetrics,
  shouldShowHighScanRatioHint,
  storageIoSessionLabel,
  storageReadTileLabel,
  storageScopeLine,
  storageWriteTileLabel,
} from '../lib/storageIoDisplay'
import {
  dbLayerAppSqlHeadline,
  dbQueryHeadline,
  dbLayerHistorySeries,
  dbLayerXactHeadline,
  podHistorySeries,
  storageIoThroughputFields,
} from '../lib/metricTimeframe'
import {
  latencyGraphTitle,
  layerLatencyMs,
  layerSessionQuantileAvailable,
  podLatencyMs,
  podSessionQuantileAvailable,
} from '../lib/latencyQuantile'
import type { ComponentLayerMetrics, PodReplicaMetrics } from '../editor-core/domain/metricsUiContract'
import { layerResourcePercents } from '../editor-core/domain/metricsUiContract'
import {
  cacheLayerSectionLabels,
  isBackingCacheLayer,
  isLayeredCache,
} from '../lib/cacheLayerDisplay'
import type { MetricsBucket, WsEvent } from '../editor-core/stores/metricsStore'
import {
  failoverLossEscalation,
  failoverReadoutSummary,
  partitionActiveHint,
  partitionCapSummary,
  promotionWalBytesLost,
  standbyRecloneHints,
  type ChaosScenario,
} from '../lib/chaos'
import type { ReplicationMode, SyncCommitLevel } from '../lib/replicaConfig'
import { InspectorDisclosure } from './InspectorDisclosure'
import {
  CapacityBar,
  EngineDiagnosticsBlock,
  MetricSeriesGraph,
  PedagogicalHint,
  PedagogicalSection,
  PedagogicalCaption,
  StatBlock,
  StatRow,
  dbClusterResourceHelp,
  formatDbClusterResourceLabels,
  formatResourceLabels,
  memoryUsageHelp,
  resourceUsageHelp,
  shouldShowDbClusterUtilizationCharts,
  type PanelViewState,
} from './inspectorPanelUi'
import { LatencyDistribution } from './LatencyDistribution'
import { LatencyQuantileLabel } from './LatencyQuantileLabel'
import {
  LATENCY_HELP,
  SESSION_LATENCY_P99_HELP,
  THROUGHPUT_HELP,
} from '../lib/metricHelp'
import { InlineDisclosure } from './InlineDisclosure'
import { useDbTierCWarmup } from './useDbTierCWarmup'
import { ViewTraceButton } from './ViewTraceButton'
import {
  readConsistencyFromConfig,
  type ReadConsistencyPolicy,
} from '../lib/readConsistency'

/** RED — app SQL intent (app-server instrumentation). */
export function DbActivitySection({
  m,
  history,
  loadgenActive,
  dbRateHelp,
  view,
  showPlaybackDelay = false,
}: {
  m: MetricsBucket
  history: MetricsBucket[]
  loadgenActive: boolean
  dbRateHelp: string
  view: PanelViewState
  showPlaybackDelay?: boolean
}) {
  const storageReadRate = m.storageIo?.readRate ?? 0
  const dbHead = dbQueryHeadline(m, view.timeframe)
  const queriesDisplay =
    view.timeframe === 'session'
      ? fmtInt(dbHead.sessionTotal)
      : formatDbQueriesPerSec(
    m.dbQueryRate,
    m.dbQuerySource,
    storageReadRate,
    loadgenActive,
  )
  const queryRateSeries = history.map((h) => h.dbQueryRate)
  const errorSeries = history.map((h) => h.errorRate)
  const latencyMs =
    m.dbQueryLatency > 0
      ? m.dbQueryLatency * 1000
      : m.avgLatency > 0
        ? m.avgLatency
        : 0
  const latencySeries = history.map((h) =>
    h.dbQueryLatency > 0 ? h.dbQueryLatency * 1000 : h.avgLatency,
  )

  return (
    <PedagogicalSection
      title="Logical queries (RED)"
      subtitle="What clients intended / executed on the hot path"
    >
      <StatRow
        left={
          <StatBlock
            label={dbHead.label}
          value={queriesDisplay}
            help={
              view.timeframe === 'session'
                ? `${dbRateHelp} Timed SQL ops on app-server since those pods started.`
                : `${dbRateHelp} SQL from app-server instrumentation only.`
            }
            graph={
              <MetricSeriesGraph
                data={queryRateSeries}
                color="#6366f1"
                title="Query rate"
                unit="10s window"
                view={view}
                showPlaybackDelay={showPlaybackDelay}
              />
            }
          />
        }
        right={
          <StatBlock
            label="Error rate"
            value={`${fmtRate(m.errorRate)}/s`}
            graph={
              <MetricSeriesGraph
                data={errorSeries}
                color="var(--c9-error)"
                title="Error rate"
                unit="10s · /s"
                view={view}
                showPlaybackDelay={showPlaybackDelay}
              />
            }
          />
        }
      />
      <StatBlock
        label="Latency (p99)"
        value={latencyMs > 0 ? fmtMs(latencyMs) : FMT_EMPTY}
        help={dbRateHelp}
        graph={
          latencySeries.some((v) => v > 0) ? (
            <MetricSeriesGraph
              data={latencySeries}
              color="var(--c9-warning)"
          title="Query latency"
              unit="10s · ms"
              view={view}
          showPlaybackDelay={showPlaybackDelay}
            />
          ) : null
        }
      />
    </PedagogicalSection>
  )
}

/** USE — Postgres engine execution + access pattern. */
export function DbLoadSection({
  m,
  dbQueryRate,
  templateMetrics,
  view,
  showPlaybackDelay = false,
  history = [],
}: {
  m: MetricsBucket
  dbQueryRate: number
  templateMetrics: Record<string, number>
  view: PanelViewState
  showPlaybackDelay?: boolean
  history?: MetricsBucket[]
}) {
  if (!hasStorageMetrics(m) || !m.storageIo) return null

  const engine = (m.storageEngine ?? 'postgresql').trim()
  const io = m.storageIo
  const readRate = io.readRate
  const isSession = view.timeframe === 'session'
  const readLabelRaw = storageReadTileLabel(io, engine)
  const writeLabelRaw = storageWriteTileLabel(io, engine)
  const ioTiles = storageIoThroughputFields(
    m,
    view.timeframe,
    isSession ? storageIoSessionLabel(readLabelRaw) : readLabelRaw,
    isSession ? storageIoSessionLabel(writeLabelRaw) : writeLabelRaw,
    fmtRate,
  )
  const readSeries = history.map((h) => h.storageIo?.readRate ?? 0)
  const writeSeries = history.map((h) => h.storageIo?.writeRate ?? 0)
  const modelEstimate = fanoutScanModelEstimate(templateMetrics)
  const hasPattern = Boolean(io.pattern?.trim())
  const patternLabel = io.pattern?.trim() || null

  return (
    <PedagogicalSection
      title="Storage execution (USE & pattern)"
      subtitle="How the underlying storage engine processes the queries"
    >
      {patternLabel ? (
        <div className="inline-flex rounded border border-cyan-500/30 bg-cyan-950/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-300">
          Access pattern · {patternLabel}
      </div>
      ) : null}
      <StatRow
        left={
          <StatBlock
            label={ioTiles.readLabel}
            value={ioTiles.readValue}
            graph={
              isSession ? undefined : (
                <MetricSeriesGraph
                  data={readSeries}
                  color="#22d3ee"
                  title="Rows scanned"
                  unit="10s · /s"
                  view={view}
                  showPlaybackDelay={showPlaybackDelay}
                />
              )
            }
          />
        }
        right={
          <StatBlock
            label={ioTiles.writeLabel}
            value={ioTiles.writeValue}
            graph={
              isSession ? undefined : (
                <MetricSeriesGraph
                  data={writeSeries}
                  color="#a78bfa"
                  title="Rows written"
                  unit="10s · /s"
                  view={view}
                  showPlaybackDelay={showPlaybackDelay}
                />
              )
            }
          />
        }
      />
      {modelEstimate != null && modelEstimate > 0 && !isSession ? (
        <p className="font-mono text-[10px] text-violet-300/90">
          Model (est.): ~{fmtRate(modelEstimate)}/s row scans from fanout formula
        </p>
      ) : null}
      {!isSession && !hasPattern && shouldShowHighScanRatioHint(dbQueryRate, readRate) ? (
        <InlineDisclosure label="Why reads look high">
          <PedagogicalHint>
            Inefficient access pattern: {fmtRate(dbQueryRate)} logical queries are causing{' '}
            {fmtRate(readRate)} row/document reads per second. Check the Data tab for a missing
            index that may be causing O(N) sequential scans.
          </PedagogicalHint>
        </InlineDisclosure>
      ) : null}
      {io.patternNote?.trim() ? (
        <InlineDisclosure label="About this access pattern">
          <PedagogicalHint tone="muted">{io.patternNote.trim()}</PedagogicalHint>
        </InlineDisclosure>
      ) : null}
      <StorageIoScopeFooter m={m} isPostgres />
    </PedagogicalSection>
  )
}

export function DbClusterResourcesSection({
  nodeId,
  m,
  cpuPercent,
  memPercent,
  view,
  showPlaybackDelay = false,
  history = [],
}: {
  nodeId: string
  m: MetricsBucket
  cpuPercent: number
  memPercent: number
  view: PanelViewState
  showPlaybackDelay?: boolean
  history?: MetricsBucket[]
}) {
  const warmingUp = useDbTierCWarmup(nodeId, m)

  const clusterCpuPercent = cpuPercent
  const clusterMemPercent = memPercent

  const labels = formatDbClusterResourceLabels(
    m,
    clusterCpuPercent,
    clusterMemPercent,
    warmingUp,
  )
  const showUtilizationCharts = shouldShowDbClusterUtilizationCharts(m, warmingUp)
  const cpuSeries = showUtilizationCharts ? history.map((h) => h.cpuPercent) : []
  const memSeries = showUtilizationCharts ? history.map((h) => h.memPercent) : []
  const resourceHelp = dbClusterResourceHelp(m, warmingUp)

  return (
    <PedagogicalSection
      title="Cluster resources (USE)"
      subtitle="Hardware utilization handling the execution load"
    >
      <StatRow
        left={
          <StatBlock
            label="CPU utilization"
            value={labels.cpu}
            help={resourceHelp}
            graph={
              showUtilizationCharts ? (
                <MetricSeriesGraph
                  data={cpuSeries}
                  color="#f59e0b"
                  title="CPU"
                  unit="10s · %"
                  view={view}
                  showPlaybackDelay={showPlaybackDelay}
                />
              ) : undefined
            }
          />
        }
        right={
          <StatBlock
            label="Memory usage"
            value={labels.mem}
            graph={
              showUtilizationCharts ? (
                <MetricSeriesGraph
                  data={memSeries}
                  color="#8b5cf6"
                  title="Memory"
                  unit="10s · %"
                  view={view}
                  showPlaybackDelay={showPlaybackDelay}
                />
              ) : undefined
            }
          />
        }
      />
      {showUtilizationCharts ? <CapacityBar pct={clusterCpuPercent} /> : null}
      {resourceHelp ? (
        <InlineDisclosure label="About these metrics">
          <PedagogicalHint tone="muted">{resourceHelp}</PedagogicalHint>
        </InlineDisclosure>
      ) : null}
    </PedagogicalSection>
  )
}

/** Per-instance postgres layer metrics for Primary / Replica inspector tabs. */
export function DbInstanceLayerSection({
  layer,
  view,
  history = [],
  showPlaybackDelay = false,
  onPanelViewChange,
}: {
  layer: ComponentLayerMetrics
  view: PanelViewState
  history?: MetricsBucket[]
  showPlaybackDelay?: boolean
  onPanelViewChange?: (patch: Partial<PanelViewState>) => void
}) {
  const { cpuPercent, memPercent } = layerResourcePercents(layer)
  const roleLabel = layer.role === 'primary' ? 'Primary' : 'Replica'
  const tf = view.timeframe
  const quantile = view.latencyQuantile
  const appSql = dbLayerAppSqlHeadline(layer, tf)
  const appSqlValue =
    tf === 'session'
      ? fmtInt(appSql.sessionTotal)
      : appSql.liveRate > 0
        ? `${fmtRate(appSql.liveRate)}/s`
        : FMT_EMPTY
  const appSqlLatencyMs = layerLatencyMs(layer, quantile, tf)
  const appSqlRateSeries = dbLayerHistorySeries(
    history,
    layer.id,
    (l) => (tf === 'session' ? l.dbTotalQueries ?? 0 : l.dbQueryRate ?? 0),
  )
  const appSqlLatencySeries = dbLayerHistorySeries(history, layer.id, (l) =>
    layerLatencyMs(l, quantile, 'live'),
  )
  const xact = dbLayerXactHeadline(layer, tf)
  const xactValue =
    tf === 'session' ? fmtInt(xact.sessionTotal) : `${fmtRate(xact.liveRate)}/s`
  const xactSeries = dbLayerHistorySeries(
    history,
    layer.id,
    (l) => (tf === 'session' ? l.totalRequests ?? 0 : l.requestRate ?? 0),
  )
  const engine = (layer.engine || 'postgresql').trim()
  const io = layer.storageIo
  const readLabel = io ? storageReadTileLabel(io, engine) : 'Rows scanned/s'
  const writeLabel = io ? storageWriteTileLabel(io, engine) : 'Rows written/s'
  const layerIoBucket: MetricsBucket = {
    storageEngine: engine,
    storageIo: io ?? null,
  } as MetricsBucket
  const ioTiles =
    io != null
      ? storageIoThroughputFields(layerIoBucket, tf, readLabel, writeLabel, fmtRate)
      : null
  const readSeries = dbLayerHistorySeries(history, layer.id, (l) => l.storageIo?.readRate ?? 0)
  const writeSeries = dbLayerHistorySeries(history, layer.id, (l) => l.storageIo?.writeRate ?? 0)
  const isReplica = layer.role === 'replica'

  return (
    <PedagogicalSection
      title={`${roleLabel} instance (RED + USE + engine)`}
      subtitle="App SQL by target, engine xact, connections, and row I/O for this postgres instance"
    >
      <StatRow
        left={
          <StatBlock
            label={appSql.label}
            value={appSqlValue}
            help={
              tf === 'session'
                ? 'Timed SQL ops on this histogram target since app-server pods started.'
                : 'App SQL throughput for this histogram target (db_query_duration_seconds).'
            }
            graph={
              <MetricSeriesGraph
                data={appSqlRateSeries}
                color="#6366f1"
                title={appSql.label}
                unit={tf === 'session' ? 'session total' : '10s · /s'}
                view={view}
                showPlaybackDelay={showPlaybackDelay}
              />
            }
          />
        }
        right={
          <StatBlock
            labelNode={
              <LatencyQuantileLabel
                quantile={quantile}
                timeframe={tf}
                sessionAvailable={(q) => layerSessionQuantileAvailable(layer, q)}
                onChange={(q) => onPanelViewChange?.({ latencyQuantile: q })}
              />
            }
            value={appSqlLatencyMs > 0 ? fmtMs(appSqlLatencyMs) : FMT_EMPTY}
            help={tf === 'session' ? SESSION_LATENCY_P99_HELP : LATENCY_HELP}
            graph={
              <MetricSeriesGraph
                data={appSqlLatencySeries}
                color="var(--c9-error)"
                title={latencyGraphTitle(quantile)}
                unit="10s · ms"
                view={view}
                showPlaybackDelay={showPlaybackDelay}
              />
            }
          />
        }
      />
      <StatRow
        left={
          <StatBlock
            label={xact.label}
            value={xactValue}
            help="PostgreSQL transaction commits + rollbacks for this instance (exporter xact counters)."
            graph={
              <MetricSeriesGraph
                data={xactSeries}
                color="#6366f1"
                title={xact.label}
                unit={tf === 'session' ? 'session total' : '10s · /s'}
                view={view}
                showPlaybackDelay={showPlaybackDelay}
              />
            }
          />
        }
        right={
          <StatBlock
            label="Active connections"
            value={
              layer.dbActiveConnections != null && layer.dbActiveConnections > 0
                ? fmtInt(layer.dbActiveConnections)
                : FMT_EMPTY
            }
            help="Backends in active state on this instance's postgres pod."
          />
        }
      />
      {ioTiles ? (
        <StatRow
          left={
            <StatBlock
              label={ioTiles.readLabel}
              value={ioTiles.readValue}
              graph={
                <MetricSeriesGraph
                  data={readSeries}
                  color="#22d3ee"
                  title="Rows scanned"
                  unit="10s · /s"
                  view={view}
                  showPlaybackDelay={showPlaybackDelay}
                />
              }
            />
          }
          right={
            !isReplica ? (
              <StatBlock
                label={ioTiles.writeLabel}
                value={ioTiles.writeValue}
                graph={
                  <MetricSeriesGraph
                    data={writeSeries}
                    color="#a78bfa"
                    title="Rows written"
                    unit="10s · /s"
                    view={view}
                    showPlaybackDelay={showPlaybackDelay}
                  />
                }
              />
            ) : null
          }
        />
      ) : null}
      <StatRow
        left={
          <StatBlock
            label="CPU utilization"
            value={layer.cpuIsEstimated ? FMT_EMPTY : fmtPct(cpuPercent)}
          />
        }
        right={
          <StatBlock
            label="Memory usage"
            value={layer.memIsEstimated ? FMT_EMPTY : fmtPct(memPercent)}
          />
        }
      />
      {layer.role === 'replica' ? (
        <StatBlock
          label="Replay lag"
          value={fmtReplicationLagSeconds(layer.replicationLagSeconds)}
          help="Seconds between primary commit and replay on this standby."
        />
      ) : null}
      {isReplica ? (
        <InlineDisclosure label="About replica metrics">
          <PedagogicalHint tone="muted">
            App SQL counts queries routed to this replica target. Row scans may still include
            some WAL apply overhead; after read-split, student SELECTs appear in both tiles.
          </PedagogicalHint>
        </InlineDisclosure>
      ) : null}
    </PedagogicalSection>
  )
}

/** Per-pod compute metrics for Cluster | pod inspector tabs. */
export function ComputeInstanceSection({
  pod,
  m,
  view,
  history = [],
  showPlaybackDelay = false,
  subtitle = 'Traffic and resources for this app-server pod',
  onPanelViewChange,
  liveThroughputLabel = 'Request rate',
  sessionThroughputLabel = 'Total requests',
  liveErrorLabel = 'Error rate',
  sessionErrorLabel = 'Errors',
  throughputHelp = THROUGHPUT_HELP,
}: {
  pod: PodReplicaMetrics
  m: MetricsBucket
  view: PanelViewState
  history?: MetricsBucket[]
  showPlaybackDelay?: boolean
  subtitle?: string
  onPanelViewChange?: (patch: Partial<PanelViewState>) => void
  liveThroughputLabel?: string
  sessionThroughputLabel?: string
  liveErrorLabel?: string
  sessionErrorLabel?: string
  throughputHelp?: string
}) {
  const tf = view.timeframe
  const quantile = view.latencyQuantile
  const replicas = m.podReplicas.length > 0 ? m.podReplicas.length : 1
  const cpuLimitPerPod = m.cpuLimit > 0 ? m.cpuLimit / replicas : 0
  const memLimitPerPod = m.memoryLimit > 0 ? m.memoryLimit / replicas : 0
  const memFallbackBytes = 512 * 1024 * 1024
  const cpuPct =
    cpuLimitPerPod > 0
      ? Math.min(100, (pod.cpuUsage / cpuLimitPerPod) * 100)
      : Math.min(100, pod.cpuUsage * 100)
  const memPct =
    pod.memoryBytes > 0 && memLimitPerPod > 0
      ? Math.min(100, (pod.memoryBytes / memLimitPerPod) * 100)
      : pod.memoryBytes > 0
        ? Math.min(100, (pod.memoryBytes / memFallbackBytes) * 100)
        : 0
  const throughputLabel = tf === 'session' ? sessionThroughputLabel : liveThroughputLabel
  const throughputValue =
    tf === 'session' ? fmtInt(pod.totalRequests ?? 0) : `${fmtRate(pod.requestRate)}/s`
  const errorLabel = tf === 'session' ? sessionErrorLabel : liveErrorLabel
  const errorValue =
    tf === 'session'
      ? fmtInt(pod.totalErrors9m ?? 0)
      : `${fmtRate(pod.errorRate)}/s`
  const latencyMs = podLatencyMs(pod, quantile, tf)
  const rpsSeries = podHistorySeries(history, pod.name, (p) => p.requestRate)
  const latencySeries = podHistorySeries(history, pod.name, (p) =>
    podLatencyMs(p, quantile, 'live'),
  )
  const errorSeries = podHistorySeries(
    history,
    pod.name,
    (p) => (tf === 'session' ? p.totalErrors9m ?? 0 : p.errorRate),
  )

  return (
    <PedagogicalSection title="Pod instance (USE + RED)" subtitle={subtitle}>
      <StatRow
        left={
          <StatBlock
            label={throughputLabel}
            value={throughputValue}
            help={throughputHelp}
            graph={
              <MetricSeriesGraph
                data={rpsSeries}
                color="#6366f1"
                title="Throughput"
                unit={tf === 'session' ? 'session total' : '10s · RPS'}
                view={view}
                showPlaybackDelay={showPlaybackDelay}
              />
            }
          />
        }
        right={
          <StatBlock
            labelNode={
              <LatencyQuantileLabel
                quantile={quantile}
                timeframe={tf}
                sessionAvailable={(q) => podSessionQuantileAvailable(pod, q)}
                onChange={(q) => onPanelViewChange?.({ latencyQuantile: q })}
              />
            }
            value={latencyMs > 0 ? fmtMs(latencyMs) : FMT_EMPTY}
            help={tf === 'session' ? SESSION_LATENCY_P99_HELP : LATENCY_HELP}
            graph={
              <MetricSeriesGraph
                data={latencySeries}
                color="var(--c9-error)"
                title={latencyGraphTitle(quantile)}
                unit="10s · ms"
                view={view}
                showPlaybackDelay={showPlaybackDelay}
              />
            }
          />
        }
      />
      {tf === 'live' &&
      ((pod.p50LatencyMs ?? 0) > 0 ||
        (pod.p95LatencyMs ?? 0) > 0 ||
        pod.p99LatencyMs > 0) ? (
        <LatencyDistribution
          p50Ms={pod.p50LatencyMs ?? 0}
          p95Ms={pod.p95LatencyMs ?? 0}
          p99Ms={pod.p99LatencyMs}
          label="Latency distribution (live)"
          compact
          selectedQuantile={quantile}
          onSelectQuantile={(q) => onPanelViewChange?.({ latencyQuantile: q })}
        />
      ) : null}
      <StatRow
        left={
          <StatBlock
            label={errorLabel}
            value={errorValue}
            graph={
              <MetricSeriesGraph
                data={errorSeries}
                color="var(--c9-warning)"
                title="Errors"
                unit={tf === 'session' ? 'session total' : '10s · /s'}
                view={view}
                showPlaybackDelay={showPlaybackDelay}
              />
            }
          />
        }
        right={
          <StatBlock label="CPU utilization" value={fmtPct(cpuPct)} />
        }
      />
      <StatBlock
        label="Memory usage"
        value={memPct > 0 ? fmtPct(memPct) : FMT_EMPTY}
      />
    </PedagogicalSection>
  )
}

function fmtReplicationLagSeconds(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds)) return FMT_EMPTY
  if (seconds < 0.01) return '0 s'
  if (seconds < 10) return `${seconds.toFixed(2)} s`
  return `${seconds.toFixed(1)} s`
}

function fmtLagBytes(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes)) return FMT_EMPTY
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}

function fmtReplicaSyncState(syncState: string | undefined): string {
  const state = syncState?.trim()
  return state ? state : 'async'
}

export function formatConsistencyViolation(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return 'OK'
  return count === 1 ? '1 violation' : `${fmtInt(count)} violations`
}

function fmtStalenessVersions(versions: number): string {
  if (!Number.isFinite(versions) || versions <= 0) return '0'
  return fmtInt(versions)
}

function formatReadOffload(leaderReads: number, replicaReads: number): string {
  const total = leaderReads + replicaReads
  if (total <= 0) return FMT_EMPTY
  const offloadPct = Math.min(100, Math.round((replicaReads / total) * 100))
  return `${offloadPct}% (${fmtInt(replicaReads)} replica · ${fmtInt(leaderReads)} leader)`
}

function formatStaleReplicaReads(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return '0'
  return count === 1 ? '1 read' : `${fmtInt(count)} reads`
}

function formatGuaranteeHeldBy(held?: string): string {
  switch (held) {
    case 'app':
      return 'App (redirects)'
    case 'db':
      return 'Database'
    case 'none':
      return 'None requested'
    default:
      return held?.trim() || FMT_EMPTY
  }
}

function consistencyPolicyHint(policy: ReadConsistencyPolicy): string {
  switch (policy) {
    case 'leader-only':
      return 'Leader-only: all reads hit the primary; no replica offload.'
    case 'replica':
      return 'Replica (eventual): reads are offloaded to standbys; stale replica reads are the expected tradeoff.'
    case 'ryw':
      return 'Read-your-writes: app redirects hold the guarantee; RYW violations should stay near zero.'
    case 'monotonic':
      return 'Monotonic reads: stick to one replica; monotonic violations flag time going backwards.'
    case 'ryw+monotonic':
      return 'RYW + monotonic: redirects hold RYW; monotonic violations flag backwards time on a sticky replica.'
  }
}

/** Read-replica replay lag when db instance layers are present (Wave 3 PR4). */
export function DbReplicaLagSection({ m }: { m: MetricsBucket }) {
  const replicaLayers = m.layers.filter((layer) => layer.role === 'replica')
  if (replicaLayers.length === 0) return null

  const br = m.backendReplicas
  const single = replicaLayers.length === 1 ? replicaLayers[0] : null
  const maxLag = Math.max(...replicaLayers.map((layer) => layer.replicationLagSeconds ?? 0))
  const promotionCandidate = replicaLayers.find((layer) => layer.promotionCandidate)
  const showPromotionPreview = replicaLayers.some(
    (layer) => layer.syncState !== undefined || layer.lagBytes !== undefined || layer.promotionCandidate,
  )

  return (
    <PedagogicalSection
      title="Read replicas"
      subtitle={
        showPromotionPreview
          ? 'Replay lag, sync state, and which standby promote_replica would pick'
          : 'Primary-side replay lag per streaming standby'
      }
    >
      <StatRow
        left={
          br && br.desired > 0 ? (
            <StatBlock
              label="Replica rollout"
              value={`${fmtInt(br.ready)} / ${fmtInt(br.desired)} ready`}
            />
          ) : (
            <StatBlock label="Standby instances" value={fmtInt(replicaLayers.length)} />
          )
        }
        right={
          <StatBlock
            label={single ? 'Replay lag' : 'Max replay lag'}
            value={fmtReplicationLagSeconds(
              single ? single.replicationLagSeconds : maxLag,
            )}
            help="Seconds between primary commit and replay on the standby (~0 when caught up)."
          />
        }
      />
      {showPromotionPreview && promotionCandidate ? (
        <PedagogicalHint>
          <span className="font-mono">{promotionCandidate.id}</span> would be promoted by{' '}
          <span className="font-mono">promote_replica</span>
          {promotionCandidate.lagBytes !== undefined
            ? ` (${fmtLagBytes(promotionCandidate.lagBytes)} behind, ${fmtReplicaSyncState(promotionCandidate.syncState)})`
            : ` (${fmtReplicaSyncState(promotionCandidate.syncState)})`}
          . Use <span className="font-mono">promote_lagging_replica</span> to deliberately pick a
          farther-behind standby.
        </PedagogicalHint>
      ) : null}
      {replicaLayers.length > 1 ? (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            {showPromotionPreview ? 'Per-replica promotion preview' : 'Per-replica lag'}
          </p>
          <ul className="space-y-1 font-mono text-[11px] text-gray-300">
            {replicaLayers.map((layer) => (
              <li key={layer.id} className="flex flex-col gap-0.5">
                <div className="flex justify-between gap-2">
                  <span className="truncate">
                    {layer.id}
                    {layer.promotionCandidate ? ' · promote pick' : ''}
                  </span>
                  <span>{fmtReplicationLagSeconds(layer.replicationLagSeconds)}</span>
                </div>
                {showPromotionPreview ? (
                  <div className="flex justify-between gap-2 text-[10px] text-gray-500">
                    <span>{fmtReplicaSyncState(layer.syncState)}</span>
                    <span>{fmtLagBytes(layer.lagBytes)} behind</span>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : showPromotionPreview && single ? (
        <div className="space-y-1 font-mono text-[11px] text-gray-300">
          <div className="flex justify-between gap-2">
            <span>{fmtReplicaSyncState(single.syncState)}</span>
            <span>{fmtLagBytes(single.lagBytes)} behind</span>
          </div>
        </div>
      ) : null}
    </PedagogicalSection>
  )
}

function formatPartitionCapRule(rule?: string): string {
  if (rule === 'partition_stale_reads') return 'Stale replica reads'
  if (rule === 'partition_write_stall') return 'Writes stalling'
  return FMT_EMPTY
}

/** Read-routing tradeoffs when backend ships `components.db.consistency`. */
export function DbConsistencySection({
  m,
  readConsistencyPolicy,
  replicationMode = 'async',
  readReplicas = 0,
  syncCommitLevel = 'on',
  activePartitionScenario,
  partitionCapEvent,
  promotionChaosEvent,
  failoverWriteLossEvent,
  standbyRecloneEvent,
}: {
  m: MetricsBucket
  readConsistencyPolicy?: ReadConsistencyPolicy
  replicationMode?: ReplicationMode
  readReplicas?: number
  syncCommitLevel?: SyncCommitLevel
  activePartitionScenario?: ChaosScenario | null
  partitionCapEvent?: WsEvent | null
  promotionChaosEvent?: WsEvent | null
  failoverWriteLossEvent?: WsEvent | null
  standbyRecloneEvent?: WsEvent | null
}) {
  const consistency = m.consistency
  if (!consistency) return null

  const policy = readConsistencyPolicy ?? readConsistencyFromConfig(undefined)
  const capSummary = partitionCapSummary(
    partitionCapEvent ?? null,
    replicationMode,
    readReplicas,
    syncCommitLevel,
    consistency.guaranteeHeldBy,
  )
  const partitionHint = activePartitionScenario
    ? partitionActiveHint(activePartitionScenario, replicationMode, readReplicas)
    : null
  const failoverSummary = failoverReadoutSummary(
    promotionChaosEvent ?? null,
    failoverWriteLossEvent ?? null,
    replicationMode,
    syncCommitLevel,
  )
  const failoverEscalation = failoverLossEscalation(failoverWriteLossEvent ?? null)
  const walBytesLost = promotionWalBytesLost(promotionChaosEvent?.detail)
  const promotedPod = promotionChaosEvent?.detail?.promotedPod?.trim()
  const candidateSyncState = promotionChaosEvent?.detail?.candidateSyncState?.trim()
  const candidateLagBytes = Number(promotionChaosEvent?.detail?.candidateLagBytes ?? '')
  const recloneHints = standbyRecloneHints(standbyRecloneEvent ?? null)

  return (
    <PedagogicalSection
      title="Read routing tradeoffs"
      subtitle="The guarantee you asked for, and what staying off the leader cost you."
    >
      {partitionCapEvent || partitionHint ? (
        <>
          <PedagogicalCaption>Under partition</PedagogicalCaption>
          {partitionCapEvent ? (
            <StatBlock
              label="What broke"
              value={formatPartitionCapRule(partitionCapEvent.rule)}
              help={capSummary ?? partitionCapEvent.title}
            />
          ) : null}
          {partitionHint ? (
            <PedagogicalHint tone="muted">{partitionHint}</PedagogicalHint>
          ) : null}
          {capSummary && partitionCapEvent ? (
            <PedagogicalHint>{capSummary}</PedagogicalHint>
          ) : null}
        </>
      ) : null}
      {promotionChaosEvent ? (
        <>
          <PedagogicalCaption>After failover</PedagogicalCaption>
          <StatRow
            left={
              <StatBlock
                label="WAL bytes lost"
                value={walBytesLost > 0 ? fmtBytes(walBytesLost) : '0 B'}
                help="Bytes on the fenced primary that never reached the promoted standby."
              />
            }
            right={
              <StatBlock
                label="Promoted pod"
                value={promotedPod || FMT_EMPTY}
                help="Standby pod promoted to primary and wired to the db Service."
              />
            }
          />
          <StatRow
            left={
              <StatBlock
                label="Candidate sync state"
                value={candidateSyncState || 'async'}
                help="sync_state from pg_stat_replication when the candidate was chosen."
              />
            }
            right={
              Number.isFinite(candidateLagBytes) && candidateLagBytes >= 0 ? (
                <StatBlock
                  label="Lag at selection"
                  value={fmtBytes(candidateLagBytes)}
                  help="Byte distance behind the fenced primary when the candidate was chosen."
                />
              ) : null
            }
          />
          {failoverSummary ? <PedagogicalHint>{failoverSummary}</PedagogicalHint> : null}
          {failoverEscalation ? (
            <PedagogicalHint>{failoverEscalation}</PedagogicalHint>
          ) : null}
          {recloneHints.map((hint) => (
            <PedagogicalHint key={hint}>{hint}</PedagogicalHint>
          ))}
        </>
      ) : null}
      <StatRow
        left={
          <StatBlock
            label="Read offload"
            value={formatReadOffload(consistency.leaderReads, consistency.replicaReads)}
            help="Share of app reads served from replicas vs the primary (db_read_total by route)."
          />
        }
        right={
          <StatBlock
            label="Stale replica reads"
            value={formatStaleReplicaReads(consistency.replicaStaleReads)}
            help="Replica reads served while replay lagged the client's last write. Eventual-policy cost, not RYW violations."
          />
        }
      />
      <StatRow
        left={
          <StatBlock
            label="RYW violations"
            value={formatConsistencyViolation(consistency.rywViolations)}
            help="Promised read-your-writes guarantee failed. Should stay near zero when app redirects are working."
          />
        }
        right={
          <StatBlock
            label="Held by"
            value={formatGuaranteeHeldBy(consistency.guaranteeHeldBy)}
            help="Who enforces the read guarantee. None = not requested; app = leader redirects after writes."
          />
        }
      />
      <PedagogicalCaption>Observer canary (secondary)</PedagogicalCaption>
      <StatRow
        left={
          <StatBlock
            label="Monotonic reads"
            value={formatConsistencyViolation(consistency.monotonicViolations)}
            help="Observer: a later replica read returned a lower version than an earlier one."
          />
        }
        right={
          <StatBlock
            label="Cache vs database"
            value={formatConsistencyViolation(consistency.cacheDbStale)}
            help="Sampled cache hit served a different value than the primary (not the platform probe key)."
          />
        }
      />
      <StatBlock
        label="Probe replica lag"
        value={`${fmtStalenessVersions(consistency.replicaStalenessVersions)} versions`}
        help="Observer canary: logical versions the replica trails the latest primary write (lag probe, not student RYW)."
      />
      <PedagogicalHint tone="muted">{consistencyPolicyHint(policy)}</PedagogicalHint>
      {consistency.lastCacheKey ? (
        <p className="text-[11px] leading-relaxed text-[var(--c9-muted)]">
          <span className="font-mono text-[var(--c9-text)]">{consistency.lastCacheKey}</span>
          {' served '}
          {consistency.lastCacheServed ?? FMT_EMPTY}
          {' · db '}
          {consistency.lastCacheTruth ?? FMT_EMPTY}
          {consistency.lastCacheRequestID ? (
            <>
              {' · '}
              <ViewTraceButton requestId={consistency.lastCacheRequestID} />
            </>
          ) : null}
        </p>
      ) : null}
      {consistency.lastProbeError ? (
        <PedagogicalHint>
          Probe error: {consistency.lastProbeError}
        </PedagogicalHint>
      ) : null}
    </PedagogicalSection>
  )
}

export function DbDiagnosticsDisclosure({
  m,
  maxConnections,
}: {
  m: MetricsBucket
  maxConnections: number
}) {
  const maxConn = maxConnections > 0 ? maxConnections : 100
  const connPct = maxConn > 0 ? (m.dbActiveConnections / maxConn) * 100 : 0
  const io = m.storageIo

  return (
    <InspectorDisclosure title="Engine detail & diagnostics">
      <div className="space-y-2 font-mono text-[11px] text-gray-300">
        <div>
          Active connections · {fmtInt(m.dbActiveConnections)} / {fmtInt(maxConn)}
          <CapacityBar pct={connPct} warnAt={60} criticalAt={85} />
      </div>
        {io && io.bytesUsed > 0 ? (
          <div>Data size · {fmtBytes(io.bytesUsed)}</div>
        ) : null}
        {io && io.errorRate > 0 ? (
          <div>Rollbacks · {fmtRate(io.errorRate)}/s</div>
        ) : null}
      </div>
      <InlineDisclosure label="About these metrics">
        <PedagogicalHint tone="muted">
          Engine-specific (PostgreSQL) metrics. High connection counts can lead to connection
          pooling bottlenecks.
        </PedagogicalHint>
      </InlineDisclosure>
    </InspectorDisclosure>
  )
}

/** Redis command throughput — engine USE layer for cache nodes. */
export function CombinedCacheCanvasRow({
  m,
  cpuPercent,
  memPercent,
}: {
  m: MetricsBucket
  cpuPercent: number
  memPercent: number
}) {
  const labels = formatResourceLabels(m, cpuPercent, memPercent)
  return (
    <p
      className="border-t border-dashed border-gray-800/80 pt-3 font-mono text-[10px] text-gray-600"
      title="The canvas node rim uses aggregate CPU and memory from all processes below."
    >
      Total on canvas node · CPU {labels.cpu} · Mem {labels.mem}
    </p>
  )
}

function syntheticBucketFromLayer(
  layer: ComponentLayerMetrics,
  component: MetricsBucket,
  includeStorageIo: boolean,
): MetricsBucket {
  const { cpuPercent, memPercent } = layerResourcePercents(layer)
  return {
    ...component,
    cpuUsage: layer.cpuUsage,
    memoryBytes: layer.memoryBytes,
    cpuLimit: layer.cpuLimit,
    memoryLimit: layer.memoryLimit,
    cpuIsEstimated: layer.cpuIsEstimated,
    memIsEstimated: layer.memIsEstimated,
    cpuSource: layer.cpuSource,
    memSource: layer.memSource,
    freshness: layer.freshness,
    cpuPercent,
    memPercent,
    storageEngine: layer.engine || component.storageEngine,
    storageIo: includeStorageIo ? component.storageIo : null,
    redisOpsPerSec: layer.redisOpsPerSec ?? 0,
    redisKeyspaceHits: layer.redisKeyspaceHits ?? 0,
    redisKeyspaceMisses: layer.redisKeyspaceMisses ?? 0,
    redisRejectedRate: layer.redisRejectedRate ?? 0,
  }
}

export function CacheLayerResourceBlock({
  layer,
  component,
  evictionPolicy,
  view,
  showPlaybackDelay: _showPlaybackDelay = false,
}: {
  layer: ComponentLayerMetrics
  component: MetricsBucket
  evictionPolicy?: string
  view: PanelViewState
  showPlaybackDelay?: boolean
}) {
  const backing = isBackingCacheLayer(layer)
  const layerBucket = syntheticBucketFromLayer(layer, component, backing)
  const { cpuPercent, memPercent } = layerResourcePercents(layer)
  const labels = cacheLayerSectionLabels(layer)
  const resourceHelp = resourceUsageHelp(layerBucket)
  const memHelp = memoryUsageHelp(layerBucket, memPercent)
  const cpuLabel = formatResourceLabels(layerBucket, cpuPercent, memPercent).cpu
  const engine = (layer.engine || component.storageEngine || 'redis').trim()
  const io = backing ? component.storageIo : null
  const readLabel = io ? storageReadTileLabel(io, engine) : ''
  const writeLabel = io ? storageWriteTileLabel(io, engine) : ''
  const ioTiles =
    backing && io
      ? storageIoThroughputFields(
          layerBucket,
          view.timeframe,
          readLabel,
          writeLabel,
          fmtRate,
        )
      : null

  return (
    <PedagogicalSection title={labels.title} subtitle={labels.subtitle}>
      <StatRow
        left={
          <div className="space-y-3">
            <StatBlock
              label="Memory utilization"
              value={`${fmtBytes(layer.memoryBytes)}${
                layer.memoryLimit > 0 ? ` · ${memPercent.toFixed(1)}%` : ''
              }`}
              help={memHelp}
            />
            <StatBlock
              label="CPU utilization"
              value={cpuLabel}
              help={resourceHelp}
            />
          </div>
        }
        right={
          ioTiles ? (
            <div className="space-y-2">
              <StatBlock label={ioTiles.readLabel} value={ioTiles.readValue} />
              <StatBlock label={ioTiles.writeLabel} value={ioTiles.writeValue} />
            </div>
          ) : null
        }
      />
      {backing &&
      ((layer.redisKeyspaceHits ?? 0) > 0 || (layer.redisKeyspaceMisses ?? 0) > 0) ? (
        <StatRow
          left={
            <StatBlock
              label="Keyspace hits/s"
              value={`${fmtRate(layer.redisKeyspaceHits ?? 0)}/s`}
            />
          }
          right={
            <StatBlock
              label="Keyspace misses/s"
              value={`${fmtRate(layer.redisKeyspaceMisses ?? 0)}/s`}
            />
          }
        />
      ) : null}
      {backing &&
      ((layer.evictionsPerSec ?? 0) > 0 || (layer.expirationsPerSec ?? 0) > 0) ? (
        <StatRow
          left={
            <StatBlock
              label="Evictions/s"
              value={`${fmtRate(layer.evictionsPerSec ?? 0)}/s`}
              help="Keys Redis removed to make room after reaching its memory limit."
            />
          }
          right={
            <StatBlock
              label="TTL expirations/s"
              value={`${fmtRate(layer.expirationsPerSec ?? 0)}/s`}
              help="Keys the store removed because their TTL ended."
            />
          }
        />
          ) : null}
      {(layer.redisRejectedRate ?? 0) > 0 ? (
        <StatBlock
          label="Rejected commands/s"
          value={`${fmtRate(layer.redisRejectedRate ?? 0)}/s`}
        />
      ) : null}
      {(layer.restartCount ?? 0) > 0 ? (
        <p className="font-mono text-[10px] text-gray-500">
          {layer.restartCount} pod restarts
        </p>
      ) : null}
      {backing && evictionPolicy ? (
        <p className="text-[10px] text-gray-500">({evictionPolicy} eviction)</p>
      ) : null}
      {backing && io ? <StorageIoScopeFooter m={layerBucket} isPostgres={false} /> : null}
    </PedagogicalSection>
  )
}

export function CacheEnginePanels({
  m,
  cpuPercent,
  memPercent,
  evictionPolicy,
  view,
  showPlaybackDelay = false,
  history = [],
}: {
  m: MetricsBucket
  cpuPercent: number
  memPercent: number
  evictionPolicy?: string
  view: PanelViewState
  showPlaybackDelay?: boolean
  history?: MetricsBucket[]
}) {
  if (!isLayeredCache(m)) {
    return (
      <CacheEngineSection
        m={m}
        cpuPercent={cpuPercent}
        evictionPolicy={evictionPolicy}
        view={view}
        showPlaybackDelay={showPlaybackDelay}
        history={history}
      />
    )
  }

  return (
    <>
      <PedagogicalCaption>
        app → cache-proxy → redis-internal → db
      </PedagogicalCaption>
      {m.layers.map((layer) => (
        <CacheLayerResourceBlock
          key={layer.id}
          layer={layer}
          component={m}
          evictionPolicy={evictionPolicy}
          view={view}
          showPlaybackDelay={showPlaybackDelay}
        />
      ))}
      <CombinedCacheCanvasRow
        m={m}
        cpuPercent={cpuPercent}
        memPercent={memPercent}
      />
    </>
  )
}

export function CacheEngineSection({
  m,
  cpuPercent,
  evictionPolicy,
  view,
  showPlaybackDelay = false,
  history = [],
}: {
  m: MetricsBucket
  cpuPercent: number
  evictionPolicy?: string
  view: PanelViewState
  showPlaybackDelay?: boolean
  history?: MetricsBucket[]
}) {
  if (!hasStorageMetrics(m) || !m.storageIo) return null

  const engine = (m.storageEngine ?? 'redis').trim()
  const io = m.storageIo
  const readLabel = storageReadTileLabel(io, engine)
  const writeLabel = storageWriteTileLabel(io, engine)
  const memPct = m.memoryLimit > 0 ? Math.min(100, (m.memoryBytes / m.memoryLimit) * 100) : 0
  const memSeries = history.map((h) =>
    h.memoryLimit > 0 ? Math.min(100, (h.memoryBytes / h.memoryLimit) * 100) : 0,
  )
  const cpuSeries = history.map((h) => h.cpuPercent)
  const resourceHelp = resourceUsageHelp(m)
  const memHelp = memoryUsageHelp(m, memPct)
  const cpuLabel = formatResourceLabels(m, cpuPercent, memPct).cpu
  const ioTiles = storageIoThroughputFields(
    m,
    view.timeframe,
    readLabel,
    writeLabel,
    fmtRate,
  )

  return (
    <PedagogicalSection
      title="Engine throughput (USE)"
      subtitle="What mechanical work is the Redis cluster doing?"
    >
      <StatRow
        left={
          <div className="space-y-3">
            <StatBlock
              label="Memory utilization"
              value={`${fmtBytes(m.memoryBytes)}${m.memoryLimit > 0 ? ` · ${memPct.toFixed(1)}%` : ''}`}
              help={memHelp}
              graph={
                <MetricSeriesGraph
                  data={memSeries}
                  color="#8b5cf6"
                  title="Memory"
                  unit="10s · %"
                  view={view}
                  showPlaybackDelay={showPlaybackDelay}
                />
              }
            />
            <StatBlock
              label="CPU utilization"
              value={cpuLabel}
              help={resourceHelp}
              graph={
                <MetricSeriesGraph
                  data={cpuSeries}
                  color="#f59e0b"
                  title="CPU"
                  unit="10s · %"
                  view={view}
                  showPlaybackDelay={showPlaybackDelay}
                />
              }
            />
          </div>
        }
        right={
          <div className="space-y-2">
            <StatBlock label={ioTiles.readLabel} value={ioTiles.readValue} />
            <StatBlock label={ioTiles.writeLabel} value={ioTiles.writeValue} />
          </div>
        }
      />
      {(m.evictionsPerSec ?? 0) > 0 || (m.expirationsPerSec ?? 0) > 0 ? (
        <StatRow
          left={
            <StatBlock
              label="Evictions/s"
              value={`${fmtRate(m.evictionsPerSec ?? 0)}/s`}
              help="Keys Redis removed to make room after reaching its memory limit."
            />
          }
          right={
            <StatBlock
              label="TTL expirations/s"
              value={`${fmtRate(m.expirationsPerSec ?? 0)}/s`}
              help="Keys the store removed because their TTL ended."
            />
          }
        />
      ) : null}
      {evictionPolicy ? (
        <p className="text-[10px] text-gray-500">({evictionPolicy} eviction)</p>
      ) : null}
      <StorageIoScopeFooter m={m} isPostgres={false} />
    </PedagogicalSection>
  )
}

export function EngineHealthDisclosure({
  m,
  cpuPercent,
  memPercent,
}: {
  m: MetricsBucket
  cpuPercent: number
  memPercent: number
}) {
  const labels = formatResourceLabels(m, cpuPercent, memPercent)
  return (
    <InspectorDisclosure title="Engine health (diagnostics)">
      <EngineDiagnosticsBlock cpuLabel={labels.cpu} memLabel={labels.mem} />
    </InspectorDisclosure>
  )
}

function StorageIoScopeFooter({ m, isPostgres }: { m: MetricsBucket; isPostgres: boolean }) {
  const io = m.storageIo
  if (!io) return null
  const role = (m.storageRole ?? '').trim()
  const scopeLine = storageScopeLine(
    role,
    io,
    isPostgres ? 'all-db-clients' : undefined,
  )
  if (!scopeLine && !io.footnote?.trim()) return null
  return (
    <div className="space-y-1">
      {scopeLine ? <p className="text-[10px] text-gray-500">{scopeLine}</p> : null}
      {io.footnote?.trim() ? (
        <p className="text-[9px] leading-snug text-gray-500">{io.footnote.trim()}</p>
      ) : null}
    </div>
  )
}

/** @deprecated Use pedagogical sections — kept for imports that expect a bordered wrapper. */
export function InspectorSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-2">
      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {title}
      </h4>
      {children}
    </section>
  )
}
