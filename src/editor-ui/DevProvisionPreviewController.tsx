import { useEffect, useRef } from 'react'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useProvisionFloorStore } from '../editor-core/stores/provisionFloorStore'
import {
  buildDevProvisionMetrics,
  isDevProvisionPreviewEnabled,
  setDevProvisionPreviewEnabled,
  useDevProvisionPreviewEnabled,
} from '../lib/devProvisionPreview'

/** DEV-only: animate the in-canvas provision strip from current floor nodes. */
export function DevProvisionPreviewController({
  blocked,
}: {
  blocked: boolean
}) {
  const enabled = useDevProvisionPreviewEnabled()
  const mode = useCanvasStore((s) => s.mode)
  const startedAt = useRef(Date.now())

  const run = import.meta.env.DEV && enabled && !blocked && mode !== 'live'

  useEffect(() => {
    if (import.meta.env.DEV && isDevProvisionPreviewEnabled()) {
      setDevProvisionPreviewEnabled(true)
    }
  }, [])

  useEffect(() => {
    if (!run) {
      const st = useProvisionFloorStore.getState()
      if (st.preview) st.clear()
      return
    }
    startedAt.current = Date.now()
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt.current) / 1000)
      const parsed = buildDevProvisionMetrics(
        useCanvasStore.getState().nodes,
        elapsed,
      )
      useProvisionFloorStore.getState().patch({
        active: true,
        preview: true,
        submitting: false,
        parsed,
        elapsedSeconds: elapsed,
        isQueued: false,
        isTerminating: false,
        queuePosition: null,
        estimatedWaitSeconds: null,
        error: null,
      })
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [run])

  return null
}
