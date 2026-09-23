import { useMemo, useState } from 'react'
import { fmtInt, fmtMs, fmtRate } from '../lib/format'
import {
  LIVE_METRICS_DRAWER_CLASS,
  useLiveChromeStore,
} from '../lib/liveChromeStore'
import { useDevLiveStripVisible } from '../lib/devCanvasTools'
import { useDevInspectorMode } from '../lib/devInspectorMode'
import { devInstanceScopePreviewEnabled } from '../lib/devInstanceScopePreview'
import { SHOW_SIMULATION_UI } from '../lib/featureFlags'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useMetricsStore } from '../editor-core/stores/metricsStore'
import { DataViewPanel } from './DataViewPanel'
import { FlowPanel } from './FlowPanel'
import { LatencyNeedleChart } from './LatencyNeedleChart'
import { MetricChart, type MetricChartSeries } from './MetricChart'

const LINE = '#4ade80'
const MISS = '#fb923c'

/** Calm cluster + a few outliers so DEV preview matches the p50/mean/p95/p99 teaching chart. */
const PREVIEW_LATENCIES_MS = Array.from({ length: 80 }, (_, i) => {
  const base = 28 + ((i * 17) % 22)
  if (i === 12 || i === 41) return 180
  if (i === 63) return 320
  if (i === 71) return 410
  return base
})

function wave(n: number, base: number, amp: number, phase: number): number[] {
  return Array.from({ length: n }, (_, i) =>
    Math.max(
      0,
      Math.round(
        (base + Math.sin(i / 2.4 + phase) * amp + ((i * 13) % 7) - 3) * 10,
      ) / 10,
    ),
  )
}

type ChartCard = {
  id: string
  title: string
  unit?: string
  series: MetricChartSeries[]
}

export function LiveMetricsDrawer() {
  const open = useLiveChromeStore((s) => s.metricsDrawerOpen)
  const setOpen = useLiveChromeStore((s) => s.setMetricsDrawerOpen)
  const stripVisible = useDevLiveStripVisible()
  const mode = useCanvasStore((s) => s.mode)
  const nodes = useCanvasStore((s) => s.nodes)
  const loadgen = useMetricsStore((s) => s.loadgen)
  const series = useMetricsStore((s) => s.systemSeries)
  const chartFrozen = useMetricsStore((s) => s.chartFrozen)
  const catchingUp = useMetricsStore((s) => s.playbackCatchingUp)
  const streamWarning = useMetricsStore((s) => s.streamWarning)
  const [flowOpen, setFlowOpen] = useState(false)
  const [dataViewOpen, setDataViewOpen] = useState(false)

  useDevInspectorMode()
  const devPreview = devInstanceScopePreviewEnabled(mode)
  const transportReconnecting =
    streamWarning === 'Live metrics connection dropped. Reconnecting...' ||
    streamWarning === 'Reconnecting live metrics…'
  const showReconnectStatus =
    catchingUp || (chartFrozen && transportReconnecting)
  const visible =
    open &&
    stripVisible &&
    (mode === 'live' || mode === 'simulate' || devPreview)

  const serverLabel = useMemo(() => {
    if (devPreview) return 'i-0abc123'
    const compute = Object.values(nodes).find((n) => n.type === 'compute')
    return compute?.id?.slice(0, 14) ?? '-'
  }, [devPreview, nodes])

  const cards = useMemo((): ChartCard[] => {
    if (devPreview) {
      return [
        {
          id: 'cpu',
          title: 'CPU Usage (%)',
          unit: '%',
          series: [{ data: wave(24, 48, 12, 0.2), color: LINE, showArea: false }],
        },
        {
          id: 'mem',
          title: 'Memory Usage (GB)',
          unit: 'GB',
          series: [{ data: wave(24, 3.2, 0.6, 1.1), color: LINE, showArea: false }],
        },
        {
          id: 'cache',
          title: 'Cache Performance',
          series: [
            {
              data: wave(24, 820, 80, 0.4),
              color: LINE,
              label: 'Hits',
              showArea: false,
            },
            {
              data: wave(24, 90, 40, 2.2),
              color: MISS,
              label: 'Misses',
              showArea: false,
            },
          ],
        },
        {
          id: 'net',
          title: 'Network IO (Mbps)',
          unit: 'Mbps',
          series: [{ data: wave(24, 42, 14, 0.8), color: LINE, showArea: false }],
        },
      ]
    }
    if (series.length < 2) return []
    const out: ChartCard[] = [
      {
        id: 'p99',
        title: 'App p99 latency',
        unit: 'ms',
        series: [
          {
            data: series.map((s) => s.appP99Ms),
            color: LINE,
            showArea: false,
          },
        ],
      },
      {
        id: 'rps',
        title: 'App request rate',
        unit: 'RPS',
        series: [
          {
            data: series.map((s) => s.appRps),
            color: LINE,
            showArea: false,
          },
        ],
      },
      {
        id: 'cache',
        title: 'Cache Performance',
        series: [
          {
            data: series.map((s) => s.cacheHits),
            color: LINE,
            label: 'Hits',
            showArea: false,
          },
          {
            data: series.map((s) => s.cacheMisses),
            color: MISS,
            label: 'Misses',
            showArea: false,
          },
        ],
      },
      {
        id: 'db',
        title: 'DB query rate',
        unit: 'queries/s',
        series: [
          {
            data: series.map((s) => s.dbQueryRate),
            color: LINE,
            showArea: false,
          },
        ],
      },
    ]
    return out
      .filter((c) => c.series.some((s) => s.data.filter(Number.isFinite).length >= 2))
      .slice(0, 6)
  }, [devPreview, series])

  const latenciesMs = devPreview
    ? PREVIEW_LATENCIES_MS
    : (loadgen?.recentLatenciesMs ?? [])
  const throttleHint =
    !devPreview &&
    loadgen?.active &&
    loadgen.targetRps > 0 &&
    loadgen.actualRps > 0 &&
    loadgen.actualRps < loadgen.targetRps * 0.85
      ? 'Generator may be throttling. Achieved RPS is well below target.'
      : null
  const statusCodes = devPreview ? null : loadgen?.statusCodes

  if (!visible) return null

  const target = devPreview
    ? fmtInt(1000)
    : loadgen
      ? fmtRate(loadgen.targetRps)
      : '-'
  const achieved = devPreview
    ? fmtInt(998)
    : loadgen
      ? fmtRate(loadgen.actualRps)
      : '-'
  const last5s = devPreview
    ? '1.2s'
    : loadgen
      ? fmtMs(loadgen.intervalP99Ms)
      : '-'

  return (
    <aside
      className={`sl-inspector flex h-full shrink-0 flex-col ${LIVE_METRICS_DRAWER_CLASS}`}
      aria-label="Detailed metrics"
    >
      <div className="sl-topbar items-start">
        <div className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-1">
          <span>
            Target:{' '}
            <span className="font-mono tabular-nums text-[var(--c9-text)]">
              {target}
            </span>
          </span>
          <span>
            Achieved:{' '}
            <span className="font-mono tabular-nums text-[var(--c9-text)]">
              {achieved}
            </span>
          </span>
          <span className="truncate">
            Server:{' '}
            <span className="font-mono tabular-nums text-[var(--c9-text)]">
              {serverLabel}
            </span>
          </span>
          <span>
            Last 5s:{' '}
            <span className="font-mono tabular-nums text-[var(--c9-text)]">
              {last5s}
            </span>
          </span>
        </div>
        <button
          type="button"
          aria-label="Collapse detailed metrics"
          onClick={() => setOpen(false)}
          className="mt-0.5 shrink-0 rounded-none border border-transparent p-1 text-[var(--c9-muted)] transition-colors duration-150 hover:border-[var(--c9-border)] hover:text-[var(--c9-text)] active:scale-[0.96]"
        >
          <ChevronRight />
        </button>
      </div>
      {showReconnectStatus && !devPreview ? (
        <p className="px-3 pt-2 text-[10px] text-amber-400/90">
          {catchingUp ? 'Catching up…' : 'Reconnecting'}
        </p>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {latenciesMs.length >= 2 ? (
          <div className="mb-2">
            <LatencyNeedleChart latenciesMs={latenciesMs} />
            {throttleHint ? (
              <p className="mt-1.5 px-0.5 text-[10px] leading-snug text-amber-200/90">
                {throttleHint}
              </p>
            ) : null}
            {statusCodes && Object.keys(statusCodes).length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {Object.entries(statusCodes)
                  .sort(([, a], [, b]) => b - a)
                  .map(([code, count]) => (
                    <span
                      key={code}
                      className={`rounded-none border px-1.5 py-0.5 font-mono text-[10px] leading-none ${
                        Number(code) >= 500
                          ? 'border-red-500/40 bg-red-500/10 text-red-200/90'
                          : Number(code) >= 400
                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-200/90'
                            : 'border-[var(--c9-border)] bg-[var(--c9-surface)] text-[var(--c9-muted)]'
                      }`}
                    >
                      {code} · {fmtInt(count)}
                    </span>
                  ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {cards.length === 0 && latenciesMs.length < 2 ? (
          <p className="px-1 py-6 text-center text-[12px] text-[var(--c9-muted)]">
            Metrics will appear once telemetry arrives.
          </p>
        ) : cards.length > 0 ? (
          <div className="sl-kpi-grid">
            {cards.map((card) => (
              <div key={card.id} className="sl-kpi">
                <div className="sl-kpi-lab">{card.title}</div>
                <MetricChart
                  title={card.title}
                  unit={card.unit}
                  series={card.series}
                  compact
                  showDot={false}
                  className="mt-2 !border-0 !bg-transparent !p-0 shadow-none"
                />
              </div>
            ))}
          </div>
        ) : null}
        {mode === 'simulate' || mode === 'live' ? (
          <div className="mt-2 flex gap-2 px-1">
            {SHOW_SIMULATION_UI && mode === 'simulate' ? (
              <button
                type="button"
                onClick={() => setFlowOpen(true)}
                className="text-[11px] text-[var(--c9-muted)] hover:text-[var(--c9-text)]"
              >
                Flow
              </button>
            ) : null}
            {mode === 'live' ? (
              <button
                type="button"
                onClick={() => setDataViewOpen(true)}
                className="text-[11px] text-[var(--c9-muted)] hover:text-[var(--c9-text)]"
              >
                Playground
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {SHOW_SIMULATION_UI ? (
        <FlowPanel open={flowOpen} onClose={() => setFlowOpen(false)} />
      ) : null}
      {mode === 'live' ? (
        <DataViewPanel open={dataViewOpen} onClose={() => setDataViewOpen(false)} />
      ) : null}
    </aside>
  )
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
