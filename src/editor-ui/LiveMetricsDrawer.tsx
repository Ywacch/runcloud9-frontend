import { useMemo, useState } from 'react'
import { fmtInt, fmtMs, fmtRate } from '../lib/format'
import {
  LIVE_METRICS_DRAWER_CLASS,
  useLiveChromeStore,
} from '../lib/liveChromeStore'
import { useDevLiveStripVisible } from '../lib/devCanvasTools'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useMetricsStore } from '../editor-core/stores/metricsStore'
import { DataViewPanel } from './DataViewPanel'
import { FlowPanel } from './FlowPanel'
import { MetricChart, type MetricChartSeries } from './MetricChart'

const LINE = '#4ade80'
const MISS = '#fb923c'

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
  const [flowOpen, setFlowOpen] = useState(false)
  const [dataViewOpen, setDataViewOpen] = useState(false)

  const devPreview = import.meta.env.DEV && mode === 'design'
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
      className={`flex h-full shrink-0 flex-col border-l border-[var(--c9-border)] bg-[var(--c9-bg-surface)] ${LIVE_METRICS_DRAWER_CLASS}`}
      aria-label="Detailed metrics"
    >
      <div className="flex items-start gap-2 border-b border-[var(--c9-border)] px-3 py-2">
        <div className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--c9-muted)]">
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
          className="mt-0.5 shrink-0 rounded p-0.5 text-[var(--c9-muted)] transition-transform duration-150 hover:text-[var(--c9-text)] active:scale-[0.96]"
        >
          <ChevronRight />
        </button>
      </div>
      {chartFrozen && !devPreview ? (
        <p className="px-3 pt-2 text-[10px] text-amber-400/90">
          {catchingUp ? 'Catching up…' : 'Reconnecting'}
        </p>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {cards.length === 0 ? (
          <p className="px-1 py-6 text-center text-[12px] text-[var(--c9-muted)]">
            Metrics will appear once telemetry arrives.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {cards.map((card) => (
              <MetricChart
                key={card.id}
                title={card.title}
                unit={card.unit}
                series={card.series}
                compact
                showDot={false}
                className="rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg-card)] p-2.5 shadow-none"
              />
            ))}
          </div>
        )}
        {mode === 'simulate' || mode === 'live' ? (
          <div className="mt-2 flex gap-2 px-1">
            {mode === 'simulate' ? (
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
      <FlowPanel open={flowOpen} onClose={() => setFlowOpen(false)} />
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
