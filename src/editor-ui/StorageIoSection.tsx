import { fmtBytes, fmtMs, fmtRate } from '../lib/format'
import type { ReactNode } from 'react'
import {
  hasStorageMetrics,
  storageEngineLabel,
  storageUnitLabel,
  storageUtilBarClass,
  storageUtilizationPct,
} from '../lib/storageIoDisplay'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { MetricSectionHeading } from './MetricHelpIcon'

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-700/50 bg-gray-800/50 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-semibold text-white">{value}</div>
    </div>
  )
}

/** Persistence I/O from WS `storageIo` (db, cache-as-store). */
export function StorageIoSection({
  m,
  /** App-reported query latency (ms) until storageIo latencies ship (Phase 2.5). */
  queryLatencyMs,
}: {
  m: MetricsBucket
  queryLatencyMs?: number
}) {
  const io = m.storageIo
  if (!hasStorageMetrics(m) || !io) return null

  const unit = storageUnitLabel(io.unit)
  const utilPct = storageUtilizationPct(io)
  const engine = (m.storageEngine ?? '').trim()
  const role = (m.storageRole ?? '').trim()

  return (
    <div className="space-y-2 border-t border-gray-700/40 pt-3">
      <MetricSectionHeading className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        Storage I/O
        {engine ? ` · ${storageEngineLabel(engine)}` : ''}
        {unit ? ` (${unit})` : ''}
      </MetricSectionHeading>
      {role ? (
        <p className="text-[10px] text-gray-500">
          Role: <span className="text-gray-300">{role}</span>
          {io.source ? (
            <>
              {' '}
              · <span className="text-gray-500">{io.source}</span>
            </>
          ) : null}
        </p>
      ) : io.source ? (
        <p className="text-[10px] text-gray-500">{io.source}</p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Tile label={`Read (${unit})`} value={`${fmtRate(io.readRate)}/s`} />
        <Tile label={`Write (${unit})`} value={`${fmtRate(io.writeRate)}/s`} />
      </div>
      {queryLatencyMs != null && queryLatencyMs > 0 ? (
        <Tile label="Query latency (app)" value={fmtMs(queryLatencyMs)} />
      ) : null}
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
      ) : io.bytesUsed > 0 ? (
        <Tile label="Data size" value={fmtBytes(io.bytesUsed)} />
      ) : null}
      {io.errorRate > 0 ? (
        <Tile label="Store errors" value={`${fmtRate(io.errorRate)}/s`} />
      ) : null}
      <StorageFootnote engine={engine} />
    </div>
  )
}

function StorageFootnote({ engine }: { engine: string }) {
  const key = engine.trim().toLowerCase()
  let body: ReactNode
  if (key === 'postgresql') {
    body = (
      <>
        Read/write rates and data size come from{' '}
        <span className="text-gray-500">postgres_exporter</span> (row tuples, DB size,
        rollbacks). Process RAM is under resource metrics above — not{' '}
        <span className="text-gray-500">bytesUsed</span>.
      </>
    )
  } else {
    body = (
      <>
        Store I/O is separate from HTTP error rate and app-reported query rate. Compare
        engines using the same <span className="text-gray-500">unit</span> and workload.
      </>
    )
  }
  return (
    <p className="text-[9px] leading-snug text-gray-600">
      {body} Storage read/write latency on this panel is not wired yet (Phase 2.5).
    </p>
  )
}
