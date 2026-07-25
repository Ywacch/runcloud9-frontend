import { useEffect } from 'react'
import { useSvgCanvasStore } from '../store/svgCanvasStore'

/**
 * SVG-only shortcuts that product `useCanvasKeyboard` does not cover:
 * copy/paste and deleting selected edges.
 * Space for pan is handled in SvgDesignCanvas (needs local state).
 */
export function useSvgCanvasKeyboard(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return
      }

      const store = useSvgCanvasStore.getState()
      const {
        removeSelected,
        copySelected,
        pasteClipboard,
        selectedIds,
        selectedEdgeIds,
      } = store

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectedIds.length === 0) return
        e.preventDefault()
        copySelected()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        pasteClipboard()
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedEdgeIds.length === 0) return
        e.preventDefault()
        removeSelected()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
