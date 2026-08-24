import {
  fmtBytes,
  fmtErrorRate,
  fmtInt,
  fmtMs,
  fmtPct,
  fmtRate,
} from '../lib/format'
import {
  type CanvasEdge,
  type CanvasNode,
} from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import type { TweenableMetricField } from '../editor-core/playback/tweenStore'
import { useTweenedMetric } from '../editor-core/playback/useTweenedMetric'
import {
  LATENCY_HELP,
  THROUGHPUT_HELP,
  withPodRateDisclaimer,
} from '../lib/metricHelp'
import type { ReplicaInspectorRow } from '../lib/replicaMetricsDisplay'
import { InspectorDisclosure } from './InspectorDisclosure'
import { shouldShowKeyspaceDriftHint } from '../lib/storageIoDisplay'
import {
  cacheHasAppTraffic,
  resolveCacheInspectorMode,
} from '../lib/cacheLayerDisplay'
import {
  redHeadlines,
  replicaListRows as buildReplicaListRows,
} from '../lib/metricTimeframe'
import { getTopologyFlags } from '../lib/componentRole'
import { lbAlgorithmForDeploy } from '../lib/replicaConfig'
import { isMetricRelevant } from '../lib/templateKpis'
import {
  distributionHasLatency,
  groupTemplateMetricDistributions,
} from '../lib/templateMetricDistributions'
import { LatencyDistribution } from './LatencyDistribution'
import {
  buildCacheHeadlines,
  CacheCanvasFootnote,
  CacheInfrastructureSection,
  CacheSessionTotalsDisclosure,
  CacheStrategyBanner,
  CacheStrategyPerformanceSection,
  CacheTimelinePerformanceSection,
} from './cacheInspectorSections'
import {
  DbActivitySection,
  ComputeInstanceSection,
  DbClusterResourcesSection,
  DbDiagnosticsDisclosure,
  DbInstanceLayerSection,
  DbLoadSection,
  DbReplicaLagSection,
  DbConsistencySection,
  EngineHealthDisclosure,
} from './StorageIoSection'
import {
  CapacityBar,
  MetricSeriesGraph,
  PedagogicalCaption,
  PedagogicalHint,
  PedagogicalSection,
  ReplicaFlatList,
  RuntimeHealthSection,
  StatBlock,
  StatRow,
  formatResourceLabels,
  memoryUsageHelp,
  resourceUsageHelp,
  podDistributionSkew,
  type PanelViewState,
} from './inspectorPanelUi'
import { InlineDisclosure } from './InlineDisclosure'
import { rollup, samplesFromCompute } from '../lib/instanceRollup'
import { findDbLayer, type SelectedInstanceId } from '../lib/dbInstanceScope'
import { useCanvasStore } from '../editor-core/stores/canvasStore'

function truncatePodName(name: string, max = 28): string {
  if (name.length <= max) return name
  return `${name.slice(0, max - 1)}…`
}

function useLiveMetricNumber(
  nodeId: string,
  field: TweenableMetricField,
  mode: string,
  raw: number,
): number {
  const tweened = useTweenedMetric(nodeId, field)
  if (mode === 'live' && tweened !== null) return tweened
  return raw
}


export function LiveMetricsTypeSection({
  node,
  m,
  mode,
  history,
  edges,
  nodes,
  snapshotTemplateId,
  templateMetrics,
  loadgenActive,
  view,
  replicaRows = [],
  selectedInstanceId = null,
}: {
  node: CanvasNode
  m: MetricsBucket
  mode: string
  history: MetricsBucket[]
  edges: Record<string, CanvasEdge>
  nodes: Record<string, CanvasNode>
  snapshotTemplateId: string | null
  templateMetrics: Record<string, number>
  loadgenActive: boolean
  view: PanelViewState
  replicaRows?: ReplicaInspectorRow[]
  selectedInstanceId?: SelectedInstanceId
}) {
  const nodeId = node.id
  const nodeType = node.type
  const requestRate = useLiveMetricNumber(nodeId, 'requestRate', mode, m.requestRate)
  const cacheHits = useLiveMetricNumber(nodeId, 'cacheHits', mode, m.cacheHits)
  const cacheMisses = useLiveMetricNumber(nodeId, 'cacheMisses', mode, m.cacheMisses)
  const dbQueryRate = useLiveMetricNumber(nodeId, 'dbQueryRate', mode, m.dbQueryRate)
  const cpuPercent = useLiveMetricNumber(nodeId, 'cpuPercent', mode, m.cpuPercent)
  const memPercent = useLiveMetricNumber(nodeId, 'memPercent', mode, m.memPercent)
  const p50Latency = useLiveMetricNumber(nodeId, 'p50Latency', mode, m.p50Latency)
  const p95Latency = useLiveMetricNumber(nodeId, 'p95Latency', mode, m.p95Latency)
  const p99Latency = useLiveMetricNumber(nodeId, 'p99Latency', mode, m.p99Latency)
  const isSocialFeed = snapshotTemplateId === 'social-feed'
  const tmMqProduceRate = templateMetrics['mq.produce_rate']
  const tmMqConsumeRate = templateMetrics['mq.consume_rate']
  const tmMqQueueDepth = templateMetrics['mq.queue_depth']
  const tmWorkerConsumeRate = templateMetrics['worker.consume_rate']
  const tmWorkerRedisWriteRate = templateMetrics['worker.redis_write_rate']
  const tmWorkerRedisErrors = templateMetrics['worker.errors.redis']
  const tmFeedPushRate = templateMetrics['feed.push_rate']
  const computeRollup =
    nodeType === 'compute' && m.podReplicas.length > 1
      ? rollup(samplesFromCompute(m))
      : null
  const clusterCpuPercent = computeRollup?.cpuPct ?? cpuPercent
  const clusterMemPercent = computeRollup?.memPct ?? memPercent
  const clusterP99Latency =
    computeRollup?.p99 != null && computeRollup.p99 > 0
      ? computeRollup.p99 * 1000
      : p99Latency
  const resourceLabels = formatResourceLabels(m, clusterCpuPercent, clusterMemPercent)
  const resourceHelp = resourceUsageHelp(m)
  const memHelp = memoryUsageHelp(m, clusterMemPercent)
  const setSelectedInstanceId = useCanvasStore((s) => s.setSelectedInstanceId)
  const panelPrefix =
    m.runtimeHealth && m.runtimeHealth.pods.length > 0 ? (
      <RuntimeHealthSection
        runtimeHealth={m.runtimeHealth}
        instanceId={selectedInstanceId}
      />
    ) : null

  switch (nodeType) {
    case 'compute': {
      const scope = selectedInstanceId ?? 'cluster'
      const instancePod =
        scope !== 'cluster'
          ? m.podReplicas.find((pod) => pod.name === scope)
          : undefined

      if (instancePod && scope !== 'cluster') {
        return (
          <div className="space-y-5">
            {panelPrefix}
            <ComputeInstanceSection pod={instancePod} m={m} view={view} />
          </div>
        )
      }

      const red = redHeadlines(m, view.timeframe, fmtErrorRate)
      const sessionP99Ms =
        view.timeframe === 'session' && m.p99Latency9m > 0 ? m.p99Latency9m : clusterP99Latency
      const topology = getTopologyFlags(nodes)
      const perOpDistributions =
        snapshotTemplateId != null
          ? groupTemplateMetricDistributions(templateMetrics).filter(
              (d) =>
                distributionHasLatency(d) &&
                [`_p50`, `_p95`, `_p99`].some((suffix) =>
                  isMetricRelevant(snapshotTemplateId, `${d.prefix}${suffix}`, topology),
                ),
            )
          : []
      const rpsSeries = history.map((h) => h.requestRate)
      const latencySeries = history.map((h) => h.p99Latency)
      const liveP99Ms = clusterP99Latency
      const errorSeries = history.map((h) => h.errorRate)
      const cpuSeries = history.map((h) => h.cpuPercent)
      const memSeries = history.map((h) => h.memPercent)
      const computeReplicaList =
        m.podReplicas.length > 0
          ? buildReplicaListRows(m.podReplicas, view.timeframe, {
              clusterRps: requestRate,
              cpuLimitCores: m.cpuLimit,
              memoryLimitBytes: m.memoryLimit,
            })
          : replicaRows.map((r) => ({
              name: truncatePodName(r.podName || r.label, 22),
              primaryText: `${Math.round(r.qps)} rps`,
              p99Ms: r.latencyMs,
              cpuPct: r.cpuPercent,
              memPct: r.memPercent > 0 ? r.memPercent : undefined,
              warn: r.latencyMs > 500 || r.qps < requestRate * 0.1,
              hot: r.latencyMs > 1000,
            }))

      return (
        <div className="space-y-5">
          {panelPrefix}
          <PedagogicalSection
            title="API performance (RED)"
            subtitle="Is the service fast and healthy?"
          >
            <StatRow
              left={
                <StatBlock
                  label={red.throughputLabel}
                  value={red.throughputDisplay}
                  help={THROUGHPUT_HELP}
                  graph={
                    <MetricSeriesGraph
                      data={rpsSeries}
                      color="#6366f1"
                      title="Throughput"
                      unit="10s · RPS"
                      view={view}
                    />
                  }
                />
              }
              right={
                <StatBlock
                  label={red.latencyLabel}
                  value={fmtMs(red.latencyMs)}
                  help={LATENCY_HELP}
                  graph={
                    <MetricSeriesGraph
                      data={latencySeries}
                      color="var(--c9-error)"
                      title="p99 latency"
                      unit="10s · ms"
                      view={view}
                    />
                  }
                />
              }
            />
            {view.timeframe === 'live' ? (
              <LatencyDistribution
                p50Ms={p50Latency}
                p95Ms={p95Latency}
                p99Ms={liveP99Ms}
                label="Latency distribution (live)"
                compact
              />
            ) : (
              <LatencyDistribution
                p99Ms={sessionP99Ms}
                label="Latency distribution (session)"
                compact
              />
            )}
            <StatBlock
              label={red.errorLabel}
              value={red.errorDisplay}
              graph={
                <MetricSeriesGraph
                  data={errorSeries}
                  color="var(--c9-warning)"
                  title="Errors"
                  unit="10s"
                  view={view}
                />
              }
            />
            <InlineDisclosure label="Why p99 matters">
              <PedagogicalHint>
                p99 matters as much as RPS. A server at moderate RPS can be degraded if p99 is
                high because of slow downstream calls.
              </PedagogicalHint>
            </InlineDisclosure>
          </PedagogicalSection>

          {perOpDistributions.length > 0 ? (
            <PedagogicalSection
              title="Per-operation latency"
              subtitle="Latency for one request type — not blended app traffic."
            >
              <div className="space-y-3">
                {perOpDistributions.map((d) => (
                  <LatencyDistribution
                    key={d.prefix}
                    label={d.label}
                    p50Ms={d.p50Ms}
                    p95Ms={d.p95Ms}
                    p99Ms={d.p99Ms}
                  />
                ))}
              </div>
            </PedagogicalSection>
          ) : null}

          <PedagogicalSection
            title="Cluster resources (USE)"
            subtitle="Aggregate infrastructure load"
          >
            <StatRow
              left={
                <StatBlock
                  label="CPU utilization"
                  value={resourceLabels.cpu}
                  help={resourceHelp}
                  graph={
                    <MetricSeriesGraph
                      data={cpuSeries}
                      color="#f59e0b"
                      title="CPU"
                      unit="10s · %"
                      view={view}
                    />
                  }
                />
              }
              right={
                <StatBlock
                  label="Memory usage"
                  value={resourceLabels.mem}
                  help={memHelp}
                  graph={
                    <MetricSeriesGraph
                      data={memSeries}
                      color="#8b5cf6"
                      title="Memory"
                      unit="10s · %"
                      view={view}
                    />
                  }
                />
              }
            />
            {resourceHelp ? (
              <InlineDisclosure label="About these metrics">
                <PedagogicalHint tone="muted">{resourceHelp}</PedagogicalHint>
              </InlineDisclosure>
            ) : null}
          </PedagogicalSection>

          {computeReplicaList.length > 0 ? (
            <InspectorDisclosure title="Per-replica breakdown">
              <ReplicaFlatList
                rows={computeReplicaList}
                selectedName={
                  selectedInstanceId && selectedInstanceId !== 'cluster'
                    ? selectedInstanceId
                    : null
                }
                onSelectName={(name) => setSelectedInstanceId(name)}
              />
            </InspectorDisclosure>
          ) : null}
        </div>
      )
    }

    case 'cache': {
      const cacheRateHelp = withPodRateDisclaimer(THROUGHPUT_HELP, 'cache')
      const backendStrategy =
        (m.cacheStrategy ?? '').trim() ||
        String(node.config.cacheStrategy ?? 'cache-aside')
      const inspectorMode = resolveCacheInspectorMode(m, backendStrategy)
      const timelineMode = inspectorMode === 'timeline'
      const layeredCache = inspectorMode === 'layered'
      const evictionPolicy = String(node.config.evictionPolicy ?? 'allkeys-lru')
      const keyspaceDrift = shouldShowKeyspaceDriftHint(
        cacheHits,
        cacheMisses,
        m.redisKeyspaceHits ?? 0,
        m.redisKeyspaceMisses ?? 0,
      )
      const cacheHead = buildCacheHeadlines(m, view.timeframe)
      const hasTraffic = cacheHasAppTraffic(m, cacheHits, cacheMisses)
      const showLegacyRedisOps =
        timelineMode &&
        !(m.storageIo?.readRate ?? 0) &&
        (m.redisOpsPerSec ?? 0) > 0

      return (
        <div className="space-y-5">
          <CacheStrategyBanner strategy={backendStrategy} />

          {timelineMode ? (
            <CacheTimelinePerformanceSection
              m={m}
              view={view}
              tmFeedPushRate={tmFeedPushRate}
              cacheRateHelp={cacheRateHelp}
              requestRate={requestRate}
            />
          ) : (
            <CacheStrategyPerformanceSection
              cacheHead={cacheHead}
              hasTraffic={hasTraffic}
              cacheRateHelp={cacheRateHelp}
            />
          )}

          <CacheInfrastructureSection
            m={m}
            mode={inspectorMode}
            cpuPercent={cpuPercent}
            memPercent={memPercent}
            evictionPolicy={evictionPolicy}
            view={view}
          />

          {showLegacyRedisOps ? (
            <PedagogicalSection
              title="Engine throughput (USE)"
              subtitle="Legacy redisOpsPerSec; prefer storageIo when available"
            >
              <StatBlock
                label="Redis ops"
                value={`${fmtRate(m.redisOpsPerSec ?? 0)}/s`}
                help={cacheRateHelp}
              />
            </PedagogicalSection>
          ) : null}

          <CacheSessionTotalsDisclosure
            m={m}
            keyspaceDrift={keyspaceDrift}
            showKeyspaceRates={!layeredCache}
          />

          {layeredCache ? (
            <CacheCanvasFootnote
              m={m}
              cpuPercent={cpuPercent}
              memPercent={memPercent}
            />
          ) : null}
        </div>
      )
    }

    case 'database': {
      const dbRateHelp = withPodRateDisclaimer(THROUGHPUT_HELP, 'database')
      const maxConnFallback = Number(node.config.maxConnections ?? 100)
      const maxConn = m.maxConnections > 0 ? m.maxConnections : maxConnFallback
      const bucket = { ...m, dbQueryRate, maxConnections: maxConn }
      const scope = selectedInstanceId ?? 'cluster'
      const instanceLayer =
        scope !== 'cluster' ? findDbLayer(m.layers, scope) : undefined

      if (instanceLayer && scope !== 'cluster') {
        return (
          <div className="space-y-5">
            {panelPrefix}
            <DbInstanceLayerSection layer={instanceLayer} view={view} />
          </div>
        )
      }

      return (
        <div className="space-y-5">
          {panelPrefix}
          <DbActivitySection
            m={bucket}
            history={history}
            loadgenActive={loadgenActive}
            dbRateHelp={dbRateHelp}
            view={view}
          />
          <DbLoadSection
            m={m}
            dbQueryRate={dbQueryRate}
            templateMetrics={templateMetrics}
            view={view}
            history={history}
          />
          <DbReplicaLagSection m={m} />
          <DbConsistencySection m={m} />
          <DbClusterResourcesSection
            nodeId={nodeId}
            m={m}
            cpuPercent={cpuPercent}
            memPercent={memPercent}
            view={view}
            history={history}
          />
          <DbDiagnosticsDisclosure m={m} maxConnections={maxConn} />
        </div>
      )
    }

    case 'load_balancer': {
      const lbRateHelp = withPodRateDisclaimer(THROUGHPUT_HELP, 'load_balancer')
      const red = redHeadlines(m, view.timeframe, fmtErrorRate)
      const lbRpsSeries = history.map((h) => h.requestRate)
      const backends = Object.values(edges)
        .filter((e) => e.sourceId === nodeId)
        .map((e) => nodes[e.targetId])
        .filter((b): b is CanvasNode => Boolean(b))
      const algo =
        m.lbAlgorithm?.trim() ||
        String(node.config.lbAlgorithm ?? node.config.algorithm ?? 'round-robin')
      const backendPods = m.backendPods ?? []
      const perBe = Object.entries(m.perBackendRps).sort(([a], [b]) => a.localeCompare(b))
      const connLimit = m.lbConnectionLimit
      const active = m.activeConnections
      const connPct = connLimit > 0 ? Math.min(100, (active / connLimit) * 100) : 0
      const podRates =
        backendPods.length > 0
          ? backendPods.map((p) => p.requestRate)
          : perBe.map(([, rps]) => rps)
      const skew = podDistributionSkew(podRates)
      const maxRate = skew.max
      const replicaListRows =
        backendPods.length > 0
          ? buildReplicaListRows(backendPods, view.timeframe, {
              clusterRps: requestRate,
              maxRate,
              skewed: skew.skewed,
              cpuLimitCores: m.cpuLimit,
              memoryLimitBytes: m.memoryLimit,
            })
          : perBe.map(([name, rps]) => ({
              name: truncatePodName(name),
              primaryText: `${Math.round(rps)} rps`,
              p99Ms: 0,
              warn: skew.skewed && rps < maxRate * 0.5,
              hot: skew.skewed && rps >= maxRate * 0.9,
            }))

      return (
        <div className="space-y-5">
          {panelPrefix}
          <PedagogicalSection
            title="Ingress intent (Declarative)"
            subtitle="What the system is asked to do"
          >
            <StatRow
              left={
                <StatBlock
                  label={
                    view.timeframe === 'session'
                      ? 'Total requests (9m)'
                      : 'Requests routed'
                  }
                  value={red.throughputDisplay}
                  help={lbRateHelp}
                  graph={
                    <MetricSeriesGraph
                      data={lbRpsSeries}
                      color="var(--c9-info)"
                      title="Throughput"
                      unit="10s · RPS"
                      view={view}
                    />
                  }
                />
              }
              right={
                view.timeframe === 'session' ? (
                  <StatBlock
                    label={red.latencyLabel}
                    value={fmtMs(red.latencyMs)}
                    help={LATENCY_HELP}
                  />
                ) : (
                  <StatBlock label="Algorithm" value={algo} />
                )
              }
            />
            <PedagogicalCaption>Algorithm: {algo}</PedagogicalCaption>
          </PedagogicalSection>

          <PedagogicalSection
            title="Routing execution (Imperative USE)"
            subtitle="How the infrastructure is handling it"
          >
            <StatRow
              left={
                <StatBlock
                  label="Backend health"
                  value={
                    m.backendReplicas
                      ? `${fmtInt(m.backendReplicas.ready)} / ${fmtInt(m.backendReplicas.desired)} ready`
                      : `${backends.length} backends`
                  }
                />
              }
              right={
                connLimit > 0 ? (
                  <div className="space-y-1">
                    <StatBlock
                      label="Connections"
                      value={`${fmtInt(Math.round(active))} / ${fmtInt(connLimit)}`}
                    />
                    <CapacityBar pct={connPct} warnAt={75} criticalAt={90} />
                  </div>
                ) : (
                  <StatBlock label="Connections" value="—" />
                )
              }
            />
            {replicaListRows.length > 0 ? (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Per-pod distribution
                </p>
                <ReplicaFlatList rows={replicaListRows} />
              </div>
            ) : null}
            {skew.skewed ? (
              <InlineDisclosure label="Why distribution is uneven">
                <PedagogicalHint>
                  {lbAlgorithmForDeploy(algo) === 'ip_hash' ? (
                    <>
                      Nginx ip_hash sticks each IPv4 /24 (first three octets) to one
                      backend. Uneven per-pod totals are expected: one hot replica per
                      subnet, not one request per last octet.
                    </>
                  ) : (
                    <>
                      Uneven distribution? Switching to &apos;least-connections&apos;
                      balances long-lived traffic more evenly.
                    </>
                  )}
                </PedagogicalHint>
              </InlineDisclosure>
            ) : null}
          </PedagogicalSection>

          <EngineHealthDisclosure m={m} cpuPercent={cpuPercent} memPercent={memPercent} />
        </div>
      )
    }

    case 'client':
      return (
        <div className="space-y-2">
          <StatBlock label="Current RPS" value={fmtInt(requestRate)} />
          <StatBlock label="Total requests" value={fmtInt(m.totalRequests)} />
        </div>
      )

    case 'message_queue': {
      const produceRate =
        isSocialFeed && Number.isFinite(tmMqProduceRate) ? tmMqProduceRate : m.produceRate
      const consumeRate =
        isSocialFeed && Number.isFinite(tmMqConsumeRate) ? tmMqConsumeRate : m.consumeRate
      const queueDepth =
        isSocialFeed && Number.isFinite(tmMqQueueDepth) ? tmMqQueueDepth : m.queueDepth
      const prodSeries = history.map((h) => h.produceRate)
      const consSeries = history.map((h) => h.consumeRate)
      const depthSeries = history.map((h) => h.queueDepth)
      const memPct =
        m.mqMemoryLimit > 0
          ? Math.min(100, (m.mqMemoryUsed / m.mqMemoryLimit) * 100)
          : 0
      const growingBacklog = consumeRate > 0 && produceRate > consumeRate

      return (
        <div className="space-y-5">
          {panelPrefix}
          <PedagogicalSection
            title="Message traffic (RED)"
            subtitle="Logical publishing and consumption rates"
          >
            <StatRow
              left={
                <StatBlock
                  label="Publish rate"
                  value={`${fmtRate(produceRate)}/s`}
                  graph={
                    <MetricSeriesGraph
                      data={prodSeries}
                      color="#a78bfa"
                      title="Produce"
                      unit="10s · msg/s"
                      view={view}
                    />
                  }
                />
              }
              right={
                <StatBlock
                  label="Consume rate"
                  value={`${fmtRate(consumeRate)}/s`}
                  graph={
                    <MetricSeriesGraph
                      data={consSeries}
                      color="#34d399"
                      title="Consume"
                      unit="10s · msg/s"
                      view={view}
                    />
                  }
                />
              }
            />
          </PedagogicalSection>

          <PedagogicalSection
            title="Queue state (USE)"
            subtitle="Aggregate infrastructure load and backlog"
          >
            <StatRow
              left={
                <StatBlock
                  label="Queue depth"
                  value={fmtInt(Math.round(queueDepth))}
                  graph={
                    <MetricSeriesGraph
                      data={depthSeries}
                      color="#f59e0b"
                      title="Depth"
                      unit="10s"
                      view={view}
                    />
                  }
                />
              }
              right={
                m.mqMemoryLimit > 0 ? (
                  <div className="space-y-1">
                    <StatBlock
                      label="Memory usage"
                      value={`${fmtBytes(m.mqMemoryUsed)} · ${memPct.toFixed(1)}%`}
                    />
                    <CapacityBar pct={memPct} />
                  </div>
                ) : (
                  <StatBlock label="Memory usage" value="—" />
                )
              }
            />
            {growingBacklog ? (
              <InlineDisclosure label="Why backlog is growing">
                <PedagogicalHint>
                  Growing backlog: Consume rate ({fmtRate(consumeRate)}/s) is lower than Publish
                  rate ({fmtRate(produceRate)}/s). Consider scaling up Worker replicas to drain
                  the queue faster before memory limits are breached.
                </PedagogicalHint>
              </InlineDisclosure>
            ) : null}
          </PedagogicalSection>

          <InspectorDisclosure title="Engine detail & diagnostics">
            <div className="space-y-1 font-mono text-[11px] text-gray-300">
              <div>
                Unacked messages · {fmtInt(Math.round(m.messagesUnacked))} · Ready ·{' '}
                {fmtInt(Math.round(m.messagesReady))}
              </div>
              {Number.isFinite(m.mqSaturationRatio) && m.mqSaturationRatio > 0 ? (
                <div>Saturation · {m.mqSaturationRatio.toFixed(2)}×</div>
              ) : null}
            </div>
            <InlineDisclosure label="About these metrics">
              <PedagogicalHint tone="muted">
                Engine-specific (RabbitMQ) counters. Unacked messages represent jobs currently
                being processed by workers but not yet completed.
              </PedagogicalHint>
            </InlineDisclosure>
          </InspectorDisclosure>

          <EngineHealthDisclosure m={m} cpuPercent={cpuPercent} memPercent={memPercent} />
        </div>
      )
    }

    case 'worker': {
      const workerRateHelp = withPodRateDisclaimer(THROUGHPUT_HELP, 'worker')
      const wSat = Number.isFinite(m.workerSaturation) ? m.workerSaturation : 0
      const ws = Math.min(100, wSat * 100)
      const consumeRate =
        isSocialFeed && Number.isFinite(tmWorkerConsumeRate)
          ? tmWorkerConsumeRate
          : m.consumeRate
      const consSeries = history.map((h) => h.consumeRate)
      const cpuSeries = history.map((h) => h.cpuPercent)

      return (
        <div className="space-y-5">
          {panelPrefix}
          <PedagogicalSection
            title="Job processing (RED)"
            subtitle="Logical job execution speed and health"
          >
            <StatRow
              left={
                <StatBlock
                  label="Process rate"
                  value={`${fmtRate(consumeRate)}/s`}
                  help={workerRateHelp}
                  graph={
                    <MetricSeriesGraph
                      data={consSeries}
                      color="#2dd4bf"
                      title="Consume"
                      unit="10s · /s"
                      view={view}
                    />
                  }
                />
              }
              right={
                <StatBlock label="Error rate" value={`${fmtRate(m.errorRate)}/s`} />
              }
            />
            {Number.isFinite(tmWorkerRedisWriteRate) ? (
              <p className="font-mono text-[10px] text-gray-400">
                Redis writes · {fmtRate(tmWorkerRedisWriteRate)}/s
                {Number.isFinite(tmWorkerRedisErrors)
                  ? ` · errors ${fmtRate(tmWorkerRedisErrors)}/s`
                  : ''}
              </p>
            ) : null}
          </PedagogicalSection>

          <PedagogicalSection
            title="Compute resources (USE)"
            subtitle="Aggregate infrastructure load"
          >
            <StatRow
              left={
                <StatBlock
                  label="CPU utilization"
                  value={resourceLabels.cpu}
                  help={resourceHelp}
                  graph={
                    <MetricSeriesGraph
                      data={cpuSeries}
                      color="#f59e0b"
                      title="CPU"
                      unit="10s · %"
                      view={view}
                    />
                  }
                />
              }
              right={
                <StatBlock
                  label="Memory usage"
                  value={resourceLabels.mem}
                  help={memHelp}
                />
              }
            />
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-gray-500">
                Saturation
              </p>
              <CapacityBar pct={ws} warnAt={75} criticalAt={95} />
            </div>
            <StatBlock label="Queue depth" value={fmtInt(Math.round(m.queueDepth))} />
            {cpuPercent > 90 ? (
              <InlineDisclosure label="Why processing is slow">
                <PedagogicalHint>
                  Compute bound: Workers are heavily saturating CPU ({fmtPct(cpuPercent)}),
                  capping the process rate at {fmtRate(consumeRate)}/s. Scale up worker replicas
                  to process the message queue backlog in parallel.
                </PedagogicalHint>
              </InlineDisclosure>
            ) : null}
            {resourceHelp ? (
              <InlineDisclosure label="About these metrics">
                <PedagogicalHint tone="muted">{resourceHelp}</PedagogicalHint>
              </InlineDisclosure>
            ) : null}
          </PedagogicalSection>

          <EngineHealthDisclosure m={m} cpuPercent={cpuPercent} memPercent={memPercent} />
        </div>
      )
    }

    default:
      return null
  }
}
