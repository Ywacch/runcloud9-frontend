import { FMT_EMPTY, fmtInt, fmtRate } from './format'

export interface TimelineOpsSnapshot {
  engine: string
  appendRate?: number
  appendP99Ms?: number
  rangeP99Ms?: number
  errorRate?: number
}

export function parseTimelineOps(raw: unknown): TimelineOpsSnapshot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const engine = typeof o.engine === 'string' ? o.engine.trim() : ''
  if (!engine) return null
  const num = (key: string) => {
    const v = o[key]
    return typeof v === 'number' && Number.isFinite(v) ? v : undefined
  }
  return {
    engine,
    appendRate: num('appendRate'),
    appendP99Ms: num('appendP99Ms'),
    rangeP99Ms: num('rangeP99Ms'),
    errorRate: num('errorRate'),
  }
}

export interface TimelineCostInputs {
  engine: string
  timelineKeyCount?: number
  evictionsLive?: number
  evictionsSession?: number
  relationBytes?: number
  deadTuples?: number
}

export interface TimelineOpsViewModel {
  engine: string
  appendRate: string
  appendP99Ms: string
  rangeP99Ms: string
  errorRate: string
  costPrimaryLabel: string
  costPrimaryValue: string
  costSecondaryLabel: string
  costSecondaryValue: string
}

export function buildTimelineOpsViewModel(
  ops: TimelineOpsSnapshot | null | undefined,
  cost: TimelineCostInputs,
  timeframe: 'live' | 'session',
): TimelineOpsViewModel | null {
  if (!ops?.engine) return null
  const ms = (v?: number) => (v != null && v > 0 ? `${Math.round(v)} ms` : FMT_EMPTY)
  const rate = (v?: number) => (v != null && v >= 0 ? `${fmtRate(v)}/s` : FMT_EMPTY)
  const err = (v?: number) => (v != null && v >= 0 ? `${fmtRate(v)}/s` : FMT_EMPTY)

  const isPostgres = ops.engine === 'postgresql' || ops.engine === 'postgres'
  let costPrimaryLabel = 'timelines'
  let costPrimaryValue = FMT_EMPTY
  let costSecondaryLabel = 'evictions'
  let costSecondaryValue = FMT_EMPTY

  if (isPostgres) {
    costPrimaryLabel = 'table size'
    costPrimaryValue =
      cost.relationBytes != null && cost.relationBytes > 0
        ? fmtInt(Math.round(cost.relationBytes / 1024))
        : FMT_EMPTY
    costSecondaryLabel = 'dead tuples'
    costSecondaryValue =
      cost.deadTuples != null ? fmtInt(Math.round(cost.deadTuples)) : FMT_EMPTY
  } else {
    costPrimaryValue =
      cost.timelineKeyCount != null ? fmtInt(cost.timelineKeyCount) : FMT_EMPTY
    costSecondaryValue =
      timeframe === 'session'
        ? fmtInt(cost.evictionsSession ?? 0)
        : `${fmtRate(cost.evictionsLive ?? 0)}/s`
  }

  return {
    engine: ops.engine,
    appendRate: rate(ops.appendRate),
    appendP99Ms: ms(ops.appendP99Ms),
    rangeP99Ms: ms(ops.rangeP99Ms),
    errorRate: err(ops.errorRate),
    costPrimaryLabel,
    costPrimaryValue,
    costSecondaryLabel,
    costSecondaryValue,
  }
}
