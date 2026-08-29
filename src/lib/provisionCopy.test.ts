import { describe, expect, it } from 'vitest'
import {
  componentStatusToUserLine,
  DEMO_DATA_ROW_TITLE,
  instanceLabelForNode,
  provisionDetailCodeToSubtitle,
  seedingStatusToUserLine,
  waitCodeToUserLine,
} from './provisionCopy'

describe('waitCodeToUserLine', () => {
  it('maps pulling_image to Preparing without kube jargon', () => {
    const line = waitCodeToUserLine('pulling_image')
    expect(line.status).toBe('Preparing…')
    expect(line.detail).toContain('30–60 seconds')
    expect(JSON.stringify(line)).not.toMatch(/ImagePull|BackOff/i)
  })

  it('maps timeout to Stalled', () => {
    expect(waitCodeToUserLine('timeout').status).toBe('Stalled')
  })

  it('falls back to Checking status for unknown codes', () => {
    expect(waitCodeToUserLine('ImagePullBackOff').status).toBe('Checking status…')
  })
})

describe('seedingStatusToUserLine', () => {
  it('uses Loading demo data for seeding', () => {
    const line = seedingStatusToUserLine('seeding')
    expect(line.status).toBe('Loading demo data…')
    expect(line.status).not.toMatch(/Not started|Seeding/i)
  })
})

describe('provisionDetailCodeToSubtitle', () => {
  it('maps loading_sample_data to demo data copy', () => {
    expect(provisionDetailCodeToSubtitle('loading_sample_data')).toBe(
      'Loading demo data…',
    )
  })
})

describe('instanceLabelForNode', () => {
  it('labels postgres primary and read replicas', () => {
    expect(instanceLabelForNode('db', 1)).toBe('Primary')
    expect(instanceLabelForNode('db', 2)).toBe('Read replica 1')
    expect(instanceLabelForNode('app-server', 2)).toBe('Instance 2')
  })
})

describe('componentStatusToUserLine', () => {
  it('shows Ready when deploying but every replica row is ready', () => {
    const line = componentStatusToUserLine('deploying', [
      { ordinal: 1, ready: true, waitCode: 'ready' },
      { ordinal: 2, ready: true, waitCode: 'ready' },
      { ordinal: 3, ready: true, waitCode: 'ready' },
    ])
    expect(line.status).toBe('Ready')
    expect(line.detail).toBeUndefined()
  })

  it('keeps instance progress while any replica is not ready', () => {
    const line = componentStatusToUserLine('deploying', [
      { ordinal: 1, ready: true, waitCode: 'ready' },
      { ordinal: 2, ready: false, waitCode: 'starting' },
    ])
    expect(line.status).toBe('Starting…')
    expect(line.detail).toBe('1 of 2 instances ready')
  })

  it('shows Starting when deploying without replica rows', () => {
    expect(componentStatusToUserLine('deploying', undefined).status).toBe(
      'Starting…',
    )
  })
})

describe('DEMO_DATA_ROW_TITLE', () => {
  it('is locked to Demo data', () => {
    expect(DEMO_DATA_ROW_TITLE).toBe('Demo data')
  })
})
