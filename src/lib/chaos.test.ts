import { describe, expect, it } from 'vitest'
import {
  chaosHealFromWsEvent,
  chaosOverlayFromWsEvent,
  chaosScenarioConfirm,
  chaosScenariosForTarget,
  failoverReadoutSummary,
  isPartitionChaosScenario,
  isPromotionChaosScenario,
  latestFailoverWriteLossEvent,
  latestPartitionCapEvent,
  latestPromotionChaosInjectEvent,
  partitionCapSummary,
  promotionWalBytesLost,
} from './chaos'
import type { WsEvent } from '../editor-core/stores/metricsStore'

describe('chaosScenariosForTarget', () => {
  it('gates db replica scenarios behind readReplicas', () => {
    expect(chaosScenariosForTarget('db', { readReplicas: 0 })).toEqual(['pod_kill'])
    expect(chaosScenariosForTarget('db', { readReplicas: 1 })).toEqual([
      'pod_kill',
      'stall_replica',
      'split_primary_replica',
      'split_app_store',
      'promote_replica',
      'promote_lagging_replica',
      'kill_replica',
    ])
    expect(chaosScenariosForTarget('db', { readReplicas: 2 })).toEqual([
      'pod_kill',
      'stall_replica',
      'split_primary_replica',
      'split_app_store',
      'promote_replica',
      'promote_lagging_replica',
      'kill_replica',
    ])
  })

  it('includes split_app_store on cache', () => {
    expect(chaosScenariosForTarget('cache')).toEqual([
      'pod_kill',
      'cache_flush',
      'split_app_store',
    ])
  })
})

describe('chaosOverlayFromWsEvent', () => {
  it('maps partition inject events', () => {
    const overlay = chaosOverlayFromWsEvent({
      source: 'chaos',
      kind: 'chaos_inject',
      component: 'db',
      description: 'stall_replica',
      timestamp: '2026-01-01T00:00:00.000Z',
    })
    expect(overlay?.scenario).toBe('stall_replica')
    expect(overlay?.targetComponent).toBe('db')
  })

  it('ignores heal events', () => {
    expect(
      chaosOverlayFromWsEvent({
        source: 'chaos',
        kind: 'chaos_heal',
        component: 'db',
        description: 'stall_replica',
      }),
    ).toBeNull()
  })
})

describe('chaosHealFromWsEvent', () => {
  it('detects heal', () => {
    expect(
      chaosHealFromWsEvent({ source: 'chaos', kind: 'chaos_heal' }),
    ).toBe(true)
    expect(
      chaosHealFromWsEvent({ source: 'chaos', kind: 'chaos_inject' }),
    ).toBe(false)
  })
})

describe('partition CAP helpers', () => {
  it('finds latest partition cap event', () => {
    const events: WsEvent[] = [
      {
        timestamp: 't1',
        type: 'invariant',
        source: 'detector',
        title: 'other',
        description: '',
        rule: 'ryw_violation',
      },
      {
        timestamp: 't2',
        type: 'invariant',
        source: 'detector',
        title: 'stale',
        description: '',
        rule: 'partition_stale_reads',
        detail: { capTradeoff: 'availability_over_consistency' },
      },
    ]
    expect(latestPartitionCapEvent(events)?.rule).toBe('partition_stale_reads')
  })

  it('summarizes semi-sync stale reads with remote_apply', () => {
    const summary = partitionCapSummary(
      {
        timestamp: 't',
        type: 'invariant',
        source: 'detector',
        title: 'Consistency degraded under partition',
        description: '',
        rule: 'partition_stale_reads',
        detail: { capTradeoff: 'availability_over_consistency' },
      },
      'semi-sync',
      2,
      'remote_apply',
      'db',
    )
    expect(summary).toContain('acked standby')
    expect(summary).toContain('not the replica you read')
  })

  it('summarizes semi-sync write stall on split', () => {
    const summary = partitionCapSummary(
      {
        timestamp: 't',
        type: 'invariant',
        source: 'detector',
        title: 'Writes stalling under partition',
        description: '',
        rule: 'partition_write_stall',
      },
      'semi-sync',
      2,
      'on',
      'none',
    )
    expect(summary).toContain('No standby could confirm')
  })
})

describe('isPartitionChaosScenario', () => {
  it('classifies partition scenarios', () => {
    expect(isPartitionChaosScenario('stall_replica')).toBe(true)
    expect(isPartitionChaosScenario('pod_kill')).toBe(false)
    expect(isPartitionChaosScenario('promote_replica')).toBe(false)
    expect(isPartitionChaosScenario('promote_lagging_replica')).toBe(false)
    expect(isPartitionChaosScenario('kill_replica')).toBe(false)
  })
})

describe('promotion chaos helpers', () => {
  const promotionInject: WsEvent = {
    timestamp: 't-promote',
    type: 'action',
    source: 'chaos',
    kind: 'chaos_inject',
    component: 'db',
    title: 'Promote replica',
    description: 'promote_replica',
    detail: {
      scenario: 'promote_replica',
      targetComponent: 'db',
      promotedPod: 'postgres-replica-0',
      candidateSyncState: 'sync',
      candidateLagBytes: '0',
      walBytesLost: '0',
      replicationMode: 'semi-sync',
      syncCommitLevel: 'remote_apply',
    },
  }

  it('finds latest promotion chaos_inject', () => {
    const events: WsEvent[] = [
      {
        timestamp: 't1',
        type: 'action',
        source: 'chaos',
        kind: 'chaos_inject',
        title: 'Kill pod',
        description: 'pod_kill',
      },
      promotionInject,
    ]
    expect(latestPromotionChaosInjectEvent(events)?.description).toBe('promote_replica')
  })

  it('finds latest failover_write_loss invariant', () => {
    const events: WsEvent[] = [
      promotionInject,
      {
        timestamp: 't-loss',
        type: 'invariant',
        source: 'chaos',
        title: 'Failover write loss',
        description: 'Promoted postgres-replica-1 was 4096 bytes behind',
        rule: 'failover_write_loss',
        detail: {
          scenario: 'promote_lagging_replica',
          promotedPod: 'postgres-replica-1',
          syncState: 'async',
          walBytesLost: '4096',
        },
      },
    ]
    expect(latestFailoverWriteLossEvent(events)?.rule).toBe('failover_write_loss')
  })

  it('summarizes zero-loss remote_apply promotion', () => {
    const summary = failoverReadoutSummary(
      promotionInject,
      null,
      'semi-sync',
      'remote_apply',
    )
    expect(summary).toContain('remote_apply')
    expect(summary).toContain('nothing the client already saw was lost')
  })

  it('summarizes lossy promotion and parses wal bytes', () => {
    const lossEvent: WsEvent = {
      timestamp: 't-loss',
      type: 'invariant',
      source: 'chaos',
      title: 'Failover write loss',
      description: 'Promoted postgres-replica-1 was 4096 bytes behind',
      rule: 'failover_write_loss',
    }
    const lossyInject: WsEvent = {
      ...promotionInject,
      description: 'promote_lagging_replica',
      detail: {
        ...promotionInject.detail,
        scenario: 'promote_lagging_replica',
        candidateSyncState: 'async',
        walBytesLost: '4096',
      },
    }
    expect(promotionWalBytesLost(lossyInject.detail)).toBe(4096)
    const summary = failoverReadoutSummary(
      lossyInject,
      lossEvent,
      'async',
      'on',
    )
    expect(summary).toContain('farthest-behind standby')
  })
})

describe('promotion confirm copy', () => {
  it('states irreversibility for promotions', () => {
    expect(chaosScenarioConfirm('promote_replica', 'db')).toContain('cannot be undone')
    expect(chaosScenarioConfirm('promote_replica', 'db')).toContain('will not come back')
    expect(chaosScenarioConfirm('promote_lagging_replica', 'db')).toContain('cannot be undone')
  })

  it('names re-clone cost for kill_replica', () => {
    expect(chaosScenarioConfirm('kill_replica', 'db')).toContain('pg_basebackup')
    expect(chaosScenarioConfirm('kill_replica', 'db')).toContain('stall_replica')
  })
})

describe('isPromotionChaosScenario', () => {
  it('classifies promotion scenarios', () => {
    expect(isPromotionChaosScenario('promote_replica')).toBe(true)
    expect(isPromotionChaosScenario('promote_lagging_replica')).toBe(true)
    expect(isPromotionChaosScenario('kill_replica')).toBe(false)
  })
})
