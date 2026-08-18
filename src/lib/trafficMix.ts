import type { LoadgenEndpointSpec } from './api'
import type { JourneySpec } from './requestJourney'

export function distributionKey(method: string, pathTemplate: string): string {
  return `${method} ${pathTemplate}`
}

export function endpointMixLabel(
  key: string,
  journeys: JourneySpec[],
): string {
  const journey = journeys.find((j) => `${j.method} ${j.path}` === key)
  if (journey?.label) return journey.label
  const pathTail = key.split(' ').pop()?.replace(/^\//, '') ?? key
  return pathTail
}

/** Normalize raw weights into integer percents summing to exactly 100. */
export function weightsToPercents(weights: number[]): number[] {
  if (weights.length === 0) return []
  const total = weights.reduce((sum, w) => sum + w, 0) || 1
  const rounded = weights.map((w) => Math.round((w / total) * 100))
  let diff = 100 - rounded.reduce((sum, p) => sum + p, 0)
  let i = rounded.length - 1
  while (diff !== 0 && i >= 0) {
    rounded[i]! += diff > 0 ? 1 : -1
    diff += diff > 0 ? -1 : 1
    i--
  }
  return rounded
}

export function percentsToDistribution(
  endpoints: Pick<LoadgenEndpointSpec, 'method' | 'pathTemplate'>[],
  percents: number[],
): Record<string, number> {
  const out: Record<string, number> = {}
  endpoints.forEach((ep, i) => {
    out[distributionKey(ep.method, ep.pathTemplate)] = percents[i] ?? 0
  })
  return out
}

export function distributionToPercents(
  endpoints: Pick<LoadgenEndpointSpec, 'method' | 'pathTemplate'>[],
  distribution: Record<string, number>,
): number[] {
  return endpoints.map((ep) => {
    const key = distributionKey(ep.method, ep.pathTemplate)
    const weight = distribution[key]
    return Number.isFinite(weight) ? Math.max(0, Math.round(weight!)) : 0
  })
}

export function defaultEndpointPercents(
  endpoints: LoadgenEndpointSpec[],
): number[] {
  return weightsToPercents(endpoints.map((ep) => ep.weight))
}

/**
 * Drag one mix slider: clamp next, keep zero endpoints at zero on others,
 * split the remainder proportionally, fix rounding so the total is 100.
 */
export function redistributePercents(
  current: number[],
  index: number,
  next: number,
): number[] {
  const n = current.length
  if (n === 0) return []
  if (index < 0 || index >= n) return [...current]

  const clamped = Math.min(100, Math.max(0, Math.round(next)))
  const out = new Array<number>(n).fill(0)
  out[index] = clamped
  const remaining = 100 - clamped

  const eligible = current
    .map((v, i) => ({ i, v }))
    .filter(({ i, v }) => i !== index && v > 0)

  if (eligible.length === 0) {
    const target = index === 0 ? 1 : 0
    if (n > 1) out[target] = remaining
    return out
  }

  const eligibleSum = eligible.reduce((sum, { v }) => sum + v, 0)
  let assigned = 0
  for (let j = 0; j < eligible.length; j++) {
    const { i, v } = eligible[j]!
    if (j === eligible.length - 1) {
      out[i] = remaining - assigned
    } else {
      const share = Math.round((v / eligibleSum) * remaining)
      out[i] = share
      assigned += share
    }
  }

  return out
}

export function distributionSnapshot(
  distribution: Record<string, number>,
): string {
  return JSON.stringify(
    Object.entries(distribution).sort(([a], [b]) => a.localeCompare(b)),
  )
}
