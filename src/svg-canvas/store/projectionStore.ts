import { useSyncExternalStore } from 'react'
import { prefersReducedMotion } from '../fx/reducedMotion'

export type ProjectionMode = 'iso' | 'flat'

const DURATION_MS = 650

let mode: ProjectionMode = 'iso'
let t = 0
const listeners = new Set<() => void>()
let raf = 0

function emit(): void {
  for (const listener of listeners) listener()
}

function ease(k: number): number {
  return k * k * (3 - 2 * k)
}

function stop(): void {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
}

function animateTo(to: number): void {
  stop()
  if (prefersReducedMotion()) {
    t = to
    emit()
    return
  }
  const from = t
  const t0 = performance.now()
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / DURATION_MS)
    t = from + (to - from) * ease(k)
    emit()
    if (k < 1) raf = requestAnimationFrame(step)
    else raf = 0
  }
  raf = requestAnimationFrame(step)
}

export function getProjectionT(): number {
  return t
}

export function getProjectionMode(): ProjectionMode {
  return mode
}

export function subscribeProjection(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

export function setProjectionMode(next: ProjectionMode): void {
  if (next === mode && ((next === 'iso' && t === 0) || (next === 'flat' && t === 1))) {
    return
  }
  mode = next
  animateTo(next === 'flat' ? 1 : 0)
}

export function useProjectionT(): number {
  return useSyncExternalStore(subscribeProjection, getProjectionT, () => 0)
}

export function useProjectionMode(): ProjectionMode {
  return useSyncExternalStore(subscribeProjection, getProjectionMode, () => 'iso')
}
