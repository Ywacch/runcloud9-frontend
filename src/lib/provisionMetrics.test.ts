import { describe, expect, it } from 'vitest'
import {
  isWaitingForProvisionSlot,
  metricsSummaryHasContractFields,
  parseProvisionMetrics,
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
