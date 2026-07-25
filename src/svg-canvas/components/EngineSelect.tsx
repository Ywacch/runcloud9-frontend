import { backendSupportedEnginesForArchetype } from '../skins/engineSkins'
import { useSvgCanvasStore } from '../store/svgCanvasStore'

export function EngineSelect() {
  const selectedIds = useSvgCanvasStore((s) => s.selectedIds)
  const nodes = useSvgCanvasStore((s) => s.nodes)
  const setNodeEngine = useSvgCanvasStore((s) => s.setNodeEngine)

  if (selectedIds.length !== 1) return null
  const node = nodes.find((n) => n.id === selectedIds[0])
  if (!node) return null
  const options = backendSupportedEnginesForArchetype(node.archetype)
  if (options.length <= 1) return null

  return (
    <label className="ml-2 flex items-center gap-1 rounded-md border border-zinc-300 px-1.5 py-0.5 text-xs text-zinc-600">
      <span className="text-[10px] uppercase tracking-wide text-zinc-400">
        Engine
      </span>
      <select
        className="max-w-[9rem] bg-transparent text-xs text-zinc-800 outline-none"
        value={node.engine}
        onChange={(e) => setNodeEngine(node.id, e.target.value)}
        aria-label="Engine"
      >
        {options.map((o) => (
          <option key={o.engine} value={o.engine}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
