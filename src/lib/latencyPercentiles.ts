/** Linear-interpolation percentile on a pre-sorted ascending array. */
export function percentileSorted(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0
  if (sortedAsc.length === 1) return sortedAsc[0]!
  const rank = (p / 100) * (sortedAsc.length - 1)
  const lo = Math.floor(rank)
  const hi = Math.ceil(rank)
  const w = rank - lo
  return sortedAsc[lo]! * (1 - w) + sortedAsc[hi]! * w
}

export interface LatencyReferenceLines {
  p50: number
  mean: number
  p95: number
  p99: number
}

export function latencyReferenceLines(latenciesMs: number[]): LatencyReferenceLines {
  const sorted = latenciesMs.filter((n) => Number.isFinite(n) && n >= 0).sort((a, b) => a - b)
  if (sorted.length === 0) {
    return { p50: 0, mean: 0, p95: 0, p99: 0 }
  }
  const mean = sorted.reduce((sum, n) => sum + n, 0) / sorted.length
  return {
    p50: percentileSorted(sorted, 50),
    mean,
    p95: percentileSorted(sorted, 95),
    p99: percentileSorted(sorted, 99),
  }
}

export interface BoxPlotStats {
  whiskerMin: number
  q1: number
  median: number
  q3: number
  whiskerMax: number
}

function sortedFiniteNonNegative(samples: number[]): number[] {
  return samples.filter((n) => Number.isFinite(n) && n >= 0).sort((a, b) => a - b)
}

/** Tukey box plot quartiles + 1.5×IQR whiskers (needs ≥4 samples). */
export function boxPlotQuartiles(samples: number[]): BoxPlotStats | null {
  const sorted = sortedFiniteNonNegative(samples)
  if (sorted.length < 4) return null

  const q1 = percentileSorted(sorted, 25)
  const median = percentileSorted(sorted, 50)
  const q3 = percentileSorted(sorted, 75)
  const iqr = q3 - q1
  const lowerFence = q1 - 1.5 * iqr
  const upperFence = q3 + 1.5 * iqr

  let whiskerMin = sorted[0]!
  for (const v of sorted) {
    if (v >= lowerFence) {
      whiskerMin = v
      break
    }
  }

  let whiskerMax = sorted[sorted.length - 1]!
  for (let i = sorted.length - 1; i >= 0; i--) {
    const v = sorted[i]!
    if (v <= upperFence) {
      whiskerMax = v
      break
    }
  }

  return { whiskerMin, q1, median, q3, whiskerMax }
}
