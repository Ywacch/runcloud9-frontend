import type { ReactNode } from 'react'
import { fmtBytes, fmtInt, fmtMs, fmtRate } from '../lib/format'
import {
  fanoutScanModelEstimate,
  formatDbQueriesPerSec,
  hasStorageMetrics,
  shouldShowHighScanRatioHint,
  storageReadTileLabel,
  storageScopeLine,
  storageWriteTileLabel,
} from '../lib/storageIoDisplay'
import { dbQueryHeadline } from '../lib/metricTimeframe'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { InspectorDisclosure } from './InspectorDisclosure'
import {
  CapacityBar,
  EngineDiagnosticsBlock,
  MetricSeriesGraph,
  PedagogicalHint,
  PedagogicalSection,
  StatBlock,
  StatRow,
  dbClusterResourceHelp,
  formatDbClusterResourceLabels,
  formatResourceLabels,
  resourceUsageHelp,
  shouldShowDbClusterUtilizationCharts,
  type PanelViewState,
} from './inspectorPanelUi'
import { useDbTierCWarmup } from './useDbTierCWarmup'

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
            help={`${dbRateHelp} SQL from app-server instrumentation only.`}
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
        value={latencyMs > 0 ? fmtMs(latencyMs) : '—'}
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
  const readLabel = storageReadTileLabel(io, engine)
  const writeLabel = storageWriteTileLabel(io, engine)
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
            label={readLabel}
            value={`${fmtRate(readRate)}/s`}
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
          <StatBlock
            label={writeLabel}
            value={`${fmtRate(io.writeRate)}/s`}
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
        }
      />
      {modelEstimate != null && modelEstimate > 0 ? (
        <p className="font-mono text-[10px] text-violet-300/90">
          Model (est.): ~{fmtRate(modelEstimate)}/s row scans from fanout formula
        </p>
      ) : null}
      {!hasPattern && shouldShowHighScanRatioHint(dbQueryRate, readRate) ? (
        <PedagogicalHint>
          Inefficient access pattern: {fmtRate(dbQueryRate)} logical queries are causing{' '}
          {fmtRate(readRate)} row/document reads per second. Check the Data tab for a missing
          index that may be causing O(N) sequential scans.
        </PedagogicalHint>
      ) : null}
      {io.patternNote?.trim() ? (
        <p className="text-[10px] leading-snug text-gray-500">{io.patternNote.trim()}</p>
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

  const labels = formatDbClusterResourceLabels(m, cpuPercent, memPercent, warmingUp)
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
      {showUtilizationCharts ? <CapacityBar pct={cpuPercent} /> : null}
      {resourceHelp ? (
        <PedagogicalHint tone="muted">{resourceHelp}</PedagogicalHint>
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
      <PedagogicalHint tone="muted">
        Engine-specific (PostgreSQL) metrics. High connection counts can lead to connection
        pooling bottlenecks.
      </PedagogicalHint>
    </InspectorDisclosure>
  )
}

/** Redis command throughput — engine USE layer for cache nodes. */
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
  const cpuLabel = formatResourceLabels(m, cpuPercent, memPct).cpu

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
            <StatBlock label={readLabel} value={`${fmtRate(io.readRate)}/s`} />
            <StatBlock label={writeLabel} value={`${fmtRate(io.writeRate)}/s`} />
          </div>
        }
      />
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
