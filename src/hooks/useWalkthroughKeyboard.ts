import { useEffect } from 'react'
import type { WalkthroughSpeed } from '../store/walkthroughStore'
import { useWalkthroughStore } from '../store/walkthroughStore'

export function useWalkthroughKeyboard(active: boolean): void {
  const stop = useWalkthroughStore((s) => s.stop)
  const setPlaying = useWalkthroughStore((s) => s.setPlaying)
  const playing = useWalkthroughStore((s) => s.playing)
  const nextStep = useWalkthroughStore((s) => s.nextStep)
  const prevStep = useWalkthroughStore((s) => s.prevStep)
  const setSpeed = useWalkthroughStore((s) => s.setSpeed)

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stop()
        return
      }
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        setPlaying(!playing)
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        nextStep()
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prevStep()
        return
      }
      const speedMap: Record<string, WalkthroughSpeed> = {
        '1': 0.5,
        '2': 1,
        '3': 1.5,
        '4': 2,
      }
      const sp = speedMap[e.key]
      if (sp) setSpeed(sp)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, playing, stop, setPlaying, nextStep, prevStep, setSpeed])
}
