import type { HealthVisualState } from '../../canvas/utils/healthVisual'
import { useSvgCanvasStore } from '../store/svgCanvasStore'

const HEALTH_OPTIONS: { value: HealthVisualState; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'healthy', label: 'OK' },
  { value: 'warning', label: 'Warn' },
  { value: 'error', label: 'Err' },
  { value: 'chaos', label: 'Chaos' },
]

/**
 * Phase 6 demo controls — apply health to selected nodes; traffic via canvas animated.
 */
export function FxDemoControls({ compact = false }: { compact?: boolean }) {
  const selectedIds = useSvgCanvasStore((s) => s.selectedIds)
  const selectedEdgeIds = useSvgCanvasStore((s) => s.selectedEdgeIds)
  const nodes = useSvgCanvasStore((s) => s.nodes)
  const setNodeHealthVisual = useSvgCanvasStore((s) => s.setNodeHealthVisual)
  const setEdgesTrafficEnabled = useSvgCanvasStore((s) => s.setEdgesTrafficEnabled)

  const selectedHealth =
    selectedIds.length === 1
      ? (nodes.find((n) => n.id === selectedIds[0])?.healthVisual ?? 'off')
      : 'off'

  const btn = compact
    ? 'rounded px-1.5 py-0.5 text-[10px]'
    : 'rounded px-2 py-1 text-xs'
  const shell = compact
    ? 'pointer-events-auto flex flex-col gap-1 rounded-md border border-zinc-300/80 bg-white/90 p-1.5 shadow-sm backdrop-blur-sm'
    : 'flex flex-wrap items-center gap-1 rounded-md border border-zinc-300 p-0.5'

  return (
    <div className={shell} data-fx-demo-controls>
      <div className="flex flex-wrap items-center gap-1">
        <span className={compact ? 'px-1 text-[10px] text-zinc-500' : 'px-1 text-xs text-zinc-500'}>
          Health
        </span>
        {HEALTH_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`${btn} ${
              selectedHealth === opt.value && selectedIds.length > 0
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
            disabled={selectedIds.length === 0}
            title={
              selectedIds.length === 0
                ? 'Select a node first'
                : `Set health to ${opt.value}`
            }
            onClick={() => setNodeHealthVisual(selectedIds, opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className={compact ? 'px-1 text-[10px] text-zinc-500' : 'px-1 text-xs text-zinc-500'}>
          Traffic
        </span>
        <button
          type="button"
          className={`${btn} text-zinc-500 hover:text-zinc-800`}
          disabled={selectedEdgeIds.length === 0}
          title={
            selectedEdgeIds.length === 0
              ? 'Select edge(s) first'
              : 'Enable traffic on selected edges'
          }
          onClick={() => setEdgesTrafficEnabled(selectedEdgeIds, true)}
        >
          Sel on
        </button>
        <button
          type="button"
          className={`${btn} text-zinc-500 hover:text-zinc-800`}
          disabled={selectedEdgeIds.length === 0}
          onClick={() => setEdgesTrafficEnabled(selectedEdgeIds, false)}
        >
          Sel off
        </button>
        <button
          type="button"
          className={`${btn} text-zinc-500 hover:text-zinc-800`}
          onClick={() => setEdgesTrafficEnabled('all', true)}
        >
          All on
        </button>
        <button
          type="button"
          className={`${btn} text-zinc-500 hover:text-zinc-800`}
          onClick={() => setEdgesTrafficEnabled('all', false)}
        >
          All off
        </button>
      </div>
    </div>
  )
}
