import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import {
  formatProvisionStripClock,
  provisionFloorLineForNode,
  provisionGlyphPhaseForNode,
  provisionStripCopy,
} from './provisionFloorVisual'
import type { ParsedProvisionMetrics } from './provisionMetrics'

function node(
  id: string,
  type: CanvasNode['type'],
  extra: Partial<CanvasNode> = {},
): CanvasNode {
  return {
    id,
    type,
    position: [0, 0, 0],
    label: id,
    config: {},
    status: 'idle',
    ...extra,
  }
}

describe('formatProvisionStripClock', () => {
  it('formats m:ss', () => {
    expect(formatProvisionStripClock(0)).toBe('0:00')
    expect(formatProvisionStripClock(75)).toBe('1:15')
  })
})

describe('provisionGlyphPhaseForNode', () => {
  it('ghosts pending, pulses deploying, settles ready', () => {
    const app = node('app-1', 'compute', { config: { replicas: 3 } })
    const parsed: ParsedProvisionMetrics = {
      provisionPhase: 'deploying',
      componentStatus: { 'app-1': 'pending' },
      replicaStatus: {},
    }
    expect(provisionGlyphPhaseForNode(app, parsed, true)).toBe('pending')
    parsed.componentStatus['app-1'] = 'deploying'
    expect(provisionGlyphPhaseForNode(app, parsed, true)).toBe('building')
    parsed.componentStatus['app-1'] = 'ready'
    expect(provisionGlyphPhaseForNode(app, parsed, true)).toBe('ready')
    expect(provisionGlyphPhaseForNode(app, parsed, false)).toBe('off')
  })
})

describe('provisionFloorLineForNode', () => {
  it('shows N of M for replica groups without per-pod copy', () => {
    const app = node('app-1', 'compute', { config: { replicas: 3 } })
    const parsed: ParsedProvisionMetrics = {
      provisionPhase: 'deploying',
      componentStatus: { 'app-1': 'deploying' },
      replicaStatus: {
        'app-1': [
          { ordinal: 1, ready: true, waitCode: 'ready' },
          { ordinal: 2, ready: false, waitCode: 'starting' },
        ],
      },
    }
    expect(provisionFloorLineForNode(app, parsed)).toBe(
      'Starting… · 1 of 3 instances ready',
    )
  })

  it('uses Waiting for pending ghosts', () => {
    const db = node('db-1', 'database')
    expect(
      provisionFloorLineForNode(db, {
        provisionPhase: 'deploying',
        componentStatus: { 'db-1': 'pending' },
        replicaStatus: {},
      }),
    ).toBe('Waiting…')
  })
})

describe('provisionStripCopy', () => {
  it('uses typical wait after admit, not invented cluster percents', () => {
    const copy = provisionStripCopy({
      parsed: {
        provisionPhase: 'deploying',
        componentStatus: {},
        replicaStatus: {},
        provisionDetailCode: 'pulling_image',
      },
      nodes: {},
      elapsedSeconds: 12,
      isQueued: false,
      isTerminating: false,
      queuePosition: null,
      estimatedWaitSeconds: null,
    })
    expect(copy.step).toBe('Preparing services…')
    expect(copy.estimate).toContain('2–3 minutes')
    expect(JSON.stringify(copy)).not.toMatch(/GKE|cluster|%/i)
  })
})
