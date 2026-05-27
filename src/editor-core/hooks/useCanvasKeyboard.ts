import { useEffect } from 'react'
import { dispatchResetCamera } from '../../lib/spawnEvents'
import { useCanvasStore } from '../stores/canvasStore'

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

      const {
        mode,
        selectedId,
        removeNode,
        selectNode,
        setPendingSource,
        setPlacingNodeType,
        setDesignTool,
      } = useCanvasStore.getState()

      if (e.key === 'Escape') {
        selectNode(null)
        setPendingSource(null)
        setPlacingNodeType(null)
        setDesignTool('select')
        return
      }

      if (e.key === '1') {
        e.preventDefault()
        setDesignTool('select')
        return
      }
      if (e.key === '5') {
        e.preventDefault()
        setDesignTool('connect')
        return
      }
      if (e.key === '0') {
        e.preventDefault()
        setDesignTool('erase')
        return
      }

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        dispatchResetCamera()
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (mode === 'live' || !selectedId) return
        e.preventDefault()
        removeNode(selectedId)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
