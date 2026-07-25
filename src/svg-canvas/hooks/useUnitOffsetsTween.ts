import { useEffect, useRef, useState } from 'react'
import type { UnitOffset } from '../compose/composeAppServer'

const DEFAULT_MS = 200

function offsetsKey(units: UnitOffset[]): string {
  return units.map((u) => `${u.dx},${u.dy}`).join('|')
}

function lerpOffsets(
  from: UnitOffset[],
  to: UnitOffset[],
  t: number,
): UnitOffset[] {
  const n = Math.min(from.length, to.length)
  const out: UnitOffset[] = []
  for (let i = 0; i < n; i++) {
    out.push({
      dx: from[i].dx + (to[i].dx - from[i].dx) * t,
      dy: from[i].dy + (to[i].dy - from[i].dy) * t,
    })
  }
  return out
}

/**
 * Lerp unit offsets toward `composeGlyph` targets (~200ms).
 * Snaps immediately when the unit count changes (no packing morph).
 */
export function useUnitOffsetsTween(
  target: UnitOffset[],
  durationMs: number = DEFAULT_MS,
): UnitOffset[] {
  const key = offsetsKey(target)
  const targetRef = useRef(target)
  targetRef.current = target

  const [display, setDisplay] = useState(() => target.map((u) => ({ ...u })))
  const displayRef = useRef(display)
  displayRef.current = display
  const prevKeyRef = useRef(key)

  useEffect(() => {
    if (prevKeyRef.current === key) return
    prevKeyRef.current = key
    const to = targetRef.current.map((u) => ({ ...u }))
    const from = displayRef.current

    if (from.length !== to.length) {
      setDisplay(to)
      return
    }

    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      setDisplay(lerpOffsets(from, to, t))
      if (t < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        setDisplay(to)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [key, durationMs])

  return display
}

/** Pure helpers for tests. */
export function lerpUnitOffsetsForTest(
  from: UnitOffset[],
  to: UnitOffset[],
  t: number,
): UnitOffset[] {
  if (from.length !== to.length) return to.map((u) => ({ ...u }))
  return lerpOffsets(from, to, t)
}
