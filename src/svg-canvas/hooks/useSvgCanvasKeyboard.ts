import { useEffect } from 'react'
import { useSvgCanvasStore } from '../store/svgCanvasStore'

/**
 * Canvas shortcuts aligned with Pixi useCanvasKeyboard (subset).
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
        clearPlacementAndSelection,
        selectAllNodes,
        undo,
        redo,
        removeSelected,
        copySelected,
        pasteClipboard,
        selectedIds,
        selectedEdgeIds,
        connectSourceId,
        connectMode,
        setConnectSourceId,
        setConnectMode,
      } = store

      if (e.key === 'Escape') {
        if (connectSourceId) {
          setConnectSourceId(null)
          return
        }
        if (connectMode) {
          setConnectMode(false)
          return
        }
        clearPlacementAndSelection()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        selectAllNodes()
        return
      }

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

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }

      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 'y' ||
          (e.key.toLowerCase() === 'z' && e.shiftKey))
      ) {
        e.preventDefault()
        redo()
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedEdgeIds.length === 0 && selectedIds.length === 0) return
        e.preventDefault()
        removeSelected()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
