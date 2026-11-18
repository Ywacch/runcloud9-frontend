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
    <div className="cv-tools pointer-events-auto" role="toolbar" aria-label="Canvas tools">
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
            aria-pressed={active}
            onClick={() => {
              if (disabled) return
              setDesignTool(t.id)
            }}
          >
            {t.label} <kbd>{t.hotkey}</kbd>
          </button>
        )
      })}
    </div>
  )
}