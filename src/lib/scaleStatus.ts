export interface ScaleStatus {
  desired: number
  ready: number
}

export function parseScaleStatus(raw: unknown): ScaleStatus | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const desired = Number(o.desired)
  const ready = Number(o.ready)
  if (!Number.isFinite(desired) || desired <= 0) return null
  if (!Number.isFinite(ready)) return null
  return { desired: Math.round(desired), ready: Math.round(ready) }
}

/** Shown under compute/worker replica rows when HPA desired differs from ready. */
export function scaleReplicaLabel(scale: ScaleStatus | null): string | null {
  if (!scale) return null
  if (scale.desired === scale.ready) return null
  return `${scale.desired} desired · ${scale.ready} ready`
}
