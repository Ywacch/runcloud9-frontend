import { useEffect } from 'react'
import { useChaosStore } from '../editor-core/stores/chaosStore'

/** Clears client-side chaos overlays when max display time elapses. */
export function ChaosOverlayTicker() {
  const tick = useChaosStore((s) => s.tick)

  useEffect(() => {
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [tick])

  return null
}
