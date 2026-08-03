export type PastRunStatus = 'running' | 'terminated' | 'failed'

export type PastRunListItem = {
  id: string
  namespace: string
  template: string
  archetype: string
  status: PastRunStatus
  createdAt: string
  durationSeconds?: number
  peakRps?: number
  peakP99Ms?: number
}

export type PastRunStatusFilter = 'all' | PastRunStatus

export type PastRunDateRange =
  | 'all'
  | 'today'
  | 'last_7_days'
  | 'last_30_days'

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function dateRangeStart(
  range: PastRunDateRange,
  now = new Date(),
): Date | null {
  if (range === 'all') return null
  if (range === 'today') return startOfLocalDay(now)
  const days = range === 'last_7_days' ? 7 : 30
  const start = startOfLocalDay(now)
  start.setDate(start.getDate() - (days - 1))
  return start
}

export function filterPastRuns(
  items: PastRunListItem[],
  opts: {
    search: string
    status: PastRunStatusFilter
    dateRange: PastRunDateRange
    now?: Date
  },
): PastRunListItem[] {
  const q = opts.search.trim().toLowerCase()
  const rangeStart = dateRangeStart(opts.dateRange, opts.now ?? new Date())

  return items.filter((item) => {
    if (opts.status !== 'all' && item.status !== opts.status) return false
    if (q && !item.template.toLowerCase().includes(q)) return false
    if (rangeStart) {
      const created = new Date(item.createdAt)
      if (Number.isNaN(created.getTime()) || created < rangeStart) return false
    }
    return true
  })
}

export function mergeActiveAndHistory(opts: {
  active: Array<{
    id: string
    namespace: string
    template: string
    status: string
    createdAt: string
  }>
  history: Array<{
    id: string
    namespace: string
    template: string
    archetype: string
    status: 'terminated' | 'failed'
    createdAt: string
    durationSeconds?: number
    peakRps?: number
    peakP99Ms?: number
  }>
}): PastRunListItem[] {
  const historyNs = new Set(opts.history.map((h) => h.namespace))
  const activeItems: PastRunListItem[] = opts.active
    .filter((a) => a.namespace && !historyNs.has(a.namespace))
    .map((a) => ({
      id: a.id || a.namespace,
      namespace: a.namespace,
      template: a.template || 'unknown',
      archetype: 'live',
      status: 'running' as const,
      createdAt: a.createdAt,
    }))

  const historyItems: PastRunListItem[] = opts.history.map((h) => ({
    id: h.id,
    namespace: h.namespace,
    template: h.template,
    archetype: h.archetype,
    status: h.status,
    createdAt: h.createdAt,
    durationSeconds: h.durationSeconds,
    peakRps: h.peakRps,
    peakP99Ms: h.peakP99Ms,
  }))

  return [...activeItems, ...historyItems].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}
