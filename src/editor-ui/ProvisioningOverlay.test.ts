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

  it('puts Minimize on the expanded panel and blocks the canvas', () => {
    const html = renderToStaticMarkup(
      createElement(ProvisioningOverlay, {
        elapsedSeconds: 3,
        metricsSummary: null,
        nodes: {},
        onMinimize: () => {},
        onExpand: () => {},
      }),
    )
    expect(html).toContain('Minimize')
    expect(html).toContain('absolute inset-0')
    expect(html).not.toContain('Expand')
  })

  it('renders a non-blocking chip when minimized', () => {
    const html = renderToStaticMarkup(
      createElement(ProvisioningOverlay, {
        elapsedSeconds: 9,
        metricsSummary: null,
        nodes: {},
        minimized: true,
        onMinimize: () => {},
        onExpand: () => {},
        onCancel: () => {},
      }),
    )
    expect(html).toContain('Expand')
    expect(html).toContain('Cancel')
    expect(html).toContain('pointer-events-none')
    expect(html).not.toContain('absolute inset-0')
    expect(html).not.toContain('Minimize')
  })

  it('renders demo data copy and collapsible replica rows', () => {
    const html = renderToStaticMarkup(
      createElement(ProvisioningOverlay, {
        elapsedSeconds: 4,
        metricsSummary: {
          provision_phase: 'deploying',
          component_status: { 'app-1': 'deploying' },
          seeding_status: 'seeding',
          loadgen_status: 'pending',
          provision_detail_code: 'loading_sample_data',
          replica_status: {
            'app-1': [
              { ordinal: 1, ready: true, wait_code: 'ready' },
              { ordinal: 2, ready: false, wait_code: 'pulling_image' },
            ],
          },
        },
        nodes: {
          'app-1': {
            id: 'app-1',
            type: 'compute',
            position: [0, 0, 0],
            label: 'App server',
            config: { replicas: 2 },
            status: 'provisioning',
          },
        },
      }),
    )
    expect(html).toContain('Demo data')
    expect(html).toContain('Loading demo data…')
    expect(html).toContain('Instance 1')
    expect(html).toContain('Instance 2')
    expect(html).toContain('Preparing…')
    expect(html).not.toMatch(/ImagePull|BackOff/i)
    expect(html).toContain('aria-expanded')
  })

  it('shows parent Ready when all replica rows are ready but component_status is still deploying', () => {
    const html = renderToStaticMarkup(
      createElement(ProvisioningOverlay, {
        elapsedSeconds: 6,
        metricsSummary: {
          provision_phase: 'deploying',
          component_status: { 'db-1': 'deploying' },
          seeding_status: 'done',
          loadgen_status: 'pending',
          replica_status: {
            'db-1': [
              { ordinal: 1, ready: true, wait_code: 'ready' },
              { ordinal: 2, ready: true, wait_code: 'ready' },
              { ordinal: 3, ready: true, wait_code: 'ready' },
            ],
          },
        },
        nodes: {
          'db-1': {
            id: 'db-1',
            type: 'database',
            position: [0, 0, 0],
            label: 'PostgreSQL',
            config: { readReplicas: 2 },
            status: 'provisioning',
          },
        },
      }),
    )
    expect(html).toContain('PostgreSQL')
    expect(html).toMatch(/>Ready</)
    expect(html).not.toContain('3 of 3 instances ready')
    expect(html).toContain('text-emerald-400')
  })
})
