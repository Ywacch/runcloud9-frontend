import { useCallback, useMemo, useState } from 'react'
import { FMT_EMPTY, fmtInt, fmtMs, fmtPct, fmtRate } from '../lib/format'
import type { ReplicaMetrics, SimNodeInspector } from '../editor-core/domain/simulation/types'
import {
  replicaBreakdownFromPods,
  replicaRowFromSimulation,
  type ReplicaInspectorRow,
} from '../lib/replicaMetricsDisplay'
import { readLatencyQuantile, writeLatencyQuantile } from '../lib/latencyQuantile'
import {
  useCanvasStore,
  type CanvasMode,
  type CanvasNode,
} from '../editor-core/stores/canvasStore'
import { useMetricsStore, type MetricsBucket } from '../editor-core/stores/metricsStore'
import { useSimulationStore } from '../editor-core/stores/simulationStore'
import { MetricHelpIcon } from './MetricHelpIcon'
import type { InspectorMetricGroupId } from '../lib/inspectorMetricGroups'
import {
  METRIC_CARD_SHELL,
  PanelViewControls,
  type PanelViewState,
} from './inspectorPanelUi'
import { LiveMetricsTypeSection } from './liveMetricsTypeSection'

const EMPTY_HISTORY: MetricsBucket[] = []

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
    <div className={`${METRIC_CARD_SHELL} space-y-1.5`}>
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-[var(--c9-muted)]">
        <span>{label}</span>
        {help ? <MetricHelpIcon title={help} /> : null}
      </div>
      <div className="font-mono text-[15px] font-semibold tabular-nums leading-none text-[var(--c9-text-heading)]">
        {value}
      </div>
    </div>
  )
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
  hideControls?: boolean
  panelView?: PanelViewState
  onPanelViewChange?: (patch: Partial<PanelViewState>) => void
  /** DEV preview: render live inspector panels while canvas mode stays design. */
  displayMode?: CanvasMode
  /** DEV preview: use fixture deployment id for live-only chrome (e.g. cache key count). */
  metricsPreviewActive?: boolean
  metricGroup?: InspectorMetricGroupId
  onSelectMetricGroup?: (id: InspectorMetricGroupId) => void
  onOpenDataTab?: () => void
  showLatencyControls?: boolean
}

export function MetricsWaitingSkeleton() {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c9-muted)]">
        Live metrics
      </p>
      <p className="text-sm text-[var(--c9-text-disabled)]">Waiting for metrics…</p>
      <div className="space-y-2 animate-pulse" aria-hidden>
        <div className="h-14 rounded-xl bg-[var(--c9-bg-card)]" />
        <div className="h-14 rounded-xl bg-[var(--c9-bg-card)]" />
        <div className="h-20 rounded-xl bg-[var(--c9-bg-card)]/70" />
      </div>
    </div>
  )
}

export function LiveMetrics({
  node,
  hideControls = false,
  panelView: panelViewProp,
  onPanelViewChange,
  displayMode,
  metricsPreviewActive = false,
  metricGroup,
  onSelectMetricGroup,
  onOpenDataTab,
  showLatencyControls = true,
}: LiveMetricsProps) {
  const nodeId = node.id
  const canvasMode = useCanvasStore((s) => s.mode)
  const mode = displayMode ?? canvasMode
  const m = useMetricsStore((s) => s.metrics[nodeId])
  const history = useMetricsStore((s) => s.history[nodeId]) ?? EMPTY_HISTORY
  const edges = useCanvasStore((s) => s.edges)
  const nodes = useCanvasStore((s) => s.nodes)
  const snapshotTemplateId = useCanvasStore((s) => s.snapshotTemplateId)
  const selectedInstanceId = useCanvasStore((s) => s.selectedInstanceId)
  const templateMetrics = useMetricsStore((s) => s.templateMetrics)
  const loadgenActive = useMetricsStore((s) => Boolean(s.loadgen?.active))
  const simDetail = useSimulationStore((s) => s.lastInspector[nodeId])
  const simRunning = useSimulationStore((s) => s.running)
  const simPaused = useSimulationStore((s) => s.paused)
  const lastTickWallClockMs = useSimulationStore((s) => s.lastTickWallClockMs)
  const simReplicaBreakdown: ReplicaMetrics[] = simDetail?.replicaBreakdown ?? []
  const liveReplicaRows: ReplicaInspectorRow[] =
    mode === 'live' && m && m.podReplicas.length > 0
      ? replicaBreakdownFromPods(m.podReplicas, m.cpuLimit, m.memoryLimit)
      : []
  const replicaRows: ReplicaInspectorRow[] =
    mode === 'simulate' && simReplicaBreakdown.length > 0
      ? simReplicaBreakdown.map(replicaRowFromSimulation)
      : liveReplicaRows
  const [internalPanelView, setInternalPanelView] = useState<PanelViewState>(() => ({
    timeframe: 'live',
    showGraphs: true,
    latencyQuantile: readLatencyQuantile(),
  }))
  const panelView = panelViewProp ?? internalPanelView
  const patchPanelView = useCallback(
    (patch: Partial<PanelViewState>) => {
      if (onPanelViewChange) {
        onPanelViewChange(patch)
        return
      }
      setInternalPanelView((view) => {
        const next = { ...view, ...patch }
        if (patch.latencyQuantile) {
          writeLatencyQuantile(patch.latencyQuantile)
        }
        return next
      })
    },
    [onPanelViewChange],
  )

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
      return 'Simulation is paused. Inspector detail will update when you resume.'
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
    <>
      {!hideControls && node.type !== 'client' ? (
        <PanelViewControls
          view={panelView}
          onChange={patchPanelView}
        />
      ) : null}
      <LiveMetricsTypeSection
        node={node}
        m={m}
        mode={mode}
        history={history}
        edges={edges}
        nodes={nodes}
        snapshotTemplateId={snapshotTemplateId}
        templateMetrics={templateMetrics}
        loadgenActive={loadgenActive}
        view={panelView}
        metricGroup={metricGroup}
        onSelectMetricGroup={onSelectMetricGroup}
        onOpenDataTab={onOpenDataTab}
        showLatencyControls={showLatencyControls}
        onPanelViewChange={patchPanelView}
        replicaRows={
          node.type === 'compute' || node.type === 'worker' ? replicaRows : []
        }
        selectedInstanceId={selectedInstanceId}
        metricsPreviewActive={metricsPreviewActive}
      />
      {simInspectorCallout ? (
        <div className="space-y-2 border-t border-[var(--c9-border)] pt-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c9-muted)]">
            Simulation detail
          </h3>
          <p className="text-[11px] leading-relaxed text-[var(--c9-text-disabled)]">
            {simInspectorCallout}
          </p>
        </div>
      ) : null}
      {mode === 'simulate' && simInspectorHasContent(simDetail) ? (
        <SimulationInspectorSection detail={simDetail!} nodes={nodes} />
      ) : null}
    </>
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
    <div className="space-y-2 border-t border-[var(--c9-border)] pt-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c9-muted)]">
        Simulation detail
      </h3>
      <p className="text-[10px] text-[var(--c9-text-disabled)]">
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
                        {e.ttlRemaining != null ? `${fmtInt(e.ttlRemaining)}s` : FMT_EMPTY}
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
