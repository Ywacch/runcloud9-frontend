import { describe, expect, it } from 'vitest'
import {
  chaosHealFromWsEvent,
  chaosOverlayFromWsEvent,
  chaosScenariosForTarget,
  isPartitionChaosScenario,
  latestPartitionCapEvent,
  partitionCapSummary,
} from './chaos'
import type { WsEvent } from '../editor-core/stores/metricsStore'

describe('chaosScenariosForTarget', () => {
  it('gates db partition scenarios behind readReplicas', () => {
    expect(chaosScenariosForTarget('db', { readReplicas: 0 })).toEqual(['pod_kill'])
    expect(chaosScenariosForTarget('db', { readReplicas: 2 })).toEqual([
      'pod_kill',
      'stall_replica',
      'split_primary_replica',
      'split_app_store',
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
  })
})
