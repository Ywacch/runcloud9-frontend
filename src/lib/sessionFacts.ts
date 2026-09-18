import type { WsEvent } from '../editor-core/stores/metricsStore'
import {
  isPromotionChaosScenario,
  isPartitionChaosScenario,
  PARTITION_CAP_RULES,
  promotionWalBytesLost,
  type ChaosScenario,
} from './chaos'

export type SessionFactType =
  | 'failover'
  | 'partition'
  | 'reclone'
  | 'chaos_inject'
  | 'error_spike'
  | 'lag_climb'
  | 'invariant_violation'

export interface SessionFact {
  type: SessionFactType
  component: string
  firstSeen: string
  lastSeen: string
  count: number
  payload: unknown
  dismissed: boolean
}

export type SessionFacts = Record<string, SessionFact>

export interface FailoverFactPayload {
  promotionEvent: WsEvent
  lossEvent?: WsEvent
  walBytesLost: number
}

function factKey(type: SessionFactType, component: string, subkey = 'default'): string {
  return `${type}:${component}:${subkey}`
}

function parseChaosScenario(raw: string | undefined): ChaosScenario | null {
  if (!raw) return null
  const scenarios: ChaosScenario[] = [
    'pod_kill',
    'cache_flush',
    'stall_replica',
    'split_primary_replica',
    'split_app_store',
    'promote_replica',
    'promote_lagging_replica',
    'kill_replica',
  ]
  return scenarios.includes(raw as ChaosScenario) ? (raw as ChaosScenario) : null
}

function eventDedupeKey(e: WsEvent): string {
  const ts = Date.parse(e.timestamp)
  const bucket = Number.isFinite(ts) ? Math.floor(ts / 2000) : 0
  return `${e.type}:${e.component ?? ''}:${e.rule ?? e.kind ?? ''}:${bucket}`
}

function upsertFact(
  facts: SessionFacts,
  key: string,
  next: Omit<SessionFact, 'count' | 'dismissed'> & { count?: number },
): void {
  const prev = facts[key]
  facts[key] = {
    ...next,
    count: (prev?.count ?? 0) + (next.count ?? 1),
    dismissed: prev?.dismissed ?? false,
    firstSeen: prev?.firstSeen ?? next.firstSeen,
  }
}

function mergeFailoverPayload(
  prev: FailoverFactPayload | undefined,
  promotionEvent: WsEvent,
  lossEvent?: WsEvent,
): FailoverFactPayload {
  const walBytesLost = Math.max(
    promotionWalBytesLost(promotionEvent.detail),
    lossEvent ? promotionWalBytesLost(lossEvent.detail) : 0,
    prev?.walBytesLost ?? 0,
  )
  const prevWal = prev?.walBytesLost ?? 0
  return {
    promotionEvent:
      walBytesLost > prevWal ? promotionEvent : (prev?.promotionEvent ?? promotionEvent),
    lossEvent: lossEvent ?? prev?.lossEvent,
    walBytesLost,
  }
}

function applyFailoverFact(facts: SessionFacts, e: WsEvent): void {
  const component = e.component ?? 'db'
  const key = factKey('failover', component)
  const prev = facts[key]?.payload as FailoverFactPayload | undefined
  const payload = mergeFailoverPayload(prev, e)
  upsertFact(facts, key, {
    type: 'failover',
    component,
    firstSeen: e.timestamp,
    lastSeen: e.timestamp,
    payload,
  })
}

function applyPartitionFact(facts: SessionFacts, e: WsEvent): void {
  const component = e.component ?? 'db'
  const subkey = e.rule ?? e.detail?.scenario ?? 'default'
  const key = factKey('partition', component, subkey)
  upsertFact(facts, key, {
    type: 'partition',
    component,
    firstSeen: e.timestamp,
    lastSeen: e.timestamp,
    payload: e,
  })
}

function applyRecloneFact(facts: SessionFacts, e: WsEvent): void {
  const component = e.component ?? 'db'
  const key = factKey('reclone', component)
  upsertFact(facts, key, {
    type: 'reclone',
    component,
    firstSeen: e.timestamp,
    lastSeen: e.timestamp,
    payload: e,
  })
}

/** Monotone reducer — facts are only added or updated, never cleared. */
export function reduceSessionFacts(events: WsEvent[]): SessionFacts {
  const facts: SessionFacts = {}
  const seen = new Set<string>()

  for (const e of events) {
    const dedupe = eventDedupeKey(e)
    if (seen.has(dedupe)) continue
    seen.add(dedupe)

    if (e.source === 'chaos' && e.kind === 'chaos_inject') {
      const scenario =
        parseChaosScenario(e.description) ?? parseChaosScenario(e.detail?.scenario)
      if (scenario && isPromotionChaosScenario(scenario)) {
        applyFailoverFact(facts, e)
        continue
      }
      if (scenario && isPartitionChaosScenario(scenario)) {
        applyPartitionFact(facts, e)
        continue
      }
    }

    if (e.rule === 'failover_write_loss') {
      const component = e.component ?? 'db'
      const key = factKey('failover', component)
      const prev = facts[key]?.payload as FailoverFactPayload | undefined
      const promotionEvent = prev?.promotionEvent ?? e
      const payload = mergeFailoverPayload(prev, promotionEvent, e)
      upsertFact(facts, key, {
        type: 'failover',
        component,
        firstSeen: e.timestamp,
        lastSeen: e.timestamp,
        payload,
      })
      continue
    }

    if (
      e.rule &&
      (PARTITION_CAP_RULES as readonly string[]).includes(e.rule)
    ) {
      applyPartitionFact(facts, e)
      continue
    }

    if (e.source === 'chaos' && e.kind === 'standby_reclone') {
      applyRecloneFact(facts, e)
    }
  }

  return facts
}

export function failoverFactForComponent(
  facts: SessionFacts,
  component: string,
): SessionFact | null {
  return facts[factKey('failover', component)] ?? null
}

export function partitionFactForComponent(
  facts: SessionFacts,
  component: string,
): SessionFact | null {
  return (
    Object.values(facts).find(
      (f) => f.type === 'partition' && f.component === component,
    ) ?? null
  )
}

export function recloneFactForComponent(
  facts: SessionFacts,
  component: string,
): SessionFact | null {
  return facts[factKey('reclone', component)] ?? null
}

export function failoverPayloadFromFacts(
  facts: SessionFacts,
  component: string,
): FailoverFactPayload | null {
  const fact = failoverFactForComponent(facts, component)
  if (!fact) return null
  return fact.payload as FailoverFactPayload
}

export function exceptionFactsForComponent(
  facts: SessionFacts,
  component: string,
): SessionFact[] {
  return Object.values(facts).filter(
    (f) =>
      f.component === component &&
      (f.type === 'failover' || f.type === 'partition' || f.type === 'reclone') &&
      !f.dismissed,
  )
}
