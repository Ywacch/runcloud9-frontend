import { useMemo, useState } from 'react'
import {
  isCpuUtilWarn,
  isMemUtilWarn,
  resourceWarnFootLabel,
  WARNING_CPU,
  WARNING_MEM,
} from '../editor-core/domain/healthThresholds'
import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { useMetricsStore } from '../editor-core/stores/metricsStore'
import { FMT_EMPTY, fmtBytes, fmtErrorRate, fmtInt, fmtMemMB, fmtRate } from '../lib/format'
import { bucketSessionQuantileAvailable } from '../lib/latencyQuantile'
import type { InspectorMetricGroupId } from '../lib/inspectorMetricGroups'
import type { PanelViewState } from './inspectorPanelUi'
import type { SelectedInstanceId } from '../lib/dbInstanceScope'
import { findDbLayer } from '../lib/dbInstanceScope'
import {
  appLatencyCommitWaitNote,
  engineClientScopeNote,
  replicationModeMeaning,
} from '../lib/dbReplicationDisplay'
import { readConsistencyFromConfig } from '../lib/readConsistency'
import {
  clampReadReplicas,
  lbAlgorithmForDeploy,
  normalizeReplicationModeForDeploy,
  normalizeSyncCommitLevelForDeploy,
  replicationModeFromConfig,
  syncCommitLevelFromConfig,
} from '../lib/replicaConfig'
import {
  lbBackendResourceLimits,
  lbBackendSkewLabel,
  lbBackendTableRows,
  lbConnectedComputeNodes,
  lbInspectorBackendPods,
  lbSkewExplanation,
} from '../lib/lbInspectorMetrics'
import { lbBackendCount } from '../lib/inspectorCapabilities'
import {
  dbLayerAppSqlHeadline,
  dbQueryHeadline,
  inspectorThroughputColumnLabel,
  storageIoThroughputFields,
} from '../lib/metricTimeframe'
import { bucketLatencyField, layerLatencyMs } from '../lib/latencyQuantile'
import {
  CACHE_KEYSPACE_HITS_HELP,
  CACHE_TIMELINES_COUNT_HELP,
  DB_POSTGRES_CONNECTIONS_HELP,
  POD_RATE_DISCLAIMER,
  SESSION_CACHE_TOTALS_HINT,
  SESSION_LATENCY_P99_HELP,
  SESSION_REPLICA_BREAKDOWN_HINT,
  SESSION_STORAGE_ENGINE_HINT,
} from '../lib/metricHelp'
import {
  fanoutScanModelEstimate,
  formatDbQueriesPerSec,
  parseDbQuerySource,
  shouldShowKeyspaceDriftHint,
  storageIoSessionLabel,
  storageReadTileLabel,
  storageWriteTileLabel,
} from '../lib/storageIoDisplay'
import {
  StacklabDbEngineFootnotes,
  StacklabDbPatternBridge,
  StacklabDbReplicationBody,
} from './stacklabDbPanels'
import {
  cacheHitRatePct,
  computeClusterP99,
  effectiveRedBucket,
  brokerPodStatusLine,
  historySeries,
  latencyTriple,
  podStatusLine,
  podTableRows,
  redPaneFields,
  selectedLatencyMs,
  utilHelpCpu,
  utilHelpMem,
} from './stacklabPaneData'
import {
  SlBarInline,
  SlBeList,
  SlCounter,
  SlDisc,
  SlGauge,
  SlGraphWrap,
  SlHint,
  SlIdentLine,
  SlPaneSection,
  SlPodStatus,
  SlPodTable,
  SlRedHealthPane,
  SlRow,
  SlSecHead,
  SlSpacer,
  SlStatCell,
  SlStatStrip,
  SlTile,
  SlTileFoot,
  SlTileLab,
  SlTileVal,
  SlTiles,
  SlTrade,
  SlUnit,
  SlUtil,
  SlUtilHelp,
  SlUtilTop,
  SlScale,
} from './stacklabPanePrimitives'
import { StacklabNote as Note, StacklabSparkline } from './stacklabMetricsUi'

export interface StacklabInspectorPaneProps {
  node: CanvasNode
  m: MetricsBucket
  history: MetricsBucket[]
  nodes: Record<string, CanvasNode>
  edges: Record<string, CanvasEdge>
  snapshotTemplateId: string | null
  templateMetrics: Record<string, number>
  view: PanelViewState
  metricGroup: InspectorMetricGroupId
  selectedInstanceId?: SelectedInstanceId
  onPanelViewChange?: (patch: Partial<PanelViewState>) => void
  onSelectPod?: (name: string) => void
  onSelectMetricGroup?: (id: InspectorMetricGroupId) => void
  onOpenDataTab?: () => void
  showLatencyControls?: boolean
}

export function StacklabInspectorPane(props: StacklabInspectorPaneProps) {
  const { node } = props
  switch (node.type) {
    case 'compute':
      return <ComputePane {...props} />
    case 'database':
      return <DatabasePane {...props} />
    case 'cache':
      return <CachePane {...props} />
    case 'message_queue':
      return <MqPane {...props} />
    case 'worker':
      return <WorkerPane {...props} />
    case 'load_balancer':
      return <LoadBalancerPane {...props} />
    default:
      return null
  }
}

function ComputePane({
  m,
  history,
  view,
  metricGroup,
  selectedInstanceId,
  onPanelViewChange,
  onSelectPod,
  onSelectMetricGroup,
  showLatencyControls,
}: StacklabInspectorPaneProps) {
  const bucket = effectiveRedBucket(m, selectedInstanceId)
  const clusterP99 = computeClusterP99(m)
  const red = redPaneFields(bucket, view.timeframe, view.latencyQuantile)
  const dist = latencyTriple(bucket, view.timeframe, clusterP99)
  const rpsSeries = historySeries(history, 'requestRate')
  const cpuSeries = historySeries(history, 'cpuPercent')

  if (metricGroup === 'health') {
    return (
      <SlPaneSection>
        <SlRedHealthPane
          index="01"
          title="Is the API fast and healthy?"
          subtitle="Request rate, latency, and errors."
          rateLabel={view.timeframe === 'session' ? red.throughputLabel : 'Request rate'}
          rateValue={
            view.timeframe === 'session' ? red.throughputDisplay : fmtInt(bucket.requestRate)
          }
          rateUnit={view.timeframe === 'session' ? '' : 'rps'}
          rateSpark={rpsSeries}
          ratePeak={rpsSeries.length ? Math.max(...rpsSeries) : bucket.requestRate}
          latencyMs={selectedLatencyMs(bucket, view.timeframe, view.latencyQuantile, clusterP99)}
          quantile={view.latencyQuantile}
          timeframe={view.timeframe}
          sessionAvailable={(q) => bucketSessionQuantileAvailable(bucket, q)}
          onQuantileChange={
            showLatencyControls
              ? (q) => onPanelViewChange?.({ latencyQuantile: q })
              : undefined
          }
          distP50={dist.p50}
          distP95={dist.p95}
          distP99={dist.p99}
          showGraphs={view.showGraphs}
          sampleLabel={view.timeframe === 'session' ? 'session window' : 'last 10s'}
          errorDisplay={red.errorDisplay}
          hintForward={<>This shows up in <b>Internals</b></>}
          onHintForwardClick={() => onSelectMetricGroup?.('internals')}
          sessionCaveat={
            view.timeframe === 'session' ? (
              <Note mark="↔">{SESSION_LATENCY_P99_HELP}</Note>
            ) : null
          }
        />
      </SlPaneSection>
    )
  }

  if (metricGroup === 'internals') {
    const cpuHot = isCpuUtilWarn(bucket.cpuPercent)
    const memHot = isMemUtilWarn(bucket.memPercent)
    return (
      <SlPaneSection>
        <SlHint direction="back" onClick={() => onSelectMetricGroup?.('health')}>
          follows from <b>Health</b>
        </SlHint>
        <SlSpacer />
        <SlSecHead index="02" title="CPU and Mem usage" />
        <SlUtil hot={cpuHot}>
          <SlUtilTop
            label="CPU utilization"
            value={Math.round(bucket.cpuPercent)}
            unit="%"
            tone={cpuHot ? 'amber' : undefined}
          />
          <SlScale
            pct={bucket.cpuPercent}
            warnAt={WARNING_CPU}
            footLeft="vs pod limit, sustained high values mean pressure"
            footRight="0 · 50 · 100%"
          />
          <SlUtilHelp>{utilHelpCpu(m)}</SlUtilHelp>
          {view.showGraphs ? (
            <SlGraphWrap title="CPU · last 10s" sub="mean / peak" data={cpuSeries} />
          ) : null}
        </SlUtil>
        <SlUtil hot={memHot}>
          <SlUtilTop
            label="Memory utilization"
            value={Math.round(bucket.memPercent)}
            unit="%"
            tone={memHot ? 'amber' : undefined}
          />
          <SlScale
            pct={bucket.memPercent}
            warnAt={WARNING_MEM}
            footLeft="watch for pressure before OOM risk"
            footRight="0 · 50 · 100%"
          />
          <SlUtilHelp>{utilHelpMem(m)}</SlUtilHelp>
        </SlUtil>
        <SlHint direction="forward" onClick={() => onSelectMetricGroup?.('replicas')}>
          Which replica is hot? <b>Replicas</b>
        </SlHint>
      </SlPaneSection>
    )
  }

  if (metricGroup === 'replicas') {
    const status = podStatusLine(m)
    const rows = podTableRows(m, view.timeframe, view.latencyQuantile, selectedInstanceId, onSelectPod)
    const spotlight = selectedInstanceId && selectedInstanceId !== 'cluster' ? selectedInstanceId : rows[0]?.name
    return (
      <SlPaneSection>
        <SlSecHead
          index="03"
          title="Which replica is carrying the load?"
          subtitle="Per-pod share, readiness, and restarts. Click a pod to spotlight it."
        />
        {status ? (
          <SlPodStatus ready={status.ready} bad={status.bad} warn={status.warn} />
        ) : null}
        <SlPodTable
          columns={[
            'pod',
            inspectorThroughputColumnLabel(view.timeframe, 'rps'),
            view.latencyQuantile,
            'cpu',
            'mem',
          ]}
          rows={rows}
        />
        <Note mark="i">
          {spotlight ? (
            <>
              Spotlighting <em>{spotlight}</em> — the Instance scope reads the selected pod.{' '}
            </>
          ) : null}
          {SESSION_REPLICA_BREAKDOWN_HINT}
        </Note>
      </SlPaneSection>
    )
  }

  return null
}

function DatabasePane({
  node,
  m,
  history,
  view,
  metricGroup,
  selectedInstanceId,
  onSelectMetricGroup,
  templateMetrics,
}: StacklabInspectorPaneProps) {
  const [freshOpen, setFreshOpen] = useState(false)
  const maxConn = m.maxConnections > 0 ? m.maxConnections : Number(node.config.maxConnections ?? 100)
  const qSeries = historySeries(history, 'dbQueryRate')
  const layer = selectedInstanceId && selectedInstanceId !== 'cluster'
    ? findDbLayer(m.layers, selectedInstanceId)
    : undefined

  if (metricGroup === 'app-load') {
    const errPct = m.errorRate * 100
    const errHot = view.timeframe === 'live' && errPct >= 0.25 && !layer
    const qHead = layer
      ? dbLayerAppSqlHeadline(layer, view.timeframe)
      : dbQueryHeadline(m, view.timeframe)
    const latMs = layer
      ? layerLatencyMs(layer, view.latencyQuantile, view.timeframe)
      : view.timeframe === 'session'
        ? bucketLatencyField(m, view.latencyQuantile, view.timeframe)
        : m.dbQueryLatency > 0
          ? m.dbQueryLatency * 1000
          : 0
    const instanceSubtitle = layer
      ? `App SQL for ${layer.role === 'replica' ? 'replica' : 'primary'} layer ${layer.id}.`
      : 'App SQL on the hot path — what clients intended.'
    const dbQuerySource = parseDbQuerySource(m.dbQuerySource)
    const liveQueriesDisplay = layer
      ? `${fmtRate(qHead.liveRate)}/s`
      : formatDbQueriesPerSec(
          m.dbQueryRate,
          dbQuerySource,
          m.storageIo?.readRate ?? 0,
          m.requestRate > 0 || m.dbQueryRate > 0,
        )
    const queriesTileValue =
      view.timeframe === 'session'
        ? fmtInt(qHead.sessionTotal)
        : liveQueriesDisplay === 'No app queries' || liveQueriesDisplay === FMT_EMPTY
          ? '—'
          : liveQueriesDisplay.replace(/\/s$/, '')
    const queriesShowUnit =
      view.timeframe === 'live' &&
      queriesTileValue !== '—' &&
      liveQueriesDisplay.endsWith('/s')
    const deployReplication = normalizeReplicationModeForDeploy(
      replicationModeFromConfig(node.config.replicationMode),
      clampReadReplicas(node.config.readReplicas),
    )
    const commitWaitNote =
      layer?.role === 'replica'
        ? null
        : appLatencyCommitWaitNote(
            deployReplication,
            normalizeSyncCommitLevelForDeploy(
              syncCommitLevelFromConfig(node.config.syncCommitLevel),
              deployReplication,
            ),
          )
    return (
      <SlPaneSection>
        <SlSecHead
          index="01"
          title="How hard is the app hitting the database?"
          subtitle={instanceSubtitle}
        />
        <SlTiles triad>
          <SlTile>
            <SlTileLab>{qHead.label}</SlTileLab>
            <SlTileVal>
              {queriesTileValue}
              {queriesShowUnit ? <SlUnit>/s</SlUnit> : null}
            </SlTileVal>
          </SlTile>
          <SlTile>
            <SlTileLab>{view.timeframe === 'session' ? 'Errors' : 'Error rate'}</SlTileLab>
            <SlTileVal tone={errHot ? 'amber' : undefined}>
              {view.timeframe === 'session'
                ? fmtInt(m.totalErrors9m)
                : fmtErrorRate(m.errorRate)}
            </SlTileVal>
            {errHot ? (
              <SlTileFoot>
                <span className="flag amber" style={{ border: 'none', padding: 0 }}>ABOVE</span>
              </SlTileFoot>
            ) : null}
          </SlTile>
          <SlTile>
            <SlTileLab>
              {view.timeframe === 'session'
                ? `Latency ${view.latencyQuantile}`
                : 'Latency (p99)'}
            </SlTileLab>
            <SlTileVal>
              {latMs > 0 ? Math.round(latMs) : '—'}
              <SlUnit>ms</SlUnit>
            </SlTileVal>
          </SlTile>
        </SlTiles>
        <Note mark="?">SQL from app-server instrumentation only.</Note>
        {commitWaitNote ? <Note mark="i">{commitWaitNote}</Note> : null}
        <Note mark="i">{POD_RATE_DISCLAIMER}</Note>
        {view.showGraphs ? (
          <SlGraphWrap title="Query rate · last 10s" sub="app SQL" data={qSeries} height={58} />
        ) : null}
        <SlRow
          title="Connections"
          subtitle="open now · max_connections"
          value={fmtInt(m.dbActiveConnections)}
          unit={<SlUnit>/ {maxConn}</SlUnit>}
          flag={
            m.dbActiveConnections < maxConn * 0.9
              ? { text: 'HEALTHY', tone: 'green' }
              : { text: 'PRESSURE', tone: 'amber' }
          }
        />
        <Note mark="?">{DB_POSTGRES_CONNECTIONS_HELP}</Note>
        <SlHint direction="forward" onClick={() => onSelectMetricGroup?.('engine-work')}>
          This shows up as engine work →
        </SlHint>
      </SlPaneSection>
    )
  }

  if (metricGroup === 'engine-work') {
    const ioBucket =
      layer?.storageIo != null ? { ...m, storageIo: layer.storageIo } : m
    const engine = (ioBucket.storageEngine ?? 'postgresql').trim()
    const io = ioBucket.storageIo
    const readLabelRaw = io ? storageReadTileLabel(io, engine) : 'Rows scanned'
    const writeLabelRaw = io ? storageWriteTileLabel(io, engine) : 'Rows written'
    const readLabel = storageIoSessionLabel(readLabelRaw)
    const writeLabel = storageIoSessionLabel(writeLabelRaw)
    const ioTiles = storageIoThroughputFields(
      ioBucket,
      view.timeframe,
      readLabel,
      writeLabel,
      fmtRate,
    )
    const scannedLive = io?.readRate ?? 0
    const writtenLive = io?.writeRate ?? 0
    const readHistory = history.map((h) =>
      layer ? h.layers.find((l) => l.id === layer.id)?.storageIo?.readRate ?? 0 : h.storageIo?.readRate ?? 0,
    )
    const writeHistory = history.map((h) =>
      layer ? h.layers.find((l) => l.id === layer.id)?.storageIo?.writeRate ?? 0 : h.storageIo?.writeRate ?? 0,
    )
    const modelEstimate = fanoutScanModelEstimate(templateMetrics)
    const scopeRole = layer
      ? layer.role === 'replica'
        ? 'replica'
        : 'primary'
      : (m.storageRole ?? 'primary')
    const layerCpuPct =
      layer && layer.cpuLimit > 0
        ? Math.min(100, (layer.cpuUsage / layer.cpuLimit) * 100)
        : m.cpuPercent
    const layerMemPct =
      layer && layer.memoryLimit > 0
        ? Math.min(100, (layer.memoryBytes / layer.memoryLimit) * 100)
        : m.memPercent
    return (
      <SlPaneSection>
        <SlHint direction="back" onClick={() => onSelectMetricGroup?.('app-load')}>
          follows from <b>App Load</b>
        </SlHint>
        <SlSpacer />
        <SlSecHead
          index="02"
          title="How much work is Postgres doing?"
          subtitle={
            layer
              ? `Engine work on ${layer.role === 'replica' ? 'replica' : 'primary'} ${layer.id}.`
              : 'Engine work (all clients) — every session, not just the app.'
          }
        />
        <StacklabDbPatternBridge
          m={ioBucket}
          dbQueryRate={layer?.dbQueryRate ?? m.dbQueryRate}
          modelEstimate={modelEstimate}
        />
        <SlCounter
          label={ioTiles.readLabel}
          tag={view.timeframe === 'session' ? 'SESSION TOTAL' : 'ENGINE RATE'}
          value={
            view.timeframe === 'session'
              ? ioTiles.readValue
              : fmtRate(scannedLive)
          }
          unit={view.timeframe === 'session' ? '' : '/s'}
          bandData={view.timeframe === 'live' ? readHistory : undefined}
          bandUnit={view.timeframe === 'live' ? '/s' : undefined}
          cum={
            view.timeframe === 'session'
              ? 'engine read counter · session window'
              : io?.source?.trim() || 'postgres_exporter'
          }
        />
        <SlCounter
          label={ioTiles.writeLabel}
          tag={view.timeframe === 'session' ? 'SESSION TOTAL' : 'ENGINE RATE'}
          value={
            view.timeframe === 'session'
              ? ioTiles.writeValue
              : fmtRate(writtenLive)
          }
          unit={view.timeframe === 'session' ? '' : '/s'}
          bandData={view.timeframe === 'live' ? writeHistory : undefined}
          bandUnit={view.timeframe === 'live' ? '/s' : undefined}
          cum={view.timeframe === 'session' ? 'engine write counter · session window' : 'write path'}
        />
        <Note mark="i">
          {engineClientScopeNote(clampReadReplicas(node.config.readReplicas))}
        </Note>
        <StacklabDbEngineFootnotes io={io} role={scopeRole} />
        {io && io.bytesUsed > 0 ? (
          <SlRow
            title="Data size"
            subtitle="database footprint"
            value={fmtBytes(io.bytesUsed)}
          />
        ) : null}
        {io && io.errorRate > 0 ? (
          <SlRow
            title="Rollbacks"
            subtitle="transaction rollbacks"
            value={fmtRate(io.errorRate)}
            unit={<SlUnit>/s</SlUnit>}
          />
        ) : null}
        <SlSecHead index="03" title="Engine utilization" subtitle="CPU and memory handling database work." />
        <SlGauge
          label="CPU · engine"
          value={Math.round(layerCpuPct)}
          unit="%"
          pct={layerCpuPct}
          hot={isCpuUtilWarn(layerCpuPct)}
          footLeft={resourceWarnFootLabel(WARNING_CPU)}
          footRight="engine CPU"
        />
        <SlGauge
          label="Memory · container"
          value={Math.round(layerMemPct)}
          unit="%"
          pct={layerMemPct}
          hot={isMemUtilWarn(layerMemPct)}
          footLeft={resourceWarnFootLabel(WARNING_MEM)}
          footRight="vs limit"
        />
        <SlDisc
          id="db-fresh"
          title="What these percents actually measure"
          tag="FRESHNESS"
          open={freshOpen}
          onToggle={() => setFreshOpen((v) => !v)}
          body={
            <p>
              Delayed ~15–60s. Container usage comes from the Kubernetes Metrics API (same source
              as kubectl top). A request/limit figure is allocated, not measured. CPU and memory
              can also read high for about a minute after the database starts.
            </p>
          }
        />
      </SlPaneSection>
    )
  }

  if (metricGroup === 'replication') {
    return (
      <SlPaneSection>
        <StacklabDbReplicationBody m={m} node={node} />
      </SlPaneSection>
    )
  }

  if (metricGroup === 'tradeoffs') {
    const replicas = clampReadReplicas(node.config.readReplicas)
    const mode = normalizeReplicationModeForDeploy(
      replicationModeFromConfig(node.config.replicationMode),
      replicas,
    )
    const policy = readConsistencyFromConfig(node.config.readConsistency)
    const offloadsReads = replicas >= 1 && policy !== 'leader-only'
    const lagLayer = m.layers.find((l) => l.role === 'replica' && l.connectedOnPrimary !== false)
    const lag = lagLayer?.replicationLagSeconds
    return (
      <SlPaneSection>
        <SlSecHead
          index="05"
          title="What does this shape cost you?"
          subtitle={replicationModeMeaning(mode, policy)}
        />
        <SlTrade
          leftLabel={offloadsReads ? 'with replica reads' : 'primary reads'}
          leftValue={fmtRate(m.dbQueryRate)}
          leftUnit="/s"
          leftSub={
            offloadsReads ? 'reads can leave the primary' : 'reads stay on the primary'
          }
          rightLabel="cost"
          rightValue={lag != null && Number.isFinite(lag) ? lag.toFixed(1) : '—'}
          rightUnit="s"
          rightSub={
            offloadsReads
              ? 'replay lag on a standby'
              : mode === 'async'
                ? 'no standby durability on commit'
                : 'commit waits on a standby'
          }
          note={
            <>
              <b>Tradeoff:</b>{' '}
              {offloadsReads
                ? 'Moving reads to a standby buys primary headroom and pays in replay lag.'
                : mode === 'async'
                  ? 'Async acks the write on the primary before a standby has it.'
                  : 'Synchronous commit holds the write until a standby confirms it.'}
            </>
          }
        />
        <p className="note amber">
          <b>!</b>Fanout templates amplify: one app query can become <em>hundreds</em> of engine rows
          scanned.
        </p>
      </SlPaneSection>
    )
  }

  return null
}

function CachePane({
  node,
  m,
  history,
  view,
  metricGroup,
}: StacklabInspectorPaneProps) {
  const [noCacheOpen, setNoCacheOpen] = useState(false)
  const [wbOpen, setWbOpen] = useState(false)
  const [keyLifeOpen, setKeyLifeOpen] = useState(false)
  const strategy =
    (m.cacheStrategy ?? '').trim() || String(node.config.cacheStrategy ?? 'cache-aside')
  const hitPct = cacheHitRatePct(m, view.timeframe)
  const hits = view.timeframe === 'session' ? m.cacheHitsLast9m : m.cacheHits
  const misses = view.timeframe === 'session' ? m.cacheMissesLast9m : m.cacheMisses
  const hitSeries = historySeries(history, 'cacheHits')
  const missSeries = historySeries(history, 'cacheMisses')
  const memPct = m.memoryLimit > 0 ? (m.memoryBytes / m.memoryLimit) * 100 : m.memPercent
  const evictionPolicy = String(node.config.evictionPolicy ?? 'lru').replace('allkeys-', '')
  const storeLayer = m.layers.find(
    (layer) => layer.id === 'redis-internal' || layer.role === 'backing-store',
  )
  const proxyLayer = m.layers.find(
    (layer) => layer.id === 'cache-proxy' || layer.role === 'sidecar',
  )
  const storeCpu =
    storeLayer && storeLayer.cpuLimit > 0
      ? (storeLayer.cpuUsage / storeLayer.cpuLimit) * 100
      : m.cpuPercent
  const storeMem =
    storeLayer && storeLayer.memoryLimit > 0
      ? (storeLayer.memoryBytes / storeLayer.memoryLimit) * 100
      : memPct
  const proxyCpu =
    proxyLayer && proxyLayer.cpuLimit > 0
      ? (proxyLayer.cpuUsage / proxyLayer.cpuLimit) * 100
      : m.cpuPercent
  const proxyMem =
    proxyLayer && proxyLayer.memoryLimit > 0
      ? (proxyLayer.memoryBytes / proxyLayer.memoryLimit) * 100
      : memPct

  if (metricGroup === 'hit-rate') {
    const isTimelineStore = strategy === 'timeline-store'
    const hitTone = hitPct != null && hitPct >= 80 ? 'green' : hitPct != null && hitPct < 50 ? 'amber' : undefined
    const feedPushRate = m.feedRequestRatePush ?? 0
    return (
      <SlPaneSection>
        <SlSecHead
          index="01"
          title="Did caching actually help?"
          subtitle={
            isTimelineStore
              ? 'When fanout timelines had posts vs empty (push reads never fall back to Postgres).'
              : 'How often the app avoided a database round trip.'
          }
        />
        <SlTiles>
          <SlTile>
            <SlTileLab>
              {view.timeframe === 'session' ? 'Hit rate · session' : 'Hit rate · 10s'}
            </SlTileLab>
            <SlTileVal tone={hitTone}>
              {hitPct != null ? Math.round(hitPct) : '—'}
              <SlUnit>%</SlUnit>
            </SlTileVal>
            <SlTileFoot>
              <span className="flag green" style={{ border: 'none', padding: 0 }}>live window</span>
            </SlTileFoot>
          </SlTile>
          <SlTile>
            <SlTileLab>Hits · misses</SlTileLab>
            <SlTileVal>
              {fmtInt(hits)}
              {view.timeframe === 'live' ? <SlUnit>/s</SlUnit> : null}
              <span className="sep-sm">·</span>
              <span className="mu">{fmtInt(misses)}</span>
              {view.timeframe === 'live' ? <SlUnit>/s</SlUnit> : null}
            </SlTileVal>
            <SlTileFoot
              left="logical · app side"
              right={view.timeframe === 'session' ? 'session totals' : '10s window'}
            />
          </SlTile>
        </SlTiles>
        {isTimelineStore ? (
          <SlTiles>
            <SlTile>
              <SlTileLab>Feed reads · push</SlTileLab>
              <SlTileVal>
                {feedPushRate > 0 ? fmtRate(feedPushRate) : '—'}
                <SlUnit>/s</SlUnit>
              </SlTileVal>
              <SlTileFoot left="social_feed_request_total" right="10s window" />
            </SlTile>
            <SlTile>
              <SlTileLab>Feed reads · pull</SlTileLab>
              <SlTileVal>
                {(m.feedRequestRatePull ?? 0) > 0 ? fmtRate(m.feedRequestRatePull ?? 0) : '—'}
                <SlUnit>/s</SlUnit>
              </SlTileVal>
              <SlTileFoot left="no cache node" right="10s window" />
            </SlTile>
          </SlTiles>
        ) : null}
        <Note mark="?">
          {isTimelineStore
            ? 'Hit = timeline returned posts. Miss = empty timeline; still no Postgres on push reads.'
            : 'App logical hits and misses, not Redis GET/SET command counters.'}
        </Note>
        {view.timeframe === 'session' ? <Note mark="↔">{SESSION_CACHE_TOTALS_HINT}</Note> : null}
        {!isTimelineStore &&
        shouldShowKeyspaceDriftHint(
          hits,
          misses,
          m.redisKeyspaceHits ?? 0,
          m.redisKeyspaceMisses ?? 0,
        ) ? (
          <p className="note amber">
            <b>!</b>App hit rate and keyspace counters differ by more than 10%. Check pod
            aggregation scope.
          </p>
        ) : null}
        {view.showGraphs ? (
          <SlGraphWrap
            title="Hits vs misses · 10s"
            data={hitSeries}
            secondary={missSeries}
            primaryLabel="hits"
            secondaryLabel="misses"
            height={54}
          />
        ) : null}
        <SlStatStrip>
          <SlStatCell
            label="evictions"
            value={
              view.timeframe === 'session'
                ? fmtInt(m.evictionsLast9m ?? 0)
                : fmtRate(m.evictionsPerSec ?? 0)
            }
            unit={view.timeframe === 'session' ? 'total' : '/s · 10s'}
          />
          <SlStatCell
            label={isTimelineStore ? 'timelines' : 'keyspace hits'}
            value={
              isTimelineStore
                ? fmtInt(m.timelineKeyCount ?? 0)
                : fmtRate(m.redisKeyspaceHits ?? 0)
            }
            unit={isTimelineStore ? undefined : '/s · 10s'}
            help={
              isTimelineStore ? CACHE_TIMELINES_COUNT_HELP : CACHE_KEYSPACE_HITS_HELP
            }
          />
          <SlStatCell label="policy" value={evictionPolicy} />
          <SlStatCell label="engine" value={m.storageEngine || 'redis'} />
        </SlStatStrip>
        <SlDisc
          id="nocache"
          title="What happens if you remove the cache node"
          tag="TRADEOFF"
          open={noCacheOpen}
          onToggle={() => setNoCacheOpen((v) => !v)}
          body={
            isTimelineStore ? (
              <p>
                Remove the cache and feed reads use Postgres pull mode instead of Redis
                timelines — fanout materialization no longer applies on the read path.
              </p>
            ) : (
              <p>
                Remove the cache and <em>{fmtRate(hits)}/s</em> of hit traffic becomes Postgres
                queries — higher load on the database under the same app traffic.
              </p>
            )
          }
        />
      </SlPaneSection>
    )
  }

  if (metricGroup === 'engine') {
    const cmdLive = m.redisOpsPerSec ?? m.requestRate
    const cmdSession =
      (m.storageIo?.readTotal9m ?? 0) + (m.storageIo?.writeTotal9m ?? 0)
    return (
      <SlPaneSection>
        <SlSecHead
          index="04"
          title="What is Redis doing with the keys?"
          subtitle="Command mix and memory pressure at the cache node."
        />
        <SlTiles>
          <SlTile>
            <SlTileLab>
              {view.timeframe === 'session' ? 'Total commands' : 'Commands'}
            </SlTileLab>
            <SlTileVal>
              {view.timeframe === 'session' && cmdSession > 0
                ? fmtInt(cmdSession)
                : fmtRate(cmdLive)}
              {view.timeframe === 'live' ? <SlUnit>/s</SlUnit> : null}
            </SlTileVal>
            <div className="tile-split">
              <span>
                <b>hits</b>{' '}
                <s>
                  {view.timeframe === 'session' ? fmtInt(hits) : fmtRate(hits)}
                </s>
              </span>
              <span>
                <b>miss</b>{' '}
                <s>
                  {view.timeframe === 'session' ? fmtInt(misses) : fmtRate(misses)}
                </s>
              </span>
            </div>
          </SlTile>
          <SlTile>
            <SlTileLab>Memory used</SlTileLab>
            <SlTileVal>
              {(storeLayer?.memoryLimit ?? m.memoryLimit) > 0
                ? Math.round((storeLayer?.memoryBytes ?? m.memoryBytes) / (1024 * 1024))
                : '—'}
              <SlUnit>MiB</SlUnit>
            </SlTileVal>
            <SlBarInline pct={storeMem} hot={isMemUtilWarn(storeMem)} />
            <SlTileFoot
              left={`of ${(storeLayer?.memoryLimit ?? m.memoryLimit) > 0 ? Math.round((storeLayer?.memoryLimit ?? m.memoryLimit) / (1024 * 1024)) : '—'} MiB`}
              right={`${Math.round(storeMem)}% used`}
            />
          </SlTile>
        </SlTiles>
        <Note mark="?">
          Memory shows Redis used memory compared with maxmemory, not the raw size of stored
          values.
        </Note>
        <SlStatStrip>
          <SlStatCell label="cpu" value={Math.round(storeCpu)} unit="%" />
          <SlStatCell
            label="p99 · 9m"
            value={m.p99Latency9m > 0 ? Math.round(m.p99Latency9m) : Math.round(m.p99Latency)}
            unit="ms"
          />
          <SlStatCell label="rejects" value={fmtInt(m.redisRejectedRate ?? 0)} />
          {(m.redisConnectedClients ?? 0) > 0 ? (
            <SlStatCell label="clients" value={fmtInt(m.redisConnectedClients)} />
          ) : null}
        </SlStatStrip>
        <Note mark="i">
          Rejects are connections refused by the engine (e.g. at maxclients). Command counters are
          engine-side; the Hit Rate tab counts app-side logical hits and misses.
        </Note>
        <SlDisc
          id="key-life"
          title="Evictions and expirations"
          open={keyLifeOpen}
          onToggle={() => setKeyLifeOpen((v) => !v)}
          body={
            <p>
              Evictions are keys Redis removed to make room after reaching its memory limit.
              Expirations are keys the store removed because their TTL ended. {SESSION_STORAGE_ENGINE_HINT}
            </p>
          }
        />
      </SlPaneSection>
    )
  }

  if (metricGroup === 'proxy') {
    return (
      <SlPaneSection>
        <SlIdentLine>
          svc·cache-proxy <span className="sep">/</span> sync: async <span className="sep">/</span>{' '}
          {strategy}
        </SlIdentLine>
        <SlSecHead
          index="05"
          title="Is the flush keeping up?"
          subtitle="Async durability lag between cache and database."
        />
        <SlTiles>
          <SlTile>
            <SlTileLab>Proxy CPU utilization</SlTileLab>
            <SlTileVal tone={isCpuUtilWarn(proxyCpu) ? 'amber' : undefined}>
              {Math.round(proxyCpu)}
              <SlUnit>%</SlUnit>
            </SlTileVal>
            <SlBarInline pct={proxyCpu} cells={18} hot={isCpuUtilWarn(proxyCpu)} />
          </SlTile>
          <SlTile>
            <SlTileLab>Proxy memory utilization</SlTileLab>
            <SlTileVal tone={isMemUtilWarn(proxyMem) ? 'amber' : undefined}>
              {Math.round(proxyMem)}
              <SlUnit>%</SlUnit>
            </SlTileVal>
            <SlBarInline pct={proxyMem} cells={18} hot={isMemUtilWarn(proxyMem)} />
          </SlTile>
        </SlTiles>
        <Note mark="?">Time from cache acknowledgment to durable database write.</Note>
        <SlDisc
          id="wb-loss"
          title="Why write-behind can lose data"
          tag="TRADEOFF"
          open={wbOpen}
          onToggle={() => setWbOpen((v) => !v)}
          body={
            <p>
              The cache acks the write before it reaches the database. If the proxy crashes before
              flushing, that write is gone.
            </p>
          }
        />
      </SlPaneSection>
    )
  }

  return null
}

function MqPane({
  m,
  history,
  view,
  metricGroup,
  onSelectMetricGroup,
  onOpenDataTab,
}: StacklabInspectorPaneProps) {
  const [whyOpen, setWhyOpen] = useState(false)
  const depth = m.queueDepth
  const pub = m.produceRate
  const con = m.consumeRate
  const net = pub - con
  const growing = net > 0
  const hasMqMem = m.mqMemoryLimit > 0
  const memPct = hasMqMem
    ? (m.mqMemoryUsed / m.mqMemoryLimit) * 100
    : m.memoryLimit > 0
      ? (m.memoryBytes / m.memoryLimit) * 100
      : 0
  const pubSeries = historySeries(history, 'produceRate')
  const conSeries = historySeries(history, 'consumeRate')
  const cpuSeries = historySeries(history, 'cpuPercent')
  const depthTrend =
    history.length >= 2
      ? depth - Number(history[Math.max(0, history.length - 2)]?.queueDepth ?? depth)
      : 0
  const spreadEta = growing && net > 0 ? Math.round(depth / net) : null
  const cpuHot = isCpuUtilWarn(m.cpuPercent)
  const memHot = isMemUtilWarn(memPct)
  const bandSeries = conSeries.map((v) => clampBand(v / Math.max(con, 1)))
  const podStatus = brokerPodStatusLine(m)
  const showCpuUtil = m.cpuLimit > 0 || m.cpuPercent > 0
  const showMemUtil = hasMqMem || m.memoryLimit > 0
  const backlogSubtitle = podStatus
    ? 'Queue depth, drain estimate, and broker pod health.'
    : 'Queue depth and drain estimate.'

  if (metricGroup === 'backlog') {
    return (
      <SlPaneSection>
        <SlHint direction="back" onClick={() => onSelectMetricGroup?.('flow')}>
          <b>Flow</b> is falling behind
        </SlHint>
        <SlSpacer />
        <SlSecHead
          index="01"
          title="How deep is the backlog?"
          subtitle={backlogSubtitle}
        />
        <SlTiles>
          <SlTile>
            <SlTileLab>Queue depth</SlTileLab>
            <SlTileVal tone={growing ? 'amber' : 'green'}>
              {fmtInt(depth)}
              <SlUnit>msgs</SlUnit>
            </SlTileVal>
            <SlTileFoot
              left={
                <span
                  className={`flag ${growing ? 'amber' : 'green'}`}
                  style={{ border: 'none', padding: 0 }}
                >
                  {growing ? 'GROWING' : 'DRAINING'}
                </span>
              }
              right={
                depthTrend !== 0
                  ? `${depthTrend >= 0 ? '↑ +' : '↓ '}${fmtInt(Math.abs(Math.round(depthTrend)))} / 10 s`
                  : undefined
              }
            />
          </SlTile>
          <SlTile>
            <SlTileLab>Drain estimate</SlTileLab>
            <div className="tile-v num sm" style={{ marginTop: 10 }}>
              {spreadEta != null ? `~${spreadEta} s` : 'draining'}
            </div>
            <SlTileFoot
              left="at current spread"
              right={growing ? `net +${fmtInt(Math.round(net))} /s` : 'net 0'}
            />
          </SlTile>
        </SlTiles>
        {podStatus ? (
          <SlPodStatus ready={podStatus.ready} bad={podStatus.bad} warn={podStatus.warn} />
        ) : null}
        {growing ? (
          <SlDisc
            id="why"
            title="Why backlog is growing"
            tag="AMBER"
            open={whyOpen}
            onToggle={() => setWhyOpen((v) => !v)}
            body={
              <p>
                Consume rate (<em>{fmtRate(con)}/s</em>) is lower than Publish rate (
                <em>{fmtRate(pub)}/s</em>). Consider scaling up Worker replicas to drain the queue
                faster before memory limits are breached.
              </p>
            }
          />
        ) : null}
        <p className="note amber">
          <b>!</b>
          {spreadEta != null
            ? `at this spread the queue drains in ~${spreadEta} s`
            : 'consume ≥ publish · queue is draining'}
        </p>
        <SlHint direction="forward" onClick={onOpenDataTab}>
          Message bodies: <b>Data tab → Peek</b> (requeues the head message)
        </SlHint>
      </SlPaneSection>
    )
  }

  if (metricGroup === 'flow') {
    return (
      <SlPaneSection>
        <SlSecHead
          index="02"
          title="Is work moving through?"
          subtitle="Publish vs consume, measured at the broker."
        />
        <SlTiles>
          <SlTile>
            <SlTileLab>Publish</SlTileLab>
            <SlTileVal>
              {fmtRate(pub)}
              <SlUnit>/s</SlUnit>
            </SlTileVal>
          </SlTile>
          <SlTile>
            <SlTileLab>Consume</SlTileLab>
            <SlTileVal>
              {fmtRate(con)}
              <SlUnit>/s</SlUnit>
            </SlTileVal>
          </SlTile>
        </SlTiles>
        {view.showGraphs ? (
          <SlGraphWrap
            title="Publish vs consume · 10s"
            data={pubSeries}
            secondary={conSeries}
            primaryLabel="publish"
            secondaryLabel="consume"
            height={58}
          />
        ) : null}
        <SlRow
          title="Net accumulation"
          subtitle="publish − consume"
          value={`${fmtRate(pub)} − ${fmtRate(con)}`}
          flag={net > 0 ? { text: 'POSITIVE', tone: 'amber' } : { text: 'STABLE', tone: 'green' }}
          valueTone={net > 0 ? 'amber' : undefined}
        />
        <Note mark="i">A positive net here is exactly what fills the backlog — see the amber tab.</Note>
        <SlHint direction="forward" onClick={() => onSelectMetricGroup?.('backlog')}>
          Backlog is the consequence →
        </SlHint>
      </SlPaneSection>
    )
  }

  if (metricGroup === 'engine') {
    const queueCum =
      m.messagesReady > 0 || m.messagesUnacked > 0
        ? `ready ${fmtInt(m.messagesReady)} · unacked ${fmtInt(m.messagesUnacked)}`
        : undefined
    return (
      <SlPaneSection>
        <SlSecHead
          index="03"
          title="What is the broker spending on this queue?"
          subtitle="Engine utilization and queue delivery state."
        />
        {showCpuUtil ? (
          <SlUtil hot={cpuHot}>
            <SlUtilTop
              label="CPU utilization"
              value={Math.round(m.cpuPercent)}
              unit="%"
              tone={cpuHot ? 'amber' : undefined}
            />
            <SlScale
              pct={m.cpuPercent}
              warnAt={WARNING_CPU}
              footLeft="vs pod limit · sustained high means pressure"
              footRight="0 · 50 · 100%"
            />
            <SlUtilHelp>{utilHelpCpu(m)}</SlUtilHelp>
            {view.showGraphs ? (
              <SlGraphWrap title="CPU · last 10s" sub="mean / peak" data={cpuSeries} height={52} />
            ) : null}
          </SlUtil>
        ) : null}
        {showMemUtil ? (
          <SlUtil hot={memHot}>
            <SlUtilTop
              label="Memory utilization"
              value={Math.round(memPct)}
              unit="%"
              tone={memHot ? 'amber' : undefined}
            />
            <SlScale
              pct={memPct}
              warnAt={WARNING_MEM}
              footLeft="watch for paging before OOM risk"
              footRight="0 · 50 · 100%"
            />
            <SlUtilHelp>
              {hasMqMem
                ? `limit ${fmtMemMB(m.mqMemoryLimit)} · used ${fmtMemMB(m.mqMemoryUsed)}`
                : `limit ${fmtMemMB(m.memoryLimit)} · used ${fmtMemMB(m.memoryBytes)}`}
            </SlUtilHelp>
          </SlUtil>
        ) : null}
        <SlCounter
          label="Consume rate"
          tag="WORKER COUNTER"
          value={fmtRate(con)}
          unit="/s"
          bandData={bandSeries}
          bandUnit="/s"
          cum={queueCum}
        />
      </SlPaneSection>
    )
  }

  return null
}

function clampBand(v: number): number {
  return Math.max(0.12, Math.min(1, v))
}

function WorkerPane({
  m,
  history,
  view,
  metricGroup,
  selectedInstanceId,
  onPanelViewChange,
  onSelectPod,
  onSelectMetricGroup,
  showLatencyControls,
}: StacklabInspectorPaneProps) {
  const [slowOpen, setSlowOpen] = useState(false)
  const bucket = effectiveRedBucket(m, selectedInstanceId)
  const processRate = bucket.requestRate
  const dist = latencyTriple(bucket, view.timeframe, bucket.p99Latency)
  const procSeries = historySeries(history, 'requestRate')
  const cpuSeries = historySeries(history, 'cpuPercent')

  if (metricGroup === 'health') {
    return (
      <SlPaneSection>
        <SlRedHealthPane
          index="01"
          title="Is background processing falling behind?"
          subtitle="Logical job execution speed and health."
          rateLabel={view.timeframe === 'session' ? 'Total jobs' : 'Process rate'}
          rateValue={view.timeframe === 'session' ? fmtInt(bucket.totalRequests) : fmtRate(processRate)}
          rateUnit={view.timeframe === 'session' ? '' : '/s'}
          rateSpark={procSeries}
          ratePeak={procSeries.length ? Math.max(...procSeries) : processRate}
          latencyMs={selectedLatencyMs(bucket, view.timeframe, view.latencyQuantile)}
          quantile={view.latencyQuantile}
          timeframe={view.timeframe}
          sessionAvailable={(q) => bucketSessionQuantileAvailable(bucket, q)}
          onQuantileChange={
            showLatencyControls
              ? (q) => onPanelViewChange?.({ latencyQuantile: q })
              : undefined
          }
          distP50={dist.p50}
          distP95={dist.p95}
          distP99={dist.p99}
          showGraphs={view.showGraphs}
          sampleLabel={view.timeframe === 'session' ? 'session window' : 'last 10s'}
          errorDisplay={fmtErrorRate(bucket.errorRate)}
          hintForward={<>This shows up in <b>Internals</b></>}
          onHintForwardClick={() => onSelectMetricGroup?.('internals')}
        />
        <Note mark="?">
          Jobs consumed from the message queue (worker processed counter), not HTTP request
          throughput.
        </Note>
      </SlPaneSection>
    )
  }

  if (metricGroup === 'internals') {
    const cpuHot = isCpuUtilWarn(bucket.cpuPercent)
    const memHot = isMemUtilWarn(bucket.memPercent)
    return (
      <SlPaneSection>
        <SlSecHead index="02" title="CPU and Mem usage" />
        <SlUtil hot={cpuHot}>
          <SlUtilTop
            label="CPU utilization"
            value={Math.round(bucket.cpuPercent)}
            unit="%"
            tone={cpuHot ? 'amber' : undefined}
          />
          <SlScale
            pct={bucket.cpuPercent}
            warnAt={WARNING_CPU}
            footLeft="vs pod limit · near saturated"
            footRight="0 · 50 · 100%"
          />
          <SlUtilHelp>
            limit {m.cpuLimit > 0 ? `${m.cpuLimit} vCPU` : 'n/a'} · sustained high — process rate is
            CPU-bound
          </SlUtilHelp>
          {view.showGraphs ? (
            <SlGraphWrap title="CPU · last 10s" sub="mean / peak" data={cpuSeries} />
          ) : null}
        </SlUtil>
        <SlGauge
          label="Memory · pod limit"
          value={Math.round(bucket.memPercent)}
          unit="%"
          pct={bucket.memPercent}
          hot={memHot}
          footLeft={utilHelpMem(m)}
          footRight={resourceWarnFootLabel(WARNING_MEM)}
        />
        <SlRow
          title="Queue depth"
          subtitle="messages waiting in queue"
          value={fmtInt(m.queueDepth)}
          unit={<SlUnit>msgs</SlUnit>}
          flag={m.queueDepth > 0 ? { text: 'GROWING', tone: 'amber' } : { text: 'STABLE', tone: 'green' }}
        />
        <SlDisc
          id="slow"
          title="Why processing is slow"
          tag="AMBER"
          open={slowOpen}
          onToggle={() => setSlowOpen((v) => !v)}
          body={
            <p>
              Workers are heavily saturating CPU (<em>{Math.round(bucket.cpuPercent)}%</em>), capping
              the process rate at <em>{fmtRate(processRate)}/s</em>. Scale up worker replicas to
              process the message queue backlog in parallel.
            </p>
          }
        />
        <SlHint direction="forward" onClick={() => onSelectMetricGroup?.('replicas')}>
          Which replica is hot? <b>Replicas</b>
        </SlHint>
      </SlPaneSection>
    )
  }

  if (metricGroup === 'replicas') {
    const rows = podTableRows(m, view.timeframe, view.latencyQuantile, selectedInstanceId, onSelectPod)
    const status = podStatusLine(m)
    return (
      <SlPaneSection>
        <SlSecHead
          index="03"
          title="Which replica is carrying the load?"
          subtitle="Per-pod share, readiness, and restarts."
        />
        {status ? <SlPodStatus ready={status.ready} warn={status.warn} bad={status.bad} /> : null}
        <SlPodTable
          columns={[
            'pod',
            inspectorThroughputColumnLabel(view.timeframe, 'jobs/s'),
            view.latencyQuantile,
            'cpu',
            'mem',
          ]}
          rows={rows}
        />
        <Note mark="i">
          {rows.length <= 1
            ? 'Single replica — no failover capacity. A kill or eviction drains nothing until it restarts.'
            : 'Click a pod to spotlight it in Instance scope.'}
        </Note>
      </SlPaneSection>
    )
  }

  return null
}

function LoadBalancerPane({
  node,
  m,
  history,
  nodes,
  edges,
  view,
  metricGroup,
  onSelectMetricGroup,
}: StacklabInspectorPaneProps) {
  const [skewOpen, setSkewOpen] = useState(false)
  const allMetrics = useMetricsStore((s) => s.metrics)
  const algo = lbAlgorithmForDeploy(node.config.algorithm ?? node.config.lbAlgorithm)
  const skewNote = lbSkewExplanation(algo)
  const connectedBackends = useMemo(
    () => lbConnectedComputeNodes(node.id, edges, nodes),
    [node.id, edges, nodes],
  )
  const backendPods = lbInspectorBackendPods(m)
  const backendCount = lbBackendCount(
    backendPods.length,
    Object.keys(m.perBackendRps).length,
    connectedBackends.length,
    m.lbBackends.length,
  )
  const rpsSeries = historySeries(history, 'requestRate')
  const cpuSeries = historySeries(history, 'cpuPercent')
  const skewSplit = lbBackendSkewLabel(backendPods, view.timeframe)
  const allBackendsHealthy =
    backendPods.length > 0 && backendPods.every((pod) => pod.ready)
  const backendLimits = lbBackendResourceLimits(node.id, edges, nodes, allMetrics)

  if (metricGroup === 'routing') {
    return (
      <SlPaneSection>
        <SlIdentLine>
          algo·{algo} <span className="sep">/</span> backends {backendCount}{' '}
          <span className="sep">/</span> keep-alive 60 s
        </SlIdentLine>
        <SlSecHead
          index="01"
          title="Request throughput"
          tip="How much traffic is the load balancer routing?"
        />
        <SlTiles>
          <SlTile>
            <SlTileLab>
              {view.timeframe === 'session' ? 'Total requests routed' : 'Requests routed'}
            </SlTileLab>
            <SlTileVal>
              {view.timeframe === 'session'
                ? fmtInt(m.totalRequests)
                : fmtInt(m.requestRate)}
              {view.timeframe === 'live' ? <SlUnit>rps</SlUnit> : null}
            </SlTileVal>
            {view.showGraphs ? <StacklabSparkline data={rpsSeries} /> : null}
            {view.showGraphs ? (
              <SlTileFoot
                graph
                left="window 10s"
                right={`peak ${fmtRate(Math.max(...rpsSeries, m.requestRate))}`}
              />
            ) : null}
          </SlTile>
          <SlTile>
            <SlTileLab>Connections</SlTileLab>
            <SlTileVal>
              {fmtInt(m.activeConnections)}
              <SlUnit>/{m.lbConnectionLimit > 0 ? m.lbConnectionLimit : 1024}</SlUnit>
            </SlTileVal>
            <SlTileFoot left="active · client side" />
          </SlTile>
        </SlTiles>
        <Note mark="?">
          RPS/QPS may be slightly off because Prometheus queries run against individual pods.
        </Note>
        <SlRow
          title="Upstream backends"
          subtitle="healthy backends receiving traffic"
          value={fmtInt(backendCount)}
          flag={{
            text: allBackendsHealthy ? 'HEALTHY' : 'DEGRADED',
            tone: allBackendsHealthy ? 'green' : 'amber',
          }}
        />
        <SlHint direction="forward" onClick={() => onSelectMetricGroup?.('backends')}>
          See per-backend split →
        </SlHint>
      </SlPaneSection>
    )
  }

  if (metricGroup === 'backends') {
    const beRows = lbBackendTableRows(
      m,
      backendLimits,
      view.timeframe,
      view.latencyQuantile,
    )
    const skewBody = (
      <p>
        {skewSplit ? (
          <>
            Observed split is <em>{skewSplit}</em>.{' '}
          </>
        ) : null}
        {skewNote}
      </p>
    )
    return (
      <SlPaneSection>
        <SlHint direction="back" onClick={() => onSelectMetricGroup?.('routing')}>
          follows from <b>Routing</b>
        </SlHint>
        <SlSpacer />
        <SlSecHead
          index="02"
          title="How is traffic split across backends?"
          subtitle={`Per-backend share and health. Algorithm: ${algo}.`}
        />
        <SlBeList
          rows={beRows}
          throughputCol={inspectorThroughputColumnLabel(view.timeframe, 'rps')}
          latencyCol={view.latencyQuantile}
        />
        <SlDisc
          id="lbdist"
          title="Why distribution could be uneven"
          tag="AMBER"
          open={skewOpen}
          onToggle={() => setSkewOpen((v) => !v)}
          body={skewBody}
        />
        <Note mark="i">{skewNote}</Note>
      </SlPaneSection>
    )
  }

  if (metricGroup === 'internals') {
    return (
      <SlPaneSection>
        <SlHint direction="back" onClick={() => onSelectMetricGroup?.('routing')}>
          follows from <b>Routing</b>
        </SlHint>
        <SlSpacer />
        <SlSecHead index="03" title="CPU and Mem usage" />
        <SlUtil hot={isCpuUtilWarn(m.cpuPercent)}>
          <SlUtilTop
            label="CPU utilization"
            value={Math.round(m.cpuPercent)}
            unit="%"
            tone={isCpuUtilWarn(m.cpuPercent) ? 'amber' : undefined}
          />
          <SlScale
            pct={m.cpuPercent}
            warnAt={WARNING_CPU}
            footLeft="vs pod limit · comfortable headroom"
            footRight="0 · 50 · 100%"
          />
          <SlUtilHelp>{utilHelpCpu(m)}</SlUtilHelp>
          {view.showGraphs ? (
            <SlGraphWrap title="CPU · last 10s" sub="mean / peak" data={cpuSeries} />
          ) : null}
        </SlUtil>
        <SlUtil hot={isMemUtilWarn(m.memPercent)}>
          <SlUtilTop
            label="Memory utilization"
            value={Math.round(m.memPercent)}
            unit="%"
            tone={isMemUtilWarn(m.memPercent) ? 'amber' : undefined}
          />
          <SlScale
            pct={m.memPercent}
            warnAt={WARNING_MEM}
            footLeft="well below warn threshold"
            footRight="0 · 50 · 100%"
          />
          <SlUtilHelp>{utilHelpMem(m)}</SlUtilHelp>
        </SlUtil>
      </SlPaneSection>
    )
  }

  return null
}
