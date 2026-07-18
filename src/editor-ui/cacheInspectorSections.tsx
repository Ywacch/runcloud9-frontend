import type { ComponentLayerMetrics } from '../editor-core/domain/metricsUiContract'
import { layerResourcePercents } from '../editor-core/domain/metricsUiContract'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import {
  cacheLayerCardTitle,
  cacheStrategyBanner,
  displayPodChip,
  isBackingCacheLayer,
  isLayeredCache,
  podsForComponent,
  podsForLayer,
  summarizePodHealth,
  type CacheInspectorMode,
} from '../lib/cacheLayerDisplay'
import {
  cacheHeadlines,
  cacheHitRateDisplay,
  feedPushHeadline,
  storageIoThroughputFields,
  type CacheHeadlineFields,
} from '../lib/metricTimeframe'
import { fmtBytes, fmtInt, fmtRate } from '../lib/format'
import {
  storageReadTileLabel,
  storageWriteTileLabel,
} from '../lib/storageIoDisplay'
import { InspectorDisclosure } from './InspectorDisclosure'
import {
  formatResourceLabels,
  memoryUsageHelp,
  PedagogicalCaption,
  PedagogicalHint,
  PedagogicalSection,
  resourceUsageHelp,
  StatBlock,
  StatRow,
  type PanelViewState,
} from './inspectorPanelUi'

export function CacheStrategyBanner({ strategy }: { strategy: string }) {
  const banner = cacheStrategyBanner(strategy)
  return (
    <section className="space-y-1 border-b border-gray-800/80 pb-4">
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-300">
        {banner.title}
      </h3>
      <p className="text-[10px] leading-snug text-gray-500">{banner.subtitle}</p>
    </section>
  )
}

export function CacheStrategyPerformanceSection({
  cacheHead,
  hasTraffic,
  cacheRateHelp,
}: {
  cacheHead: CacheHeadlineFields
  hasTraffic: boolean
  cacheRateHelp: string
}) {
  const hitRateLabel = cacheHitRateDisplay(cacheHead.hitRatePct)
  return (
    <PedagogicalSection
      title="Strategy performance"
      subtitle="How often the app avoided a database round trip"
    >
      <StatRow
        left={
          <StatBlock
            label={cacheHead.hitRateLabel}
            value={hasTraffic ? hitRateLabel : 'No traffic yet'}
            graph={
              hasTraffic ? undefined : (
                <p className="text-[10px] leading-snug text-gray-500">
                  Start load from the app server to see hit rate.
                </p>
              )
            }
          />
        }
        right={
          <StatBlock
            label={cacheHead.throughputLabel}
            value={hasTraffic ? cacheHead.throughputDisplay : 'Waiting for traffic…'}
            help={hasTraffic ? cacheRateHelp : undefined}
          />
        }
      />
      <p className="rounded border border-gray-800/80 bg-gray-950/40 px-2.5 py-2 text-[10px] leading-snug text-gray-500">
        App logical hits and misses — not Redis GET/SET command counters.
      </p>
    </PedagogicalSection>
  )
}

export function CacheTimelinePerformanceSection({
  m,
  view,
  tmFeedPushRate,
  cacheRateHelp,
  requestRate,
}: {
  m: MetricsBucket
  view: PanelViewState
  tmFeedPushRate?: number
  cacheRateHelp: string
  requestRate: number
}) {
  const pushRate = Number.isFinite(tmFeedPushRate) ? (tmFeedPushRate as number) : 0
  const feedHead = feedPushHeadline(m, view.timeframe, pushRate, fmtRate)
  const hasTraffic = feedHead.display !== '—' && feedHead.display !== '0/s'
  return (
    <PedagogicalSection title="Feed delivery" subtitle="Push-model timeline reads">
      <StatRow
        left={
          <StatBlock
            label={feedHead.label}
            value={hasTraffic ? feedHead.display : 'No traffic yet'}
            help={view.timeframe === 'live' ? cacheRateHelp : undefined}
          />
        }
        right={
          <StatBlock
            label="Request rate"
            value={requestRate > 0 ? `${fmtRate(requestRate)}/s` : 'Waiting for traffic…'}
          />
        }
      />
      <PedagogicalCaption>
        Feed push rate tracks timeline delivery; engine commands below use wire labels
        (e.g. ZREVRANGE).
      </PedagogicalCaption>
    </PedagogicalSection>
  )
}

const REDIS_MEMORY_HELP =
  'Memory shows Redis used memory compared with maxmemory, not the raw size of stored values.'

/** Redis-backed cards: explain what the memory number actually measures. */
function cacheMemoryHelp(m: MetricsBucket, memPercent: number): string | undefined {
  if (m.memIsEstimated) return memoryUsageHelp(m, memPercent)
  return REDIS_MEMORY_HELP
}

/** Engine-neutral key lifecycle rates; hidden until either rate is non-zero. */
function lifecycleTilesFor(
  evictionsPerSec?: number,
  expirationsPerSec?: number,
): { evictions: string; expirations: string } | null {
  const ev = evictionsPerSec ?? 0
  const ex = expirationsPerSec ?? 0
  if (ev <= 0 && ex <= 0) return null
  return { evictions: `${fmtRate(ev)}/s`, expirations: `${fmtRate(ex)}/s` }
}

function ReadyPill({ label, hasIssue }: { label: string; hasIssue: boolean }) {
  return (
    <span
      className={`shrink-0 rounded border px-2 py-0.5 font-mono text-[10px] ${
        hasIssue
          ? 'border-red-500/40 bg-red-950/30 text-red-300'
          : 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
      }`}
    >
      {label}
    </span>
  )
}

function CacheProcessCard({
  title,
  pods,
  memoryLabel,
  memoryHelp,
  cpuLabel,
  cpuHelp,
  commandTiles,
  lifecycleTiles,
  footerNote,
}: {
  title: string
  pods: ReturnType<typeof podsForLayer>
  memoryLabel: string
  memoryHelp?: string
  cpuLabel: string
  cpuHelp?: string
  commandTiles?: { readLabel: string; readValue: string; writeLabel: string; writeValue: string } | null
  lifecycleTiles?: { evictions: string; expirations: string } | null
  footerNote?: string
}) {
  const health = summarizePodHealth(pods)
  const primaryPod = pods[0]

  return (
    <article className="overflow-hidden rounded-lg border border-gray-800/80 bg-gray-950/30">
      <div className="flex items-start justify-between gap-2 border-b border-gray-800/80 bg-gray-900/40 px-3 py-2">
        <h4 className="min-w-0 text-[11px] font-semibold text-gray-200">{title}</h4>
        {health.total > 0 ? (
          <ReadyPill label={health.pillLabel} hasIssue={health.hasIssue} />
        ) : null}
      </div>
      <div className="space-y-3 p-3">
        {primaryPod ? (
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Active pod
            </div>
            <div
              className="inline-block max-w-full truncate rounded border border-gray-800 bg-gray-950 px-2 py-1 font-mono text-[11px] text-gray-300"
              title={primaryPod.name}
            >
              {displayPodChip(primaryPod)}
            </div>
            {health.detailLine ? (
              <p
                className={`font-mono text-[10px] ${
                  health.hasIssue ? 'text-red-300' : 'text-gray-500'
                }`}
              >
                {health.detailLine}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <StatBlock label="Memory" value={memoryLabel} help={memoryHelp} />
          <StatBlock label="CPU" value={cpuLabel} help={cpuHelp} />
        </div>
        {commandTiles ? (
          <div className="space-y-2 border-t border-gray-800/80 pt-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Engine commands
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatBlock label={commandTiles.readLabel} value={commandTiles.readValue} />
              <StatBlock label={commandTiles.writeLabel} value={commandTiles.writeValue} />
            </div>
          </div>
        ) : null}
        {lifecycleTiles ? (
          <div className="space-y-2 border-t border-gray-800/80 pt-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Key lifecycle
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatBlock
                label="Evictions"
                value={lifecycleTiles.evictions}
                help="Keys Redis removed to make room after reaching its memory limit."
              />
              <StatBlock
                label="TTL expirations"
                value={lifecycleTiles.expirations}
                help="Keys the store removed because their TTL ended."
              />
            </div>
          </div>
        ) : null}
        {footerNote ? (
          <p className="text-[10px] text-gray-500">{footerNote}</p>
        ) : null}
      </div>
    </article>
  )
}

function commandTilesForBucket(
  m: MetricsBucket,
  view: PanelViewState,
): { readLabel: string; readValue: string; writeLabel: string; writeValue: string } | null {
  const io = m.storageIo
  if (!io) return null
  const engine = (m.storageEngine ?? 'redis').trim()
  const readLabel = storageReadTileLabel(io, engine)
  const writeLabel = storageWriteTileLabel(io, engine)
  const tiles = storageIoThroughputFields(m, view.timeframe, readLabel, writeLabel, fmtRate)
  if (!tiles.readValue && !tiles.writeValue) return null
  return tiles
}

function layerProcessCard(
  layer: ComponentLayerMetrics,
  m: MetricsBucket,
  view: PanelViewState,
  evictionPolicy?: string,
) {
  const backing = isBackingCacheLayer(layer)
  const { cpuPercent, memPercent } = layerResourcePercents(layer)
  const layerBucket = {
    ...m,
    cpuUsage: layer.cpuUsage,
    memoryBytes: layer.memoryBytes,
    cpuLimit: layer.cpuLimit,
    memoryLimit: layer.memoryLimit,
    cpuIsEstimated: layer.cpuIsEstimated,
    memIsEstimated: layer.memIsEstimated,
    cpuSource: layer.cpuSource,
    memSource: layer.memSource,
    freshness: layer.freshness,
  }
  const cpuLabel = formatResourceLabels(layerBucket, cpuPercent, memPercent).cpu
  const memLabel = `${fmtBytes(layer.memoryBytes)}${
    layer.memoryLimit > 0 ? ` · ${memPercent.toFixed(1)}%` : ''
  }`
  const pods = podsForLayer(layer, m.runtimeHealth)
  const restartCount = layer.restartCount ?? 0
  let footerNote: string | undefined
  if (backing && evictionPolicy) footerNote = `${evictionPolicy} eviction`
  if ((layer.redisRejectedRate ?? 0) > 0) {
    footerNote = `Rejected commands/s ${fmtRate(layer.redisRejectedRate ?? 0)}`
  }
  if (restartCount > 0 && !pods.length) {
    footerNote = `${restartCount} pod restarts`
  }

  const syntheticForIo = {
    ...m,
    storageIo: backing ? m.storageIo : null,
    redisKeyspaceHits: layer.redisKeyspaceHits ?? 0,
    redisKeyspaceMisses: layer.redisKeyspaceMisses ?? 0,
  }

  return (
    <CacheProcessCard
      key={layer.id}
      title={cacheLayerCardTitle(layer)}
      pods={pods}
      memoryLabel={memLabel}
      memoryHelp={
        backing
          ? cacheMemoryHelp(layerBucket, memPercent)
          : memoryUsageHelp(layerBucket, memPercent)
      }
      cpuLabel={cpuLabel}
      cpuHelp={resourceUsageHelp(layerBucket)}
      commandTiles={backing ? commandTilesForBucket(syntheticForIo, view) : null}
      lifecycleTiles={
        backing
          ? lifecycleTilesFor(layer.evictionsPerSec, layer.expirationsPerSec)
          : null
      }
      footerNote={footerNote}
    />
  )
}

export function CacheInfrastructureSection({
  m,
  mode,
  cpuPercent,
  memPercent,
  evictionPolicy,
  view,
}: {
  m: MetricsBucket
  mode: CacheInspectorMode
  cpuPercent: number
  memPercent: number
  evictionPolicy?: string
  view: PanelViewState
}) {
  if (mode === 'layered' && isLayeredCache(m)) {
    return (
      <section className="space-y-3 border-t border-gray-800/80 pt-4">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-300">
            Component infrastructure
          </h3>
          <p className="mt-0.5 text-[10px] text-gray-500">
            Two containers work together for this cache.
          </p>
        </div>
        <div className="space-y-3">
          {m.layers.map((layer) => layerProcessCard(layer, m, view, evictionPolicy))}
        </div>
      </section>
    )
  }

  const pods = podsForComponent(m.runtimeHealth)
  const memLabel = `${fmtBytes(m.memoryBytes)}${
    m.memoryLimit > 0 ? ` · ${memPercent.toFixed(1)}%` : ''
  }`
  const cpuLabel = formatResourceLabels(m, cpuPercent, memPercent).cpu
  const title = mode === 'timeline' ? 'Redis engine' : 'Redis'

  return (
    <section className="space-y-3 border-t border-gray-800/80 pt-4">
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-300">
          {title}
        </h3>
        <p className="mt-0.5 text-[10px] text-gray-500">
          {mode === 'timeline'
            ? 'Single Redis process for sorted-set timelines.'
            : 'Single Redis process for cache-aside.'}
        </p>
      </div>
      <CacheProcessCard
        title={title}
        pods={pods}
        memoryLabel={memLabel}
        memoryHelp={cacheMemoryHelp(m, memPercent)}
        cpuLabel={cpuLabel}
        cpuHelp={resourceUsageHelp(m)}
        commandTiles={commandTilesForBucket(m, view)}
        lifecycleTiles={lifecycleTilesFor(m.evictionsPerSec, m.expirationsPerSec)}
        footerNote={evictionPolicy ? `${evictionPolicy} eviction` : undefined}
      />
    </section>
  )
}

export function CacheSessionTotalsDisclosure({
  m,
  keyspaceDrift,
  showKeyspaceRates,
}: {
  m: MetricsBucket
  keyspaceDrift: boolean
  showKeyspaceRates: boolean
}) {
  return (
    <InspectorDisclosure title="Session totals (9 min)" hint="Rolling Prometheus window">
      <div className="font-mono text-[11px] text-gray-300">
        Hits {fmtInt(m.cacheHitsLast9m)} · Misses {fmtInt(m.cacheMissesLast9m)}
      </div>
      {showKeyspaceRates ? (
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
      ) : null}
      {(m.redisConnectedClients ?? 0) > 0 ? (
        <div className="font-mono text-[11px] text-gray-400">
          Connected clients · {fmtInt(Math.round(m.redisConnectedClients ?? 0))}
        </div>
      ) : null}
      <PedagogicalHint tone="sky">
        {keyspaceDrift
          ? 'App hit rate and keyspace counters differ by more than 10% — check pod aggregation scope.'
          : 'Session totals use a rolling 9-minute window; live hit rate above uses a shorter window.'}
      </PedagogicalHint>
    </InspectorDisclosure>
  )
}

export function CacheCanvasFootnote({
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

export function buildCacheHeadlines(
  m: MetricsBucket,
  timeframe: PanelViewState['timeframe'],
): CacheHeadlineFields {
  return cacheHeadlines(m, timeframe, fmtRate)
}
