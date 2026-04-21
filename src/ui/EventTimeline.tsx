import { useLayoutEffect, useMemo, useRef } from 'react'
import { backendComponentToCanvasType } from '../lib/typeMapping'
import { useCanvasStore } from '../store/canvasStore'
import { useMetricsStore } from '../store/metricsStore'

function formatTime(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  return new Date(t).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function pillClass(type: string): string {
  if (type === 'cascade') return 'bg-red-950/80 text-red-100 ring-red-800/50'
  if (type === 'threshold')
    return 'bg-amber-950/80 text-amber-100 ring-amber-800/50'
  return 'bg-sky-950/70 text-sky-100 ring-sky-800/40'
}

/**
 * Horizontal time strip (oldest → newest); scrolls to the latest tick.
 * Click a pill to select the first canvas node matching the backend component.
 */
export function EventTimeline() {
  const events = useMetricsStore((s) => s.events)
  const scrollRef = useRef<HTMLDivElement>(null)
  const selectNode = useCanvasStore((s) => s.selectNode)
  const nodes = useCanvasStore((s) => s.nodes)

  const sorted = useMemo(() => {
    return [...events].sort(
      (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)
    )
  }, [events])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollLeft = el.scrollWidth - el.clientWidth
  }, [sorted])

  if (!sorted.length) return null

  const onPillClick = (component: string | undefined) => {
    if (!component) return
    const canvasType = backendComponentToCanvasType[component]
    if (!canvasType) return
    const match = Object.values(nodes)
      .filter((n) => n.type === canvasType)
      .sort((a, b) => a.id.localeCompare(b.id))[0]
    if (match) selectNode(match.id)
  }

  return (
    <div className="pointer-events-auto w-full max-w-2xl">
      <div className="mb-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
        Event timeline
      </div>
      <div
        ref={scrollRef}
        className="flex max-w-full gap-1 overflow-x-auto overflow-y-hidden rounded-lg border border-white/10 bg-black/45 py-1.5 pl-1.5 pr-1 shadow-md backdrop-blur-md [scrollbar-width:thin]"
      >
        {sorted.map((e, i) => (
          <button
            key={`${e.timestamp}-${i}-${e.title}`}
            type="button"
            title={e.description || e.title}
            onClick={() => onPillClick(e.component)}
            disabled={!e.component}
            className={`shrink-0 max-w-[min(100%,14rem)] rounded-full px-2 py-0.5 text-left text-[10px] ring-1 transition hover:brightness-110 disabled:cursor-default disabled:opacity-90 ${pillClass(e.type)} ${
              e.component ? 'cursor-pointer' : ''
            }`}
          >
            <span className="mr-1 font-mono text-zinc-500">
              {formatTime(e.timestamp)}
            </span>
            <span className="text-zinc-300">{e.title}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
