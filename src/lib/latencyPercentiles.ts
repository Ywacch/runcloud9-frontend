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
