import { useEffect } from 'react'
import { requestCanvasFit } from '../../canvas/utils/canvasFitBridge'
import { cycleDevCanvasChromeMode } from '../../lib/devCanvasTools'
import { canMutateCanvasTopology, useCanvasStore } from '../stores/canvasStore'

export function useCanvasKeyboard(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return
      }

      const state = useCanvasStore.getState()
      const {
        selectedId,
        selectedIds,
        removeSelectedNodes,
        selectNode,
        selectAllNodes,
        undo,
        redo,
        setPendingSource,
        setPlacingNodeType,
        setDesignTool,
      } = state
      const canEditTopology = canMutateCanvasTopology(state)

      if (e.key === 'Escape') {
        selectNode(null)
        setPendingSource(null)
        setPlacingNodeType(null)
        setDesignTool('select')
        return
      }

      if (
        import.meta.env.DEV &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        e.code === 'Backquote'
      ) {
        e.preventDefault()
        cycleDevCanvasChromeMode()
        return
      }

      // Tool letters only when no modifiers — Ctrl+C is copy, not Connect.
      const bareKey =
        !e.ctrlKey && !e.metaKey && !e.altKey ? e.key.toLowerCase() : null
      if (bareKey === 's') {
        e.preventDefault()
        setDesignTool('select')
        return
      }
      if (bareKey === 'c') {
        e.preventDefault()
        setDesignTool('connect')
        return
      }
      if (bareKey === 'e') {
        e.preventDefault()
        setDesignTool('erase')
        return
      }

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        requestCanvasFit()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        if (!canEditTopology) return
        e.preventDefault()
        selectAllNodes()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        if (!canEditTopology) return
        e.preventDefault()
        undo()
        return
      }

      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'y' || e.key === 'Y' || (e.key === 'z' && e.shiftKey))
      ) {
        if (!canEditTopology) return
        e.preventDefault()
        redo()
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!canEditTopology) return
        if (selectedIds.length === 0 && !selectedId) return
        e.preventDefault()
        removeSelectedNodes()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
