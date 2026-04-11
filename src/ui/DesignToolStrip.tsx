import {
  isCanvasEditMode,
  useCanvasStore,
  type DesignTool,
} from '../store/canvasStore'

const tools: { id: DesignTool; label: string; hotkey: string; title: string }[] = [
  { id: 'select', label: 'Select', hotkey: '1', title: 'Select & move (1)' },
  { id: 'connect', label: 'Connect', hotkey: '5', title: 'Draw connections (5)' },
  { id: 'erase', label: 'Erase', hotkey: '0', title: 'Delete nodes & edges (0)' },
]

export function DesignToolStrip() {
  const mode = useCanvasStore((s) => s.mode)
  const designTool = useCanvasStore((s) => s.designTool)
  const setDesignTool = useCanvasStore((s) => s.setDesignTool)

  if (!isCanvasEditMode(mode)) return null

  return (
    <div
      className="pointer-events-auto fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 gap-0.5 rounded-lg border border-gray-200 bg-white/95 p-1 shadow-lg backdrop-blur-sm"
      role="toolbar"
      aria-label="Design tools"
    >
      {tools.map((t) => {
        const active = designTool === t.id
        return (
          <button
            key={t.id}
            type="button"
            title={t.title}
            onClick={() => setDesignTool(t.id)}
            className={`relative flex min-w-[4.5rem] flex-col items-center rounded-md px-3 py-2 text-xs font-medium transition-colors ${
              active
                ? 'bg-sky-100 text-sky-900'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span>{t.label}</span>
            <span className="absolute bottom-0.5 right-1 font-mono text-[9px] text-gray-400">
              {t.hotkey}
            </span>
          </button>
        )
      })}
    </div>
  )
}
