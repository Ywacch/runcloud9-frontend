import {
  isCanvasEditMode,
  useCanvasStore,
  type DesignTool,
} from '../editor-core/stores/canvasStore'
import { useWalkthroughStore } from '../editor-core/stores/walkthroughStore'

const tools: { id: DesignTool; label: string; hotkey: string; title: string }[] = [
  { id: 'select', label: 'Select', hotkey: 'S', title: 'Select & move (S)' },
  { id: 'connect', label: 'Connect', hotkey: 'C', title: 'Draw connections (C)' },
  { id: 'erase', label: 'Erase', hotkey: 'E', title: 'Delete nodes & edges (E)' },
]

export function DesignToolStrip() {
  const mode = useCanvasStore((s) => s.mode)
  const designTool = useCanvasStore((s) => s.designTool)
  const setDesignTool = useCanvasStore((s) => s.setDesignTool)
  const loadedVariationId = useCanvasStore((s) => s.loadedVariationId)
  const walkthroughActive = useWalkthroughStore((s) => s.activeJourneyId)

  const topologyLocked = Boolean(loadedVariationId)

  if (!isCanvasEditMode(mode) || walkthroughActive) return null

  return (
    <div
      className="pointer-events-auto fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 gap-0.5 rounded-none border border-[var(--c9-border)] bg-[var(--c9-surface)]/95 p-1 backdrop-blur-sm"
      role="toolbar"
      aria-label="Design tools"
    >
      {tools.map((t) => {
        const active = designTool === t.id
        const disabled =
          topologyLocked && (t.id === 'connect' || t.id === 'erase')
        return (
          <button
            key={t.id}
            type="button"
            title={disabled ? 'Topology is locked for this lab variation' : t.title}
            disabled={disabled}
            onClick={() => {
              if (disabled) return
              setDesignTool(t.id)
            }}
            className={`relative flex min-w-[4.5rem] flex-col items-center rounded-none px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-wide transition-colors ${
              disabled
                ? 'cursor-not-allowed opacity-40'
                : active
                  ? 'bg-[var(--c9-accent)] text-white'
                  : 'text-[var(--c9-muted)] hover:bg-[var(--c9-badge-bg)]'
            }`}
          >
            <span>{t.label}</span>
            <span
              className={`absolute bottom-0.5 right-1 font-mono text-[9px] ${
                active ? 'text-white/70' : 'text-[var(--c9-muted)]'
              }`}
            >
              {t.hotkey}
            </span>
          </button>
        )
      })}
    </div>
  )
}
