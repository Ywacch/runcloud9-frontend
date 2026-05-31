import type { ReactNode } from 'react'
import { fmtBytes, fmtInt, fmtMs, fmtRate } from '../lib/format'
import {
  cacheEngineSectionTitle,
  dbLoadSectionTitle,
  formatDbQueriesPerSec,
  hasStorageMetrics,
  shouldShowHighScanRatioHint,
  storageReadTileLabel,
  storageScopeLine,
  storageUtilBarClass,
  storageUtilizationPct,
  storageWriteTileLabel,
} from '../lib/storageIoDisplay'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { MetricHelpIcon, MetricSectionHeading } from './MetricHelpIcon'
import { MetricChart } from './MetricChart'

/** RED — app SQL load on Postgres (app-server instrumentation). */
export function DbActivitySection({
  m,
  history,
  loadgenActive,
  dbRateHelp,
}: {
  m: MetricsBucket
  history: MetricsBucket[]
  loadgenActive: boolean
  dbRateHelp: string
}) {
  const maxConn =
    m.maxConnections > 0 ? m.maxConnections : 100
  const connPercent = maxConn > 0 ? (m.dbActiveConnections / maxConn) * 100 : 0
  const storageReadRate = m.storageIo?.readRate ?? 0
  const queriesDisplay = formatDbQueriesPerSec(
    m.dbQueryRate,
    m.dbQuerySource,
    storageReadRate,
    loadgenActive,
  )
  const queryRateSeries = history.map((h) => h.dbQueryRate)
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
    <InspectorSection title="DB Activity">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <MetricTile
          label="Queries/s"
          value={queriesDisplay}
          help={`${dbRateHelp} SQL statements from app-server instrumentation only.`}
        />
        <MetricTile
          label="Connections"
          value={`${fmtInt(m.dbActiveConnections)} / ${fmtInt(maxConn)}`}
        />
      </div>
      {latencyMs > 0 ? (
        <MetricTile label="Query latency" value={fmtMs(latencyMs)} help={dbRateHelp} />
      ) : null}
      <div className="h-2 rounded-full bg-gray-800">
        <div
          className={`h-full rounded-full ${
            connPercent > 85
              ? 'bg-red-500'
              : connPercent > 60
                ? 'bg-amber-500'
                : 'bg-emerald-500'
          }`}
          style={{ width: `${Math.min(100, connPercent)}%` }}
        />
      </div>
      <MetricChart
        title="Queries/s"
        unit="30s window"
        series={[{ data: queryRateSeries, color: '#6366f1', showArea: true }]}
        compact
        className="rounded-lg border border-gray-700/40 bg-[var(--c9-bg-card)]/70 p-2 shadow-none"
      />
      {latencySeries.some((v) => v > 0) ? (
        <MetricChart
          title="Query latency"
          unit="30s · ms"
          series={[{ data: latencySeries, color: 'var(--c9-warning)', showArea: true }]}
          compact
          className="rounded-lg border border-gray-700/40 bg-[var(--c9-bg-card)]/70 p-2 shadow-none"
        />
      ) : null}
      <p className="text-[9px] leading-snug text-gray-600">
        Queries/s counts app SQL operations — not worker fanout scans or exporter traffic.
      </p>
    </InspectorSection>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return <MetricTile label={label} value={value} />
}

function MetricTile({
  label,
  value,
  help,
}: {
  label: string
  value: string
  help?: string
}) {
  return (
    <div className="rounded-lg border border-gray-700/50 bg-gray-800/50 p-2.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-500">
        <span>{label}</span>
        {help ? <MetricHelpIcon title={help} /> : null}
      </div>
      <div className="mt-0.5 font-mono text-sm font-semibold text-white">{value}</div>
    </div>
  )
}

export function InspectorSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2 rounded-lg border border-gray-700/40 bg-gray-900/20 p-3">
      <MetricSectionHeading className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {title}
      </MetricSectionHeading>
      {children}
    </div>
  )
}

function StorageIoTiles({
  m,
  engine,
  isPostgres,
}: {
  m: MetricsBucket
  engine: string
  isPostgres: boolean
}) {
  const io = m.storageIo!
  const readLabel = storageReadTileLabel(io, engine)
  const writeLabel = storageWriteTileLabel(io, engine)
  const utilPct = storageUtilizationPct(io)
  const role = (m.storageRole ?? '').trim()
  const scopeLine = storageScopeLine(
    role,
    io,
    isPostgres ? 'all-db-clients' : undefined,
  )

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Tile label={readLabel} value={`${fmtRate(io.readRate)}/s`} />
        <Tile label={writeLabel} value={`${fmtRate(io.writeRate)}/s`} />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {io.bytesUsed > 0 ? (
          <Tile label="Data size" value={fmtBytes(io.bytesUsed)} />
        ) : null}
        {isPostgres && io.errorRate > 0 ? (
          <Tile label="Rollbacks" value={`${fmtRate(io.errorRate)}/s`} />
        ) : null}
        {!isPostgres && io.errorRate > 0 ? (
          <Tile label="Store errors" value={`${fmtRate(io.errorRate)}/s`} />
        ) : null}
      </div>
      {io.bytesLimit > 0 ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-gray-500">
            <span>Utilization</span>
            <span className="font-mono text-gray-300">
              {fmtBytes(io.bytesUsed)} / {fmtBytes(io.bytesLimit)} ({utilPct.toFixed(0)}%)
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-800">
            <div
              className={`h-full rounded-full transition-[width] ${storageUtilBarClass(utilPct)}`}
              style={{ width: `${utilPct}%` }}
            />
          </div>
          {utilPct >= 80 ? (
            <p className="text-[10px] text-amber-400/90">
              {utilPct >= 90 ? 'Critical' : 'High'} storage use — above{' '}
              {utilPct >= 90 ? '90' : '80'}%
            </p>
          ) : null}
        </div>
      ) : null}
      {scopeLine ? (
        <p className="text-[10px] text-gray-500">{scopeLine}</p>
      ) : null}
      {io.footnote?.trim() ? (
        <p className="text-[9px] leading-snug text-gray-500">{io.footnote.trim()}</p>
      ) : null}
    </>
  )
}

/** USE — Postgres engine row/table work (all DB clients). */
export function DbLoadSection({
  m,
  dbQueryRate,
  templateMetrics,
}: {
  m: MetricsBucket
  dbQueryRate: number
  templateMetrics: Record<string, number>
}) {
  if (!hasStorageMetrics(m) || !m.storageIo) return null

  const engine = (m.storageEngine ?? 'postgresql').trim()
  const readRate = m.storageIo.readRate
  const fanoutConsume = templateMetrics['worker.consume_rate'] ?? 0
  const fanoutP99 = templateMetrics['worker.fanout_size_p99'] ?? 0
  const showFanout = fanoutConsume > 0 || fanoutP99 > 0

  return (
    <InspectorSection title={dbLoadSectionTitle(engine)}>
      <StorageIoTiles m={m} engine={engine} isPostgres />
      {shouldShowHighScanRatioHint(dbQueryRate, readRate) ? (
        <p className="text-[10px] leading-snug text-violet-300/90">
          High row scan ratio — bulk reads or fanout worker may be active.
        </p>
      ) : null}
      {showFanout ? (
        <div className="rounded border border-gray-700/40 bg-gray-800/30 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Fanout worker
          </p>
          <p className="mt-1 text-xs text-gray-300">
            {fanoutConsume > 0 ? (
              <span>Consume {fmtRate(fanoutConsume)}/s</span>
            ) : null}
            {fanoutConsume > 0 && fanoutP99 > 0 ? ' · ' : null}
            {fanoutP99 > 0 ? (
              <span>p99 fanout {fmtInt(Math.round(fanoutP99))} followers/post</span>
            ) : null}
          </p>
        </div>
      ) : null}
      {!m.storageIo.footnote?.trim() && engine.toLowerCase() === 'postgresql' ? (
        <p className="text-[9px] leading-snug text-gray-600">
          Row scans include all DB clients (app-server and workers), not app query count
          alone. Process RAM is in resource metrics — not data size.
        </p>
      ) : null}
    </InspectorSection>
  )
}

/** Redis command throughput (supplementary to app hit/miss counters). */
export function CacheEngineSection({ m }: { m: MetricsBucket }) {
  if (!hasStorageMetrics(m) || !m.storageIo) return null

  const engine = (m.storageEngine ?? 'redis').trim()

  return (
    <InspectorSection title={cacheEngineSectionTitle(engine)}>
      <StorageIoTiles m={m} engine={engine} isPostgres={false} />
    </InspectorSection>
  )
}
