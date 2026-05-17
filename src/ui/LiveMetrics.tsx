import { useMemo, useState } from 'react'
import {
  fmtBytes,
  fmtCpuMilliCores,
  fmtErrorRate,
  fmtInt,
  fmtMemMB,
  fmtMs,
  fmtPct,
  fmtRate,
} from '../lib/format'
import type { ReplicaMetrics, SimNodeInspector } from '../lib/simulation/types'
import {
  useCanvasStore,
  type CanvasEdge,
  type CanvasNode,
} from '../store/canvasStore'
import { useMetricsStore, type MetricsBucket } from '../store/metricsStore'
import { useSimulationStore } from '../store/simulationStore'
import { SparkLine } from './SparkLine'

const EMPTY_HISTORY: MetricsBucket[] = []

function truncatePodName(name: string, max = 28): string {
  if (name.length <= max) return name
  return `${name.slice(0, max - 1)}…`
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-700/50 bg-gray-800/50 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm font-semibold text-white">
        {value}
      </div>
    </div>
  )
}

const sparkWrap =
  'rounded-lg border border-gray-700/30 bg-gray-800/30 p-2'

function linkedCacheNode(
  nodeId: string,
  edges: Record<string, CanvasEdge>,
  nodes: Record<string, CanvasNode>
): CanvasNode | null {
  for (const e of Object.values(edges)) {
    const src = nodes[e.sourceId]
    const tgt = nodes[e.targetId]
    if (!src || !tgt) continue
    if (src.id === nodeId && tgt.type === 'cache') return tgt
    if (tgt.id === nodeId && src.type === 'cache') return src
  }
  return null
}

function sessionElapsedSeconds(liveSessionEndsAt: number | null): number {
  if (!liveSessionEndsAt) return 0
  const sessionStart = liveSessionEndsAt - 9 * 60 * 1000
  return Math.max(1, (Date.now() - sessionStart) / 1000)
}

function loadgenElapsedSeconds(): number {
  const lg = useMetricsStore.getState().loadgen
  const sec = lg?.elapsedSeconds ?? 0
  return sec > 0 ? sec : 0
}

function isTimelineCacheMode(strategy: string, metricMode: string): boolean {
  const normalizedMode = metricMode.toLowerCase()
  return strategy === 'timeline-store' || normalizedMode.includes('sorted-set')
}

/** True if the worker emitted any non-empty inspector fields for this node. */
function simInspectorHasContent(d: SimNodeInspector | undefined): boolean {
  if (!d) return false
  if ((d.ingressQps ?? 0) > 0 || (d.servedQps ?? 0) > 0) return true
  if (d.backendSplit && d.backendSplit.length > 0) return true
  if ((d.cacheHitsQps ?? 0) > 0 || (d.cacheMissesQps ?? 0) > 0) return true
  if (d.cacheKeySamples && d.cacheKeySamples.length > 0) return true
  if (d.cacheEntries && d.cacheEntries.length > 0) return true
  if (d.databaseBreakdown && d.databaseBreakdown.length > 0) return true
  if (d.dbQuerySamples && d.dbQuerySamples.length > 0) return true
  if (
    d.mqIngressQps != null ||
    d.mqDrainQps != null ||
    d.mqQueueDepth != null
  ) {
    return true
  }
  if ((d.workerCapacityQps ?? 0) > 0) return true
  if (d.mqMessages && d.mqMessages.length > 0) return true
  if (d.workerJobs && d.workerJobs.length > 0) return true
  if (
    d.capacityRps != null &&
    d.capacityRps > 0 &&
    d.utilizationPct != null
  ) {
    return true
  }
  return false
}

interface LiveMetricsProps {
  node: CanvasNode
}

export function MetricsWaitingSkeleton() {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        Live metrics
      </p>
      <p className="text-sm text-gray-500">Waiting for metrics…</p>
      <div className="space-y-2 animate-pulse" aria-hidden>
        <div className="h-9 rounded-lg bg-gray-800/60" />
        <div className="h-9 rounded-lg bg-gray-800/60" />
        <div className="h-16 rounded-lg bg-gray-800/40" />
      </div>
    </div>
  )
}

export function LiveMetrics({ node }: LiveMetricsProps) {
  const nodeId = node.id
  const mode = useCanvasStore((s) => s.mode)
  const m = useMetricsStore((s) => s.metrics[nodeId])
  const history = useMetricsStore((s) => s.history[nodeId]) ?? EMPTY_HISTORY
  const edges = useCanvasStore((s) => s.edges)
  const nodes = useCanvasStore((s) => s.nodes)
  const liveSessionEndsAt = useCanvasStore((s) => s.liveSessionEndsAt)
  const snapshotTemplateId = useCanvasStore((s) => s.snapshotTemplateId)
  const templateMetrics = useMetricsStore((s) => s.templateMetrics)
  const simDetail = useSimulationStore((s) => s.lastInspector[nodeId])
  const simRunning = useSimulationStore((s) => s.running)
  const simPaused = useSimulationStore((s) => s.paused)
  const lastTickWallClockMs = useSimulationStore((s) => s.lastTickWallClockMs)
  const replicaBreakdown: ReplicaMetrics[] = simDetail?.replicaBreakdown ?? []
  const hasReplicaTabs = replicaBreakdown.length > 1
  const [activeReplicaTab, setActiveReplicaTab] = useState(0)

  const simInspectorCallout = useMemo(() => {
    if (mode !== 'simulate') return null
    if (simInspectorHasContent(simDetail)) return null
    if (!simRunning) {
      return 'Start simulation to populate inspector fields.'
    }
    if (lastTickWallClockMs == null) {
      return 'Waiting for first simulation tick…'
    }
    if (simPaused) {
      return 'Simulation is paused — inspector detail will update when you resume.'
    }
    return 'No simulation breakdown for this node yet.'
  }, [mode, simDetail, simRunning, simPaused, lastTickWallClockMs])

  if (!m) {
    if (mode === 'simulate') {
      return (
        <div className="space-y-4">
          {simInspectorCallout ? (
            <p className="text-[11px] leading-relaxed text-gray-500">
              {simInspectorCallout}
            </p>
          ) : null}
          {simInspectorHasContent(simDetail) ? (
            <SimulationInspectorSection detail={simDetail!} nodes={nodes} />
          ) : (
            <MetricsWaitingSkeleton />
          )}
        </div>
      )
    }
    return <MetricsWaitingSkeleton />
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        Live metrics
      </h3>
      {node.type !== 'client' ? <CommonSection m={m} /> : null}
      {hasReplicaTabs ? (
        <ReplicaTabsSection
          breakdown={replicaBreakdown}
          activeTab={activeReplicaTab}
          setActiveTab={setActiveReplicaTab}
        />
      ) : null}
      <TypeSection
        node={node}
        m={m}
        history={history}
        edges={edges}
        nodes={nodes}
        liveSessionEndsAt={liveSessionEndsAt}
        snapshotTemplateId={snapshotTemplateId}
        templateMetrics={templateMetrics}
      />
      {simInspectorCallout ? (
        <div className="space-y-2 border-t border-violet-900/40 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-violet-400/90">
            Simulation detail
          </h3>
          <p className="text-[11px] leading-relaxed text-gray-500">{simInspectorCallout}</p>
        </div>
      ) : null}
      {mode === 'simulate' && simInspectorHasContent(simDetail) ? (
        <SimulationInspectorSection detail={simDetail!} nodes={nodes} />
      ) : null}
    </div>
  )
}

function ReplicaTabsSection({
  breakdown,
  activeTab,
  setActiveTab,
}: {
  breakdown: ReplicaMetrics[]
  activeTab: number
  setActiveTab: (idx: number) => void
}) {
  const safeIdx = Math.min(activeTab, breakdown.length - 1)
  const r = breakdown[safeIdx]
  if (!r) return null
  return (
    <div className="space-y-2 rounded-lg border border-gray-700/50 bg-gray-800/30 p-2.5">
      <div className="flex flex-wrap gap-1">
        {breakdown.map((rep, idx) => (
          <button
            key={rep.label}
            type="button"
            onClick={() => setActiveTab(idx)}
            className={`rounded px-2 py-0.5 text-[10px] font-mono ${
              idx === safeIdx
                ? 'bg-violet-600/70 text-white'
                : 'bg-gray-800 text-gray-300'
            }`}
          >
            {rep.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MetricTile label="QPS" value={`${fmtRate(r.qps)}/s`} />
        <MetricTile label="CPU" value={fmtPct(r.cpuPercent)} />
        <MetricTile label="Latency" value={fmtMs(r.latencyMs)} />
        <MetricTile label="Error Rate" value={fmtErrorRate(r.errorRate)} />
      </div>
      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-gray-500">
          Utilization
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 min-w-0 flex-1 rounded-full bg-gray-800">
            <div
              className={`h-full rounded-full ${
                r.utilizationPct > 1 ? 'bg-red-500'
                  : r.utilizationPct > 0.8 ? 'bg-amber-500'
                  : 'bg-sky-500'
              }`}
              style={{ width: `${Math.min(100, r.utilizationPct * 100)}%` }}
            />
          </div>
          <span className="shrink-0 font-mono text-[10px] text-gray-300">
            {fmtPct(Math.min(100, r.utilizationPct * 100))}
          </span>
        </div>
      </div>
      {r.memoryGb > 0 ? (
        <MetricTile label="Memory" value={`${r.memoryGb.toFixed(2)} GB`} />
      ) : null}
    </div>
  )
}

function SimulationInspectorSection({
  detail,
  nodes,
}: {
  detail: SimNodeInspector
  nodes: Record<string, CanvasNode>
}) {
  const hasSplit = detail.backendSplit && detail.backendSplit.length > 0
  const hasCache =
    (detail.cacheHitsQps ?? 0) > 0 ||
    (detail.cacheMissesQps ?? 0) > 0 ||
    (detail.cacheKeySamples?.length ?? 0) > 0 ||
    (detail.cacheEntries?.length ?? 0) > 0
  const hasDb =
    (detail.databaseBreakdown?.length ?? 0) > 0 ||
    (detail.dbQuerySamples?.length ?? 0) > 0
  const hasMq =
    detail.mqIngressQps != null ||
    detail.mqDrainQps != null ||
    detail.mqQueueDepth != null ||
    (detail.mqMessages?.length ?? 0) > 0
  const hasWorkerJobs = (detail.workerJobs?.length ?? 0) > 0

  return (
    <div className="space-y-2 border-t border-gray-700/50 pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-violet-400/90">
        Simulation detail
      </h3>
      <p className="text-[10px] text-gray-500">
        Approximate per-tick breakdown from the local worker (not live deploy
        telemetry).
      </p>
      <div className="grid grid-cols-2 gap-2">
        {detail.ingressQps != null ? (
          <MetricTile
            label="Ingress (approx)"
            value={`${fmtRate(detail.ingressQps)}/s`}
          />
        ) : null}
        {detail.servedQps != null ? (
          <MetricTile
            label="Served (approx)"
            value={`${fmtRate(detail.servedQps)}/s`}
          />
        ) : null}
      </div>
      {detail.capacityRps != null &&
      detail.capacityRps > 0 &&
      detail.utilizationPct != null ? (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-gray-500">
            Utilization (vs sim capacity)
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 min-w-0 flex-1 rounded-full bg-gray-800">
              <div
                className="h-full rounded-full bg-sky-500"
                style={{
                  width: `${Math.min(100, detail.utilizationPct * 100)}%`,
                }}
              />
            </div>
            <span className="shrink-0 font-mono text-[10px] text-gray-300">
              {fmtPct(Math.min(100, detail.utilizationPct * 100))} (
              {fmtRate(detail.ingressQps ?? 0)}/s / {fmtRate(detail.capacityRps)}
              /s)
            </span>
          </div>
        </div>
      ) : null}
      {detail.workerCapacityQps != null ? (
        <MetricTile
          label="Worker capacity (approx)"
          value={`${fmtRate(detail.workerCapacityQps)}/s`}
        />
      ) : null}
      {hasSplit ? (
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">
            Backend split (this tick)
          </div>
          <ul className="space-y-1 text-xs text-gray-300">
            {detail.backendSplit!.map((b) => (
              <li
                key={b.nodeId}
                className="flex justify-between gap-2 font-mono"
              >
                <span className="truncate text-gray-400">
                  {nodes[b.nodeId]?.label ?? b.nodeId}
                </span>
                <span>{fmtRate(b.qps)}/s</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {hasCache ? (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-gray-500">
            Cache (this tick)
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(detail.cacheHitsQps ?? 0) > 0 ? (
              <MetricTile
                label="Hits"
                value={`${fmtRate(detail.cacheHitsQps!)}/s`}
              />
            ) : null}
            {(detail.cacheMissesQps ?? 0) > 0 ? (
              <MetricTile
                label="Misses"
                value={`${fmtRate(detail.cacheMissesQps!)}/s`}
              />
            ) : null}
          </div>
          {detail.cacheKeySamples && detail.cacheKeySamples.length > 0 ? (
            <div className="rounded border border-gray-700/40 bg-gray-900/40 px-2 py-1.5 font-mono text-[10px] text-gray-400">
              {detail.cacheKeySamples.map((k) => (
                <div key={k} className="truncate">
                  {k}
                </div>
              ))}
            </div>
          ) : null}
          {detail.cacheEntries && detail.cacheEntries.length > 0 ? (
            <div className="overflow-x-auto rounded border border-gray-700/40 bg-gray-900/40">
              <table className="min-w-full text-[10px] text-gray-300">
                <thead className="bg-gray-900/70 text-gray-500">
                  <tr>
                    <th className="px-2 py-1 text-left font-semibold">Key</th>
                    <th className="px-2 py-1 text-right font-semibold">Hits</th>
                    <th className="px-2 py-1 text-right font-semibold">TTL</th>
                    <th className="px-2 py-1 text-right font-semibold">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.cacheEntries.map((e) => (
                    <tr key={e.key} className="border-t border-gray-800/70">
                      <td className="max-w-[220px] truncate px-2 py-1 font-mono text-gray-200">
                        {e.key}
                      </td>
                      <td className="px-2 py-1 text-right">{fmtInt(e.hitCount)}</td>
                      <td className="px-2 py-1 text-right">
                        {e.ttlRemaining != null ? `${fmtInt(e.ttlRemaining)}s` : '—'}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {e.isHotKey ? 'HOT' : ''}
                        {e.isHotKey && e.evictionCandidate ? ' · ' : ''}
                        {e.evictionCandidate ? 'EVICT' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
      {hasDb ? (
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">
            Query mix (workload model)
          </div>
          <ul className="space-y-1 text-xs text-gray-300">
            {detail.databaseBreakdown!.map((row, i) => (
              <li
                key={`${row.label}-${i}`}
                className="flex justify-between gap-2 font-mono"
              >
                <span className="min-w-0 flex-1 truncate text-gray-400">
                  {row.label}
                </span>
                <span>{fmtRate(row.qps)}/s</span>
              </li>
            ))}
          </ul>
          {detail.dbQuerySamples && detail.dbQuerySamples.length > 0 ? (
            <div className="mt-2 rounded border border-gray-700/40 bg-gray-900/40 p-2">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">
                Query samples
              </div>
              <ul className="space-y-1 text-[10px] text-gray-300">
                {detail.dbQuerySamples.map((q, i) => (
                  <li key={`${q.label}-${i}`} className="rounded bg-gray-800/50 px-2 py-1">
                    <div className="truncate font-mono text-gray-200">{q.label}</div>
                    <div className="flex items-center justify-between gap-2 text-gray-400">
                      <span className="truncate font-mono">[{q.boundParams.join(', ')}]</span>
                      <span>
                        {fmtMs(q.latencyMs)}
                        {q.rowsReturned != null ? ` · rows ${fmtInt(q.rowsReturned)}` : ''}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
      {hasMq ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {detail.mqIngressQps != null ? (
              <MetricTile
                label="MQ ingress"
                value={`${fmtRate(detail.mqIngressQps)}/s`}
              />
            ) : null}
            {detail.mqDrainQps != null ? (
              <MetricTile
                label="MQ drain"
                value={`${fmtRate(detail.mqDrainQps)}/s`}
              />
            ) : null}
            {detail.mqQueueDepth != null ? (
              <MetricTile
                label="Queue depth"
                value={fmtInt(Math.round(detail.mqQueueDepth))}
              />
            ) : null}
          </div>
          {detail.mqMessages && detail.mqMessages.length > 0 ? (
            <div className="rounded border border-gray-700/40 bg-gray-900/40 p-2">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">
                Message samples
              </div>
              <ul className="space-y-1 text-[10px] text-gray-300">
                {detail.mqMessages.map((msg, i) => (
                  <li key={`${msg.topic}-${i}`} className="rounded bg-gray-800/50 px-2 py-1">
                    <div className="truncate text-gray-200">{msg.topic}</div>
                    <div className="flex items-center justify-between gap-2 text-gray-400">
                      <span className="truncate font-mono">{msg.payload}</span>
                      <span>
                        {fmtMs(msg.ageMs)} · try {fmtInt(msg.deliveryAttempt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
      {hasWorkerJobs ? (
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">
            Worker jobs
          </div>
          <ul className="space-y-1 text-xs text-gray-300">
            {detail.workerJobs!.map((job, i) => (
              <li key={`${job.label}-${i}`} className="flex justify-between gap-2 font-mono">
                <span className="min-w-0 flex-1 truncate text-gray-400">
                  {job.label}
                </span>
                <span>
                  {job.status} · {fmtMs(job.processingTimeMs)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function CommonSection({ m }: { m: MetricsBucket }) {
  const cpuValue = m.cpuIsEstimated
    ? m.cpuLimit > 0
      ? `${fmtCpuMilliCores(m.cpuLimit)} (allocated)`
      : `${fmtCpuMilliCores(m.cpuUsage)} (allocated)`
    : fmtPct(m.cpuPercent)
  const memValue = m.memIsEstimated
    ? m.memoryLimit > 0
      ? `${fmtMemMB(m.memoryLimit)} (allocated)`
      : `${fmtMemMB(m.memoryBytes)} (allocated)`
    : `${fmtBytes(m.memoryBytes)}${
        m.memoryLimit > 0 ? ` · ${fmtPct(m.memPercent)}` : ''
      }`
  return (
    <div className="grid grid-cols-2 gap-2">
      <MetricTile label="CPU" value={cpuValue} />
      <MetricTile label="Memory" value={memValue} />
    </div>
  )
}

function TypeSection({
  node,
  m,
  history,
  edges,
  nodes,
  liveSessionEndsAt,
  snapshotTemplateId,
  templateMetrics,
}: {
  node: CanvasNode
  m: MetricsBucket
  history: MetricsBucket[]
  edges: Record<string, CanvasEdge>
  nodes: Record<string, CanvasNode>
  liveSessionEndsAt: number | null
  snapshotTemplateId: string | null
  templateMetrics: Record<string, number>
}) {
  const nodeId = node.id
  const nodeType = node.type
  const isSocialFeed = snapshotTemplateId === 'social-feed'
  const tmMqQueueDepth = templateMetrics['mq.queue_depth']
  const tmMqProduceRate = templateMetrics['mq.produce_rate']
  const tmMqConsumeRate = templateMetrics['mq.consume_rate']
  const tmWorkerConsumeRate = templateMetrics['worker.consume_rate']
  const tmWorkerRedisWriteRate = templateMetrics['worker.redis_write_rate']
  const tmWorkerRedisErrors = templateMetrics['worker.errors.redis']

  switch (nodeType) {
    case 'compute': {
      const cacheNode = linkedCacheNode(nodeId, edges, nodes)
      const hasCacheLink = cacheNode !== null
      const rpsSeries = history.map((h) => h.requestRate)
      const latencySeries = history.map((h) => h.p99Latency)
      const elapsed = loadgenElapsedSeconds() || sessionElapsedSeconds(liveSessionEndsAt)
      const avgRps =
        m.totalRequests > 0 && elapsed > 0 ? m.totalRequests / elapsed : 0

      return (
        <div className="space-y-2">
          {hasCacheLink && cacheNode ? (
            <MetricTile
              label="Cache Strategy"
              value={String(cacheNode.config.cacheStrategy ?? 'cache-aside')}
            />
          ) : null}
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">
              Requests
            </div>
            <div className="grid grid-cols-3 gap-2">
              <MetricTile label="Total" value={fmtInt(m.totalRequests)} />
              <MetricTile label="Avg RPS" value={fmtInt(avgRps)} />
              <MetricTile label="Current RPS" value={fmtInt(m.requestRate)} />
            </div>
          </div>
          <MetricTile label="Error Rate" value={fmtErrorRate(m.errorRate)} />
          <div className="grid grid-cols-3 gap-2">
            <MetricTile label="p50" value={fmtMs(m.p50Latency)} />
            <MetricTile label="p95" value={fmtMs(m.p95Latency)} />
            <MetricTile label="p99" value={fmtMs(m.p99Latency)} />
          </div>
          <div className={sparkWrap}>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">
              Throughput (30s)
            </div>
            <SparkLine
              data={rpsSeries}
              color="#8A9BB0"
              showArea
              showDot
            />
          </div>
          <div className={sparkWrap}>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">
              p99 Latency (30s)
            </div>
            <SparkLine
              data={latencySeries}
              color="#E74C3C"
              showArea
              showDot
            />
          </div>
        </div>
      )
    }

    case 'cache': {
      const total = m.cacheHits + m.cacheMisses
      const hitRatePct = total > 0 ? (m.cacheHits / total) * 100 : 0
      const hitRateLabel = total > 0 ? fmtPct(hitRatePct) : '—'
      const hitRateSeries = history.map((h) => {
        const t = h.cacheHits + h.cacheMisses
        return t > 0 ? (h.cacheHits / t) * 100 : 0
      })
      const backendStrategy =
        (m.cacheStrategy ?? '').trim() ||
        String(node.config.cacheStrategy ?? 'cache-aside')
      const metricMode = (m.cacheMetricMode ?? '').trim()
      const timelineMode = isTimelineCacheMode(backendStrategy, metricMode)

      return (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <MetricTile
              label="Eviction Policy"
              value={String(node.config.evictionPolicy ?? 'allkeys-lru')}
            />
            <MetricTile
              label="Strategy"
              value={backendStrategy}
            />
          </div>
          {metricMode ? (
            <p className="text-[11px] leading-relaxed text-gray-400">
              {metricMode}
            </p>
          ) : null}
          {m.cacheReadOperation || m.cacheWriteOperation ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {m.cacheReadOperation ? (
                <MetricTile label="Read op" value={m.cacheReadOperation} />
              ) : null}
              {m.cacheWriteOperation ? (
                <MetricTile label="Write op" value={m.cacheWriteOperation} />
              ) : null}
            </div>
          ) : null}

          {timelineMode ? (
            <>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <MetricTile
                  label="Redis ops"
                  value={`${fmtRate(m.redisOpsPerSec || m.requestRate)}/s`}
                />
                <MetricTile
                  label="Request rate"
                  value={`${fmtRate(m.requestRate)}/s`}
                />
                <MetricTile
                  label="Rejected conns"
                  value={`${fmtRate(m.redisRejectedRate)}/s`}
                />
              </div>
              {((m.redisConnectedClients ?? 0) > 0 || (m.redisAvgLatency ?? 0) > 0) ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(m.redisConnectedClients ?? 0) > 0 ? (
                    <MetricTile
                      label="Connected clients"
                      value={fmtInt(Math.round(m.redisConnectedClients ?? 0))}
                    />
                  ) : null}
                  {(m.redisAvgLatency ?? 0) > 0 ? (
                    <MetricTile
                      label="Redis avg latency"
                      value={fmtMs((m.redisAvgLatency ?? 0) * 1000)}
                    />
                  ) : null}
                </div>
              ) : null}
              <p className="text-[11px] leading-relaxed text-gray-500">
                Sorted-set timeline traffic does not use Redis keyspace hit/miss
                counters as the primary health signal.
              </p>
            </>
          ) : (
            <>
              <MetricTile label="Hit Rate (30s)" value={hitRateLabel} />
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">
                  Current rate (30s)
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <MetricTile
                    label="Hits"
                    value={`${fmtRate(m.cacheHits)}/s`}
                  />
                  <MetricTile
                    label="Misses"
                    value={`${fmtRate(m.cacheMisses)}/s`}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 mt-2 text-[10px] uppercase tracking-wider text-gray-500">
                  Last 9 min
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <MetricTile label="Hits" value={fmtInt(m.cacheHitsLast9m)} />
                  <MetricTile label="Misses" value={fmtInt(m.cacheMissesLast9m)} />
                </div>
              </div>
              <div className="h-2 rounded-full bg-gray-800">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-[width]"
                  style={{ width: `${Math.min(100, hitRatePct)}%` }}
                />
              </div>
              <div className={sparkWrap}>
                <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">
                  Hit rate (30s)
                </div>
                <SparkLine
                  data={hitRateSeries}
                  color="#C0392B"
                  showArea
                  showDot
                />
              </div>
            </>
          )}
          <div>
            <div className="mb-1 mt-2 text-[10px] uppercase tracking-wider text-gray-500">
              Keyspace counters
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MetricTile
                label="Hits"
                value={`${fmtRate(m.redisKeyspaceHits || m.cacheHits)}/s`}
              />
              <MetricTile
                label="Misses"
                value={`${fmtRate(m.redisKeyspaceMisses || m.cacheMisses)}/s`}
              />
            </div>
          </div>
        </div>
      )
    }

    case 'database': {
      const maxConn =
        m.maxConnections > 0
          ? m.maxConnections
          : Number(node.config.maxConnections ?? 100)
      const connPercent =
        maxConn > 0 ? (m.dbActiveConnections / maxConn) * 100 : 0
      const queryRateSeries = history.map((h) => h.dbQueryRate)
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <MetricTile
              label="Query Rate"
              value={`${fmtRate(m.dbQueryRate)}/s`}
            />
            <MetricTile
              label="Connections"
              value={`${fmtInt(m.dbActiveConnections)} / ${fmtInt(maxConn)}`}
            />
          </div>
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
          <div className={sparkWrap}>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">
              Query rate (30s)
            </div>
            <SparkLine
              data={queryRateSeries}
              color="#5C6B7A"
              showArea
              showDot
            />
          </div>
        </div>
      )
    }

    case 'load_balancer': {
      const lbRpsSeries = history.map((h) => h.requestRate)
      const backends = Object.values(edges)
        .filter((e) => e.sourceId === nodeId)
        .map((e) => nodes[e.targetId])
        .filter((b): b is CanvasNode => Boolean(b))
      const algo =
        m.lbAlgorithm?.trim() ||
        String(node.config.algorithm ?? 'round-robin')
      const backendLabels =
        m.lbBackends?.length ? m.lbBackends : backends.map((b) => b.label)
      const perBe = Object.entries(m.perBackendRps).sort(([a], [b]) =>
        a.localeCompare(b)
      )
      const connLimit = m.lbConnectionLimit
      const active = m.activeConnections
      const connPct =
        connLimit > 0 ? Math.min(100, (active / connLimit) * 100) : 0

      return (
        <div className="space-y-2">
          <MetricTile label="Algorithm" value={algo} />
          <MetricTile
            label="Requests routed"
            value={`${fmtInt(m.requestRate)} rps`}
          />
          {connLimit > 0 ? (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-gray-500">
                Connections
              </div>
              <div className="grid grid-cols-2 gap-2">
                <MetricTile
                  label="Active / limit"
                  value={`${fmtInt(Math.round(active))} / ${fmtInt(connLimit)}`}
                />
              </div>
              <div className="h-2 rounded-full bg-gray-800">
                <div
                  className={`h-full rounded-full ${
                    connPct > 90
                      ? 'bg-red-500'
                      : connPct > 75
                        ? 'bg-amber-500'
                        : 'bg-sky-500'
                  }`}
                  style={{ width: `${connPct}%` }}
                />
              </div>
            </div>
          ) : null}
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">
              Backends
            </div>
            <div className="flex flex-wrap gap-1">
              {backendLabels.map((label) => (
                <span
                  key={label}
                  className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-300"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
          {perBe.length > 0 ? (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">
                RPS by backend (pods)
              </div>
              <ul className="space-y-1 text-xs text-gray-300">
                {perBe.map(([name, rps]) => (
                  <li
                    key={name}
                    className="flex justify-between gap-2 font-mono"
                  >
                    <span
                      className="min-w-0 truncate text-gray-400"
                      title={name}
                    >
                      {truncatePodName(name)}
                    </span>
                    <span>{fmtRate(rps)}/s</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className={sparkWrap}>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">
              Throughput (30s)
            </div>
            <SparkLine
              data={lbRpsSeries}
              color="#4A90D9"
              showArea
              showDot
            />
          </div>
        </div>
      )
    }

    case 'client':
      return (
        <>
          <MetricTile label="Current RPS" value={fmtInt(m.requestRate)} />
          <MetricTile label="Total Requests" value={fmtInt(m.totalRequests)} />
        </>
      )

    case 'message_queue': {
      const prodSeries = history.map((h) => h.produceRate)
      const produceRate =
        isSocialFeed && Number.isFinite(tmMqProduceRate)
          ? tmMqProduceRate
          : m.produceRate
      const consumeRate =
        isSocialFeed && Number.isFinite(tmMqConsumeRate)
          ? tmMqConsumeRate
          : m.consumeRate
      const queueDepth =
        isSocialFeed && Number.isFinite(tmMqQueueDepth)
          ? tmMqQueueDepth
          : m.queueDepth
      const satRatio = Number.isFinite(m.mqSaturationRatio)
        ? m.mqSaturationRatio
        : 0
      const satPct = Math.min(100, satRatio * 100)
      const memPct =
        m.mqMemoryLimit > 0
          ? Math.min(100, (m.mqMemoryUsed / m.mqMemoryLimit) * 100)
          : 0

      return (
        <div className="space-y-2">
          <MetricTile label="Engine" value="RabbitMQ" />
          <div className="grid grid-cols-2 gap-2">
            <MetricTile
              label="Produce"
              value={`${fmtRate(produceRate)}/s`}
            />
            <MetricTile
              label="Consume"
              value={`${fmtRate(consumeRate)}/s`}
            />
            <MetricTile
              label="Queue depth"
              value={fmtInt(Math.round(queueDepth))}
            />
            <MetricTile
              label="Ready / unacked"
              value={`${fmtInt(Math.round(m.messagesReady))} / ${fmtInt(Math.round(m.messagesUnacked))}`}
            />
          </div>
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">
              Saturation (produce ÷ consume)
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 min-w-0 flex-1 rounded-full bg-gray-800">
                <div
                  className={`h-full rounded-full ${
                    satRatio > 1
                      ? 'bg-red-500'
                      : satRatio > 0.85
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  }`}
                  style={{ width: `${satPct}%` }}
                />
              </div>
              <span className="shrink-0 font-mono text-[10px] text-gray-300">
                {satRatio.toFixed(2)}×
              </span>
            </div>
          </div>
          {m.mqMemoryLimit > 0 ? (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-gray-500">
                Broker memory
              </div>
              <div className="text-[11px] text-gray-400">
                {fmtBytes(m.mqMemoryUsed)} / {fmtBytes(m.mqMemoryLimit)}
              </div>
              <div className="h-2 rounded-full bg-gray-800">
                <div
                  className={`h-full rounded-full ${
                    memPct > 90 ? 'bg-red-500' : memPct > 75 ? 'bg-amber-500' : 'bg-violet-500'
                  }`}
                  style={{ width: `${memPct}%` }}
                />
              </div>
            </div>
          ) : null}
          <div className={sparkWrap}>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">
              Produce rate (30s)
            </div>
            <SparkLine
              data={prodSeries}
              color="#A855F7"
              showArea
              showDot
            />
          </div>
        </div>
      )
    }

    case 'worker': {
      const wSat = Number.isFinite(m.workerSaturation)
        ? m.workerSaturation
        : 0
      const ws = Math.min(100, wSat * 100)
      const consumeRate =
        isSocialFeed && Number.isFinite(tmWorkerConsumeRate)
          ? tmWorkerConsumeRate
          : m.consumeRate

      return (
        <div className="space-y-2">
          <MetricTile label="Role" value="Consumer" />
          <div className="grid grid-cols-2 gap-2">
            <MetricTile
              label="Queue depth"
              value={fmtInt(Math.round(m.queueDepth))}
            />
            <MetricTile
              label="Consume"
              value={`${fmtRate(consumeRate)}/s`}
            />
            {Number.isFinite(tmWorkerRedisWriteRate) ? (
              <MetricTile
                label="Redis writes"
                value={`${fmtRate(tmWorkerRedisWriteRate)}/s`}
              />
            ) : null}
            {Number.isFinite(tmWorkerRedisErrors) ? (
              <MetricTile
                label="Redis errors"
                value={`${fmtRate(tmWorkerRedisErrors)}/s`}
              />
            ) : null}
          </div>
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">
              Saturation (vs capacity model)
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 min-w-0 flex-1 rounded-full bg-gray-800">
                <div
                  className={`h-full rounded-full ${
                    wSat > 0.95
                      ? 'bg-red-500'
                      : wSat > 0.75
                        ? 'bg-amber-500'
                        : 'bg-teal-500'
                  }`}
                  style={{ width: `${ws}%` }}
                />
              </div>
              <span className="shrink-0 font-mono text-[10px] text-gray-300">
                {fmtPct(ws)}
              </span>
            </div>
          </div>
        </div>
      )
    }

    default:
      return null
  }
}
