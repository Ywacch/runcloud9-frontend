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
import {
  useCanvasStore,
  type CanvasEdge,
  type CanvasNode,
} from '../store/canvasStore'
import { useMetricsStore, type MetricsBucket } from '../store/metricsStore'
import { SparkLine } from './SparkLine'

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

interface LiveMetricsProps {
  node: CanvasNode
}

export function LiveMetrics({ node }: LiveMetricsProps) {
  const nodeId = node.id
  const m = useMetricsStore((s) => s.metrics[nodeId])
  const history = useMetricsStore((s) => s.history[nodeId] ?? [])
  const edges = useCanvasStore((s) => s.edges)
  const nodes = useCanvasStore((s) => s.nodes)
  const liveSessionEndsAt = useCanvasStore((s) => s.liveSessionEndsAt)

  if (!m) {
    return (
      <p className="text-sm text-gray-500">Waiting for metrics stream…</p>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        Live metrics
      </h3>
      {node.type !== 'client' ? <CommonSection m={m} /> : null}
      <TypeSection
        node={node}
        m={m}
        history={history}
        edges={edges}
        nodes={nodes}
        liveSessionEndsAt={liveSessionEndsAt}
      />
    </div>
  )
}

function CommonSection({ m }: { m: MetricsBucket }) {
  const cpuValue = m.cpuIsEstimated
    ? m.cpuLimit > 0
      ? `${fmtCpuMilliCores(m.cpuUsage)} / ${fmtCpuMilliCores(m.cpuLimit)} (allocated)`
      : `${fmtCpuMilliCores(m.cpuUsage)} (allocated)`
    : fmtPct(m.cpuPercent)
  const memValue = m.memIsEstimated
    ? m.memoryLimit > 0
      ? `${fmtMemMB(m.memoryBytes)} / ${fmtMemMB(m.memoryLimit)} (allocated)`
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
}: {
  node: CanvasNode
  m: MetricsBucket
  history: MetricsBucket[]
  edges: Record<string, CanvasEdge>
  nodes: Record<string, CanvasNode>
  liveSessionEndsAt: number | null
}) {
  const nodeId = node.id
  const nodeType = node.type

  switch (nodeType) {
    case 'compute': {
      const cacheNode = linkedCacheNode(nodeId, edges, nodes)
      const hasCacheLink = cacheNode !== null
      const rpsSeries = history.map((h) => h.requestRate)
      const latencySeries = history.map((h) => h.p99Latency)
      const elapsed = sessionElapsedSeconds(liveSessionEndsAt)
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
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <MetricTile
              label="Eviction Policy"
              value={String(node.config.evictionPolicy ?? 'allkeys-lru')}
            />
            <MetricTile
              label="Strategy"
              value={String(node.config.cacheStrategy ?? 'cache-aside')}
            />
          </div>
          <MetricTile label="Hit Rate" value={hitRateLabel} />
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">
              Current rate
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
        </div>
      )
    }

    case 'database': {
      const maxConn = Number(node.config.maxConnections ?? 100)
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

      return (
        <div className="space-y-2">
          <MetricTile
            label="Algorithm"
            value={String(node.config.algorithm ?? 'round-robin')}
          />
          <MetricTile
            label="Requests Routed"
            value={`${fmtInt(m.requestRate)} rps`}
          />
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">
              Backends
            </div>
            <div className="flex flex-wrap gap-1">
              {backends.map((b) => (
                <span
                  key={b.id}
                  className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-300"
                >
                  {b.label}
                </span>
              ))}
            </div>
          </div>
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

    case 'message_queue':
      return <MetricTile label="Engine" value="RabbitMQ" />

    case 'worker':
      return <MetricTile label="Role" value="Consumer" />

    default:
      return null
  }
}
