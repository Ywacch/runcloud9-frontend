import { fmtBytes } from '../lib/format'
import {
  failoverLossEscalation,
  failoverReadoutSummary,
  standbyRecloneHints,
} from '../lib/chaos'
import type { ReplicationMode, SyncCommitLevel } from '../lib/replicaConfig'
import type { SessionFact, SessionFacts } from '../lib/sessionFacts'
import {
  exceptionFactsForComponent,
  type FailoverFactPayload,
} from '../lib/sessionFacts'
import { InlineDisclosure } from './InlineDisclosure'

function formatPartitionRule(rule: string | undefined): string {
  if (rule === 'partition_stale_reads') return 'Stale replica reads'
  if (rule === 'partition_write_stall') return 'Writes stalling'
  return 'Partition'
}

function FailoverException({
  fact,
  replicationMode,
  syncCommitLevel,
}: {
  fact: SessionFact
  replicationMode: ReplicationMode
  syncCommitLevel: SyncCommitLevel
}) {
  const payload = fact.payload as FailoverFactPayload
  const promotionEvent = payload.promotionEvent
  const lossEvent = payload.lossEvent
  const walBytesLost = payload.walBytesLost
  const promotedPod = promotionEvent.detail?.promotedPod?.trim()
  const candidateLagBytes = Number(promotionEvent.detail?.candidateLagBytes ?? '')
  const summary = failoverReadoutSummary(
    promotionEvent,
    lossEvent ?? null,
    replicationMode,
    syncCommitLevel,
  )
  const escalation = failoverLossEscalation(lossEvent ?? null)
  const time = fact.firstSeen.replace('T', ' ').replace('Z', '').slice(0, 19)

  return (
    <section
      className="rounded border border-amber-500/40 bg-amber-950/20 px-3 py-2.5"
      data-testid="inspector-exception-failover"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-200">
        Failover · {time}
      </p>
      <p className="mt-1 text-[12px] text-amber-50/95">
        primary → <span className="font-mono">{promotedPod || 'standby'}</span>
      </p>
      <p className="mt-0.5 text-[11px] text-amber-100/80">
        {walBytesLost > 0
          ? `${fmtBytes(walBytesLost)} of acknowledged writes lost`
          : '0 B lost — semi-sync held the write'}
        {Number.isFinite(candidateLagBytes) && candidateLagBytes >= 0
          ? ` · lag at pick ${fmtBytes(candidateLagBytes)}`
          : ''}
      </p>
      {summary || escalation ? (
        <InlineDisclosure label="What happened?">
          <div className="space-y-1 text-[11px] leading-relaxed text-amber-100/90">
            {summary ? <p>{summary}</p> : null}
            {escalation ? <p>{escalation}</p> : null}
          </div>
        </InlineDisclosure>
      ) : null}
    </section>
  )
}

function PartitionException({ fact }: { fact: SessionFact }) {
  const event = fact.payload as { rule?: string; title?: string }
  const time = fact.firstSeen.replace('T', ' ').replace('Z', '').slice(0, 19)
  return (
    <section
      className="rounded border border-violet-500/35 bg-violet-950/20 px-3 py-2.5"
      data-testid="inspector-exception-partition"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-200">
        Partition · {time}
      </p>
      <p className="mt-1 text-[12px] text-violet-50/95">
        {formatPartitionRule(event.rule) || event.title || 'Consistency degraded'}
      </p>
    </section>
  )
}

function RecloneException({ fact }: { fact: SessionFact }) {
  const event = fact.payload as import('../editor-core/stores/metricsStore').WsEvent
  const hints = standbyRecloneHints(event)
  const time = fact.firstSeen.replace('T', ' ').replace('Z', '').slice(0, 19)
  return (
    <section
      className="rounded border border-cyan-500/35 bg-cyan-950/20 px-3 py-2.5"
      data-testid="inspector-exception-reclone"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200">
        Standby rebuild · {time}
      </p>
      {hints.map((hint) => (
        <p key={hint} className="mt-1 text-[11px] text-cyan-50/90">{hint}</p>
      ))}
    </section>
  )
}

export function InspectorExceptionStrip({
  component,
  facts,
  replicationMode = 'async',
  syncCommitLevel = 'on',
}: {
  component: string
  facts: SessionFacts
  replicationMode?: ReplicationMode
  syncCommitLevel?: SyncCommitLevel
}) {
  const items = exceptionFactsForComponent(facts, component)
  if (items.length === 0) return null

  return (
    <div className="space-y-2">
      {items.map((fact) => {
        if (fact.type === 'failover') {
          return (
            <FailoverException
              key={`${fact.type}:${fact.firstSeen}`}
              fact={fact}
              replicationMode={replicationMode}
              syncCommitLevel={syncCommitLevel}
            />
          )
        }
        if (fact.type === 'partition') {
          return (
            <PartitionException key={`${fact.type}:${fact.firstSeen}`} fact={fact} />
          )
        }
        if (fact.type === 'reclone') {
          return (
            <RecloneException key={`${fact.type}:${fact.firstSeen}`} fact={fact} />
          )
        }
        return null
      })}
    </div>
  )
}
