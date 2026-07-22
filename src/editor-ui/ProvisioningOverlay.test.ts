import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ProvisioningOverlay } from './ProvisioningOverlay'

describe('ProvisioningOverlay', () => {
  it('shows doorway wait position and ETA detail', () => {
    const html = renderToStaticMarkup(
      createElement(ProvisioningOverlay, {
        elapsedSeconds: 12,
        metricsSummary: {
          provision_phase: 'waiting_for_provision_slot',
        },
        nodes: {},
        queuePosition: 1,
        estimatedWaitSeconds: 40,
      }),
    )
    expect(html).toContain('Almost ready')
    expect(html).toContain('#1. About ~40s.')
    expect(html).not.toContain('Waiting for a provision slot')
    expect(html).not.toContain('Waiting for room')
  })

  it('falls back when doorway wait has no queue fields', () => {
    const html = renderToStaticMarkup(
      createElement(ProvisioningOverlay, {
        elapsedSeconds: 5,
        metricsSummary: {
          provision_phase: 'waiting_for_provision_slot',
        },
        nodes: {},
      }),
    )
    expect(html).toContain('Almost ready')
    expect(html).toContain('A few deploys are starting ahead of you.')
  })

  it('keeps room queue title distinct from doorway wait', () => {
    const html = renderToStaticMarkup(
      createElement(ProvisioningOverlay, {
        elapsedSeconds: 8,
        metricsSummary: null,
        nodes: {},
        isQueued: true,
        queuePosition: 2,
        estimatedWaitSeconds: 120,
      }),
    )
    expect(html).toContain('Waiting for room')
    expect(html).toContain('Smaller deploys may start first')
    expect(html).toContain('About ~2m.')
    expect(html).not.toContain('#2.')
    expect(html).not.toContain('Almost ready')
  })
})
