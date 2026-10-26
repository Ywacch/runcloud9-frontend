import type { FidelityTag } from '../../editor-ui/FidelityBadge'
import type { PhenomenonEntry } from './types'
import type { LedgerCacheRecord } from './ledgerCache'

const nf = new Intl.NumberFormat('en-US')

export type ReplyBeforeParentCardModel = {
  title: 'Reply seen before its parent'
  countLabel: string
  rateLabel: string
  denominatorNote: string
  example?: {
    threadId: number
    replyId: number
    parentId: number
    repliesHost: string
    parentsHost: string
    requestId: string
  }
  fidelity: FidelityTag
  incompleteBanner?: string
  staleNote?: string
}

function isFidelity(value: string): value is FidelityTag {
  return value === 'real' || value === 'simulated' || value === 'compressed'
}

function rateDenominatorLabel(denominator: string): string {
  if (denominator === 'all thread reads') return 'thread reads'
  if (denominator === 'observer thread reads in window') return 'thread reads'
  return denominator
}

function formatExpectedRange(expected: PhenomenonEntry['expected']): string | undefined {
  if (!expected) return undefined
  const min = nf.format(Math.round(expected.minPerThousand))
  const max = nf.format(Math.round(expected.maxPerThousand))
  return `expected ${min}–${max}`
}

function formatRateLabel(entry: PhenomenonEntry): string {
  const rate = nf.format(Math.round(entry.baseRate.perThousand))
  const denom = rateDenominatorLabel(entry.baseRate.denominator)
  const base = `${rate} per 1,000 ${denom}`
  const expected = formatExpectedRange(entry.expected)
  return expected ? `${base} (${expected})` : base
}

function observerWindowSeconds(entry: PhenomenonEntry): number | undefined {
  const delays = entry.cause?.replicaApplyDelayMs
  if (!Array.isArray(delays) || delays.length < 2) return undefined
  const nums = delays.map((d) => Number(d)).filter((n) => Number.isFinite(n))
  if (nums.length < 2) return undefined
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const diffMs = max - min
  if (diffMs <= 0) return undefined
  return diffMs / 1000
}

function formatWindowAge(seconds: number): string {
  if (seconds >= 1 && Number.isInteger(seconds)) return `${seconds} s`
  if (seconds >= 1) return `${seconds.toFixed(1)} s`
  return `${Math.round(seconds * 1000)} ms`
}

export function denominatorNoteForEntry(entry: PhenomenonEntry): string {
  const d = entry.baseRate.denominator
  if (d === 'observer thread reads in window') {
    const windowSec = observerWindowSeconds(entry)
    if (windowSec != null) {
      return `Observer reads of threads younger than ${formatWindowAge(windowSec)}`
    }
    return 'Observer reads in the detection window'
  }
  if (d === 'all thread reads') return 'All thread reads counted by the app'
  return d
}

function parseExample(entry: PhenomenonEntry): ReplyBeforeParentCardModel['example'] | undefined {
  const ex = entry.examples?.[0]
  if (!ex?.detail) return undefined
  const threadId = Number(ex.detail.rootId)
  const replyId = Number(ex.detail.replyId)
  const parentId = Number(ex.detail.parentId)
  if (!Number.isFinite(threadId) || !Number.isFinite(replyId) || !Number.isFinite(parentId)) {
    return undefined
  }
  return {
    threadId,
    replyId,
    parentId,
    repliesHost: ex.detail.repliesHost ?? '—',
    parentsHost: ex.detail.parentsHost ?? '—',
    requestId: ex.requestId,
  }
}

function formatStaleNote(at: string): string {
  const parsed = Date.parse(at)
  const time =
    Number.isFinite(parsed)
      ? new Intl.DateTimeFormat('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
        }).format(parsed)
      : at
  return `Showing the last snapshot from ${time} (app unreachable)`
}

function buildFromEntry(
  entry: PhenomenonEntry,
  staleNote?: string,
): ReplyBeforeParentCardModel | null {
  const fidelity = isFidelity(entry.fidelity) ? entry.fidelity : 'simulated'
  const model: ReplyBeforeParentCardModel = {
    title: 'Reply seen before its parent',
    countLabel: `${nf.format(entry.cost.readsAffected)} reads affected`,
    rateLabel: formatRateLabel(entry),
    denominatorNote: denominatorNoteForEntry(entry),
    fidelity,
    example: parseExample(entry),
  }
  if (entry.detectionMayBeIncomplete) {
    model.incompleteBanner =
      'Detection may be incomplete: the load generator fell behind.'
  }
  if (staleNote) model.staleNote = staleNote
  return model
}

export function buildReplyBeforeParentCard(
  entry: PhenomenonEntry | undefined,
  cached: LedgerCacheRecord | undefined,
): ReplyBeforeParentCardModel | null {
  if (entry) return buildFromEntry(entry)
  if (cached?.entry) return buildFromEntry(cached.entry, formatStaleNote(cached.at))
  return null
}
