import { describe, expect, it } from 'vitest'
import {
  isWaitingForProvisionSlot,
  metricsSummaryHasContractFields,
  padReplicaWaitRows,
  parseProvisionMetrics,
  shouldLingerProvisionOverlay,
  shouldUseLegacyProvisioningPulse,
} from './provisionMetrics'

const fullContract = {
  provision_phase: 'running',
  component_status: { 'app-1': 'ready' },
  seeding_status: 'done',
  loadgen_status: 'ready',
}

describe('isWaitingForProvisionSlot', () => {
  it('detects doorway wait phase from snake_case metrics', () => {
    const parsed = parseProvisionMetrics({
      provision_phase: 'waiting_for_provision_slot',
    })
    expect(isWaitingForProvisionSlot(parsed?.provisionPhase)).toBe(true)
    expect(isWaitingForProvisionSlot('deploying')).toBe(false)
    expect(isWaitingForProvisionSlot(undefined)).toBe(false)
  })
})

describe('parseProvisionMetrics loadgen_status', () => {
  it('parses snake_case loadgen_status', () => {
    const parsed = parseProvisionMetrics({
      ...fullContract,
      loadgen_status: 'failed',
    })
    expect(parsed?.loadgenStatus).toBe('failed')
  })

  it('parses camelCase loadgenStatus', () => {
    const parsed = parseProvisionMetrics({
      provisionPhase: 'running',
      componentStatus: { 'app-1': 'ready' },
      seedingStatus: 'done',
      loadgenStatus: 'skipped',
    })
    expect(parsed?.loadgenStatus).toBe('skipped')
  })

  it('leaves loadgenStatus undefined when key is missing', () => {
    const parsed = parseProvisionMetrics({
      provision_phase: 'running',
      component_status: { 'app-1': 'ready' },
      seeding_status: 'done',
    })
    expect(parsed?.loadgenStatus).toBeUndefined()
  })

  it('normalizes unknown loadgen values', () => {
    const parsed = parseProvisionMetrics({
      ...fullContract,
      loadgen_status: 'broken',
    })
    expect(parsed?.loadgenStatus).toBe('unknown')
  })
})

describe('metricsSummaryHasContractFields', () => {
  it('requires loadgen_status for contract checklist', () => {
    expect(metricsSummaryHasContractFields(fullContract)).toBe(true)
    expect(
      metricsSummaryHasContractFields({
        provision_phase: 'running',
        component_status: { 'app-1': 'ready' },
        seeding_status: 'done',
      }),
    ).toBe(false)
  })

  it('accepts camelCase loadgenStatus', () => {
    expect(
      metricsSummaryHasContractFields({
        provisionPhase: 'running',
        componentStatus: { 'app-1': 'ready' },
        seedingStatus: 'done',
        loadgenStatus: 'ready',
      }),
    ).toBe(true)
  })
})

describe('shouldUseLegacyProvisioningPulse', () => {
  it('uses legacy pulse until loadgen_status is present', () => {
    expect(
      shouldUseLegacyProvisioningPulse({
        provision_phase: 'running',
        component_status: { 'app-1': 'ready' },
        seeding_status: 'done',
      }),
    ).toBe(true)
    expect(shouldUseLegacyProvisioningPulse(fullContract)).toBe(false)
  })
})

describe('parseProvisionMetrics replica_status and detail code', () => {
  it('parses snake_case replica rows and provision_detail_code', () => {
    const parsed = parseProvisionMetrics({
      ...fullContract,
      provision_detail_code: 'pulling_image',
      replica_status: {
        'app-1': [
          { ordinal: 1, ready: true, wait_code: 'ready' },
          { ordinal: 2, ready: false, wait_code: 'pulling_image' },
        ],
      },
    })
    expect(parsed?.provisionDetailCode).toBe('pulling_image')
    expect(parsed?.replicaStatus['app-1']).toEqual([
      { ordinal: 1, ready: true, waitCode: 'ready' },
      { ordinal: 2, ready: false, waitCode: 'pulling_image' },
    ])
  })

  it('accepts camelCase replicaStatus and provisionDetailCode', () => {
    const parsed = parseProvisionMetrics({
      provisionPhase: 'deploying',
      componentStatus: { 'app-1': 'deploying' },
      seedingStatus: 'seeding',
      loadgenStatus: 'pending',
      provisionDetailCode: 'loading_sample_data',
      replicaStatus: {
        'app-1': [{ ordinal: 1, ready: false, waitCode: 'starting' }],
      },
    })
    expect(parsed?.provisionDetailCode).toBe('loading_sample_data')
    expect(parsed?.replicaStatus['app-1']?.[0]?.waitCode).toBe('starting')
  })
})

describe('shouldLingerProvisionOverlay', () => {
  it('returns false when both seed and loadgen are skipped', () => {
    expect(
      shouldLingerProvisionOverlay(
        parseProvisionMetrics({
          ...fullContract,
          seeding_status: 'skipped',
          loadgen_status: 'skipped',
        }),
      ),
    ).toBe(false)
  })

  it('returns true when seed and loadgen are terminal', () => {
    expect(shouldLingerProvisionOverlay(parseProvisionMetrics(fullContract))).toBe(
      true,
    )
  })
})

describe('padReplicaWaitRows', () => {
  it('returns N pending rows when replica_status is empty', () => {
    expect(padReplicaWaitRows(undefined, 3)).toEqual([
      { ordinal: 1, ready: false, waitCode: 'pending' },
      { ordinal: 2, ready: false, waitCode: 'pending' },
      { ordinal: 3, ready: false, waitCode: 'pending' },
    ])
  })

  it('pads missing ordinals when only primary is in replica_status', () => {
    expect(
      padReplicaWaitRows(
        [{ ordinal: 1, ready: false, waitCode: 'starting' }],
        3,
      ),
    ).toEqual([
      { ordinal: 1, ready: false, waitCode: 'starting' },
      { ordinal: 2, ready: false, waitCode: 'pending' },
      { ordinal: 3, ready: false, waitCode: 'pending' },
    ])
  })

  it('leaves all live rows unchanged when count matches expected', () => {
    const live = [
      { ordinal: 1, ready: true, waitCode: 'ready' },
      { ordinal: 2, ready: true, waitCode: 'ready' },
      { ordinal: 3, ready: true, waitCode: 'ready' },
    ]
    expect(padReplicaWaitRows(live, 3)).toEqual(live)
  })

  it('returns rows as-is when expectedCount is zero', () => {
    const live = [{ ordinal: 1, ready: true, waitCode: 'ready' }]
    expect(padReplicaWaitRows(live, 0)).toEqual(live)
  })
})
