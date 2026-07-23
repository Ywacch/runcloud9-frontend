import type { Archetype } from '../store/svgCanvasStore'
import { useSvgCanvasStore } from '../store/svgCanvasStore'

const ITEMS: { archetype: Archetype; label: string }[] = [
  { archetype: 'app-server', label: 'App server' },
]

export function MiniPalette() {
  const placing = useSvgCanvasStore((s) => s.placingArchetype)
  const toggle = useSvgCanvasStore((s) => s.togglePlacingArchetype)

  return (
    <div className="ml-2 flex items-center gap-1 rounded-md border border-zinc-300 p-0.5">
      <span className="px-1.5 text-[10px] uppercase tracking-wide text-zinc-400">
        Place
      </span>
      {ITEMS.map((item) => {
        const armed = placing === item.archetype
        return (
          <button
            key={item.archetype}
            type="button"
            className={`rounded px-2 py-1 text-xs ${
              armed
                ? 'bg-blue-600 text-white'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
            aria-pressed={armed}
            onClick={() => toggle(item.archetype)}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
