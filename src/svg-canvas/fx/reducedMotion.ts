import { useSyncExternalStore } from 'react'

let cached: boolean | null = null

function readReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  const handler = () => {
    cached = mq.matches
    onChange()
  }
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}

export function prefersReducedMotion(): boolean {
  if (cached === null) cached = readReducedMotion()
  return cached
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => {
      cached = readReducedMotion()
      return cached
    },
    () => false,
  )
}
