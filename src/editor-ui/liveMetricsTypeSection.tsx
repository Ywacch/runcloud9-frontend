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
import { isMetricsPlaybackEnabled } from '../editor-core/playback/playbackConfig'
import { useTweenedMetric } from '../editor-core/playback/useTweenedMetric'
import {
  LATENCY_HELP,
  THROUGHPUT_HELP,
  withPodRateDisclaimer,
} from '../lib/metricHelp'
import type { ReplicaInspectorRow } from '../lib/replicaMetricsDisplay'
import { InspectorDisclosure } from './InspectorDisclosure'
import { shouldShowKeyspaceDriftHint } from '../lib/storageIoDisplay'
import { isLayeredCache } from '../lib/cacheLayerDisplay'
import {
  cacheHeadlines,
  cacheHitRateDisplay,
  feedPushHeadline,
  redHeadlines,
  replicaListRows as buildReplicaListRows,
} from '../lib/metricTimeframe'
import {
  CacheEnginePanels,
  DbActivitySection,
  DbClusterResourcesSection,
  DbDiagnosticsDisclosure,
  DbLoadSection,
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

function isTimelineCacheMode(strategy: string, metricMode: string): boolean {
  const normalizedMode = metricMode.toLowerCase()
  return strategy === 'timeline-store' || normalizedMode.includes('sorted-set')
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
}) {
  const nodeId = node.id
  const nodeType = node.type
  const requestRate = useLiveMetricNumber(nodeId, 'requestRate', mode, m.requestRate)
  const cacheHits = useLiveMetricNumber(nodeId, 'cacheHits', mode, m.cacheHits)
  const cacheMisses = useLiveMetricNumber(nodeId, 'cacheMisses', mode, m.cacheMisses)
  const dbQueryRate = useLiveMetricNumber(nodeId, 'dbQueryRate', mode, m.dbQueryRate)
  const cpuPercent = useLiveMetricNumber(nodeId, 'cpuPercent', mode, m.cpuPercent)
  const memPercent = useLiveMetricNumber(nodeId, 'memPercent', mode, m.memPercent)
  const isSocialFeed = snapshotTemplateId === 'social-feed'
  const tmMqProduceRate = templateMetrics['mq.produce_rate']
  const tmMqConsumeRate = templateMetrics['mq.consume_rate']
  const tmMqQueueDepth = templateMetrics['mq.queue_depth']
  const tmWorkerConsumeRate = templateMetrics['worker.consume_rate']
  const tmWorkerRedisWriteRate = templateMetrics['worker.redis_write_rate']
  const tmWorkerRedisErrors = templateMetrics['worker.errors.redis']
  const tmFeedPushRate = templateMetrics['feed.push_rate']
  const chartPlaybackDelay = mode === 'live' && isMetricsPlaybackEnabled()
  const resourceLabels = formatResourceLabels(m, cpuPercent, memPercent)
  const resourceHelp = resourceUsageHelp(m)
  const memHelp = memoryUsageHelp(m, memPercent)
  const panelPrefix =
    m.runtimeHealth && m.runtimeHealth.pods.length > 0 ? (
      <RuntimeHealthSection runtimeHealth={m.runtimeHealth} />
    ) : null

  switch (nodeType) {
    case 'compute': {
      const red = redHeadlines(m, view.timeframe, fmtErrorRate)
      const rpsSeries = history.map((h) => h.requestRate)
      const latencySeries = history.map((h) => h.p99Latency)
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
                      showPlaybackDelay={chartPlaybackDelay}
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
                      showPlaybackDelay={chartPlaybackDelay}
                    />
                  }
                />
              }
            />
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
                  showPlaybackDelay={chartPlaybackDelay}
                />
              }
            />
            <PedagogicalHint>
              p99 matters as much as RPS. A server at moderate RPS can be degraded if p99 is
              high because of slow downstream calls.
            </PedagogicalHint>
          </PedagogicalSection>

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
                      showPlaybackDelay={chartPlaybackDelay}
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
                      showPlaybackDelay={chartPlaybackDelay}
                    />
                  }
                />
              }
            />
          </PedagogicalSection>

          {computeReplicaList.length > 0 ? (
            <InspectorDisclosure title="Per-replica breakdown">
              <ReplicaFlatList rows={computeReplicaList} />
            </InspectorDisclosure>
          ) : null}
        </div>
      )
    }

    case 'cache': {
      const cacheRateHelp = withPodRateDisclaimer(THROUGHPUT_HELP, 'cache')
      const cacheHead = cacheHeadlines(m, view.timeframe, fmtRate)
      const hitRateLabel = cacheHitRateDisplay(cacheHead.hitRatePct)
      const hitRateSeries = history.map((h) => {
        const t = h.cacheHits + h.cacheMisses
        return t > 0 ? (h.cacheHits / t) * 100 : 0
      })
      const hitsSeries = history.map((h) => h.cacheHits)
      const backendStrategy =
        (m.cacheStrategy ?? '').trim() ||
        String(node.config.cacheStrategy ?? 'cache-aside')
      const metricMode = (m.cacheMetricMode ?? '').trim()
      const timelineMode = isTimelineCacheMode(backendStrategy, metricMode)
      const evictionPolicy = String(node.config.evictionPolicy ?? 'allkeys-lru')
      const storageIoReadRate = m.storageIo?.readRate ?? 0
      const preferStorageIo = storageIoReadRate > 0
      const keyspaceDrift = shouldShowKeyspaceDriftHint(
        cacheHits,
        cacheMisses,
        m.redisKeyspaceHits ?? 0,
        m.redisKeyspaceMisses ?? 0,
      )
      const layeredCache = isLayeredCache(m)

      if (timelineMode) {
        const showLegacyRedisOps =
          !preferStorageIo && (m.redisOpsPerSec ?? 0) > 0
        const feedHead = feedPushHeadline(m, view.timeframe, tmFeedPushRate, fmtRate)
        const cacheRed = redHeadlines(m, view.timeframe, fmtErrorRate)

        return (
          <div className="space-y-5">
            {panelPrefix}
            <PedagogicalSection
              title="Feed delivery (RED)"
              subtitle="Push-model timeline reads"
            >
              <StatRow
                left={
                  <StatBlock
                    label={feedHead.label}
                    value={feedHead.display}
                    help={view.timeframe === 'live' ? cacheRateHelp : undefined}
                  />
                }
                right={
                  <StatBlock
                    label={
                      view.timeframe === 'session'
                        ? cacheRed.throughputLabel
                        : 'Request rate'
                    }
                    value={
                      view.timeframe === 'session'
                        ? cacheRed.throughputDisplay
                        : `${fmtRate(requestRate)}/s`
                    }
                  />
                }
              />
              <PedagogicalCaption>
                Template feed.push_rate tracks timeline read traffic; engine
                command rates below use wire storageIo labels (e.g. ZREVRANGE).
              </PedagogicalCaption>
            </PedagogicalSection>

            <CacheEnginePanels
              m={m}
              cpuPercent={cpuPercent}
              memPercent={memPercent}
              evictionPolicy={evictionPolicy}
              view={view}
              showPlaybackDelay={chartPlaybackDelay}
              history={history}
            />

            {showLegacyRedisOps ? (
              <PedagogicalSection
                title="Engine throughput (USE)"
                subtitle="Legacy redisOpsPerSec — prefer storageIo when available"
              >
                <StatBlock
                  label="Redis ops"
                  value={`${fmtRate(m.redisOpsPerSec ?? 0)}/s`}
                  help={cacheRateHelp}
                />
              </PedagogicalSection>
            ) : null}

            {!layeredCache ? (
            <EngineHealthDisclosure
              m={m}
              cpuPercent={cpuPercent}
              memPercent={memPercent}
            />
            ) : null}
          </div>
        )
      }

      return (
        <div className="space-y-5">
          {panelPrefix}
          <PedagogicalSection
            title="App cache intent (Declarative)"
            subtitle="Did the cache strategy successfully intercept DB queries?"
          >
            <StatRow
              left={
                <StatBlock
                  label={cacheHead.hitRateLabel}
                  value={hitRateLabel}
                  graph={
                    <MetricSeriesGraph
                      data={hitRateSeries}
                      color="var(--c9-success)"
                      title="Hit rate"
                      unit="10s · %"
                      view={view}
                      showPlaybackDelay={chartPlaybackDelay}
                    />
                  }
                />
              }
              right={
                <StatBlock
                  label={cacheHead.throughputLabel}
                  value={cacheHead.throughputDisplay}
                  help={cacheRateHelp}
                  graph={
                    <MetricSeriesGraph
                      data={hitsSeries}
                      color="#22d3ee"
                      title="Hits"
                      unit="10s · /s"
                      view={view}
                      showPlaybackDelay={chartPlaybackDelay}
                    />
                  }
                />
              }
            />
            <PedagogicalCaption>
              App logical cache on the redirect path — not Redis keyspace counters.
            </PedagogicalCaption>
          </PedagogicalSection>

          <CacheEnginePanels
            m={m}
            cpuPercent={cpuPercent}
            memPercent={memPercent}
            evictionPolicy={evictionPolicy}
            view={view}
            showPlaybackDelay={chartPlaybackDelay}
            history={history}
          />

          {!layeredCache ? (
          <InspectorDisclosure title="Engine detail & keyspace" hint="Protocol counters">
            {view.timeframe === 'session' ? (
              <div className="font-mono text-[11px] text-gray-300">
                Session totals · Hits {fmtInt(m.cacheHitsLast9m)} · Misses{' '}
                {fmtInt(m.cacheMissesLast9m)}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-gray-500">
                  Session totals (9 min)
                </div>
                <div className="font-mono text-[11px] text-gray-300">
                  Hits {fmtInt(m.cacheHitsLast9m)} · Misses {fmtInt(m.cacheMissesLast9m)}
                </div>
              </div>
            )}
            <StatRow
              left={
                <StatBlock
                  label="Keyspace hits/s"
                  value={`${fmtRate(m.redisKeyspaceHits)}/s`}
                />
              }
              right={
                <StatBlock
                  label="Keyspace misses/s"
                  value={`${fmtRate(m.redisKeyspaceMisses)}/s`}
                />
              }
            />
            {(m.redisConnectedClients ?? 0) > 0 ? (
              <div className="font-mono text-[11px] text-gray-400">
                Connected clients · {fmtInt(Math.round(m.redisConnectedClients ?? 0))}
              </div>
            ) : null}
            <PedagogicalHint tone="sky">
              {keyspaceDrift
                ? 'App hit rate and keyspace counters differ by more than 10% — check pod aggregation scope.'
                : 'Protocol counters track network noise; minor drift from app metrics is normal.'}
            </PedagogicalHint>
          </InspectorDisclosure>
          ) : (
            <InspectorDisclosure title="Session keyspace totals" hint="Rolling 9m window">
              {view.timeframe === 'session' ? (
                <div className="font-mono text-[11px] text-gray-300">
                  Session totals · Hits {fmtInt(m.cacheHitsLast9m)} · Misses{' '}
                  {fmtInt(m.cacheMissesLast9m)}
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-gray-500">
                    Session totals (9 min)
                  </div>
                  <div className="font-mono text-[11px] text-gray-300">
                    Hits {fmtInt(m.cacheHitsLast9m)} · Misses {fmtInt(m.cacheMissesLast9m)}
                  </div>
                </div>
              )}
            </InspectorDisclosure>
          )}

          {!layeredCache ? (
          <EngineHealthDisclosure m={m} cpuPercent={cpuPercent} memPercent={memPercent} />
          ) : null}
        </div>
      )
    }

    case 'database': {
      const dbRateHelp = withPodRateDisclaimer(THROUGHPUT_HELP, 'database')
      const maxConnFallback = Number(node.config.maxConnections ?? 100)
      const maxConn = m.maxConnections > 0 ? m.maxConnections : maxConnFallback
      const bucket = { ...m, dbQueryRate, maxConnections: maxConn }

      return (
        <div className="space-y-5">
          {panelPrefix}
          <DbActivitySection
            m={bucket}
            history={history}
            loadgenActive={loadgenActive}
            dbRateHelp={dbRateHelp}
            view={view}
            showPlaybackDelay={chartPlaybackDelay}
          />
          <DbLoadSection
            m={m}
            dbQueryRate={dbQueryRate}
            templateMetrics={templateMetrics}
            view={view}
            showPlaybackDelay={chartPlaybackDelay}
            history={history}
          />
          <DbClusterResourcesSection
            nodeId={nodeId}
            m={m}
            cpuPercent={cpuPercent}
            memPercent={memPercent}
            view={view}
            showPlaybackDelay={chartPlaybackDelay}
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
                      showPlaybackDelay={chartPlaybackDelay}
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
              <PedagogicalHint>
                Uneven distribution? Switching to &apos;least-connections&apos; balances
                long-lived traffic more evenly.
              </PedagogicalHint>
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
                      showPlaybackDelay={chartPlaybackDelay}
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
                      showPlaybackDelay={chartPlaybackDelay}
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
                      showPlaybackDelay={chartPlaybackDelay}
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
              <PedagogicalHint>
                Growing backlog: Consume rate ({fmtRate(consumeRate)}/s) is lower than Publish
                rate ({fmtRate(produceRate)}/s). Consider scaling up Worker replicas to drain
                the queue faster before memory limits are breached.
              </PedagogicalHint>
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
            <PedagogicalHint tone="muted">
              Engine-specific (RabbitMQ) counters. Unacked messages represent jobs currently
              being processed by workers but not yet completed.
            </PedagogicalHint>
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
                      showPlaybackDelay={chartPlaybackDelay}
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
                      showPlaybackDelay={chartPlaybackDelay}
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
              <PedagogicalHint>
                Compute bound: Workers are heavily saturating CPU ({fmtPct(cpuPercent)}),
                capping the process rate at {fmtRate(consumeRate)}/s. Scale up worker replicas
                to process the message queue backlog in parallel.
              </PedagogicalHint>
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
