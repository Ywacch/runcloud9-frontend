import { useEffect } from 'react'
import { useWalkthroughStore } from '../stores/walkthroughStore'

const BASE_MS = 3000

export function useWalkthroughTimer(): void {
  const playing = useWalkthroughStore((s) => s.playing)
  const speed = useWalkthroughStore((s) => s.speed)
  const activeJourneyId = useWalkthroughStore((s) => s.activeJourneyId)
  const nextStep = useWalkthroughStore((s) => s.nextStep)

  useEffect(() => {
    if (!playing || !activeJourneyId) return
    const interval = window.setInterval(() => {
      nextStep()
    }, BASE_MS / speed)
    return () => window.clearInterval(interval)
  }, [playing, speed, activeJourneyId, nextStep])
}
