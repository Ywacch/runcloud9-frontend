import { useCallback, useEffect, useState } from 'react'
import { RATIONALE } from '../lib/rationale'
import { useCanvasStore, type CanvasNode } from '../store/canvasStore'

function firstNodeIdOfType(
  nodes: Record<string, CanvasNode>,
  type: CanvasNode['type']
): string | null {
  const found = Object.values(nodes).find((n) => n.type === type)
  return found?.id ?? null
}

export function RationalePanel() {
  const templateId = useCanvasStore((s) => s.snapshotTemplateId)
  const nodes = useCanvasStore((s) => s.nodes)
  const selectNode = useCanvasStore((s) => s.selectNode)

  const entries = templateId ? (RATIONALE[templateId] ?? []) : []
  const [expanded, setExpanded] = useState<number | null>(0)

  useEffect(() => {
    setExpanded(entries.length > 0 ? 0 : null)
  }, [templateId, entries.length])

  const onToggle = useCallback(
    (i: number, highlight: CanvasNode['type'] | undefined) => {
      setExpanded((prev) => {
        const next = prev === i ? null : i
        if (next === i && highlight) {
          const id = firstNodeIdOfType(nodes, highlight)
          if (id) selectNode(id)
        }
        return next
      })
    },
    [nodes, selectNode]
  )

  if (entries.length === 0) return null

  return (
    <div className="space-y-2 border-t border-gray-800 pt-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500">
        Why this design?
      </h3>
      {entries.map((entry, i) => (
        <button
          key={`${entry.title}-${i}`}
          type="button"
          onClick={() => onToggle(i, entry.highlight)}
          className="w-full rounded-lg border border-gray-700/50 bg-gray-800/30 p-3 text-left transition hover:border-gray-600/60 hover:bg-gray-800/50"
        >
          <div className="text-sm font-medium text-white">{entry.title}</div>
          {expanded === i ? (
            <p className="mt-2 text-xs leading-relaxed text-gray-400">
              {entry.body}
            </p>
          ) : null}
        </button>
      ))}
    </div>
  )
}
