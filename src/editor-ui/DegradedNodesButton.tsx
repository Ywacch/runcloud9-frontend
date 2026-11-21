import { useEffect, useId, useRef, useState } from 'react'
import { useCanvasStore } from '../editor-core/stores/canvasStore'

/**
 * Amber "N degraded" control. Lists the nodes whose live status is degraded
 * and selects one. Hidden when every node is healthy.
 */
export function DegradedNodesButton() {
  const nodes = useCanvasStore((s) => s.nodes)
  const selectNode = useCanvasStore((s) => s.selectNode)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const degraded = Object.values(nodes)
    .filter((node) => node.status === 'degraded')
    .sort((a, b) => a.label.localeCompare(b.label))

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      const t = e.target
      if (!(t instanceof Node)) return
      if (rootRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (degraded.length === 0) return null

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="inline-flex h-6 items-center gap-1 rounded px-1.5 font-[family-name:var(--dt-font-family)] text-[12px] text-[#e0a64b] hover:bg-[rgba(217,164,65,0.12)]"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <b className="font-[family-name:var(--dt-font-family-mono)] font-medium tabular-nums">
          {degraded.length}
        </b>
        degraded
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute left-0 top-[calc(100%+6px)] z-40 min-w-[240px] rounded-md border border-[#2a2a45] bg-[#222240] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
        >
          {degraded.map((node) => (
            <button
              key={node.id}
              type="button"
              role="menuitem"
              className="flex w-full items-center justify-between gap-3 rounded px-2.5 py-1.5 text-left text-[12px] text-[#e6e6ef] hover:bg-white/5"
              onClick={() => {
                selectNode(node.id)
                setOpen(false)
              }}
            >
              <span className="min-w-0 truncate">{node.label}</span>
              <span className="font-[family-name:var(--dt-font-family-mono)] text-[11px] text-[#e0a64b]">
                degraded
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
