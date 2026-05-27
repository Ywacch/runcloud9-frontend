import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { evaluateRequirements, letterFromPercent } from './requirements'

const emptyCtx = {
  metrics: {} as Record<string, MetricsBucket>,
  nodes: {} as Record<string, CanvasNode>,
  inspector: {},
  aggregates: {
    systemP99Ms: 0,
    systemErrorRate: 0,
    throughputRps: 0,
    hasComponentMetrics: false,
  },
  mode: 'live' as const,
}

describe('letterFromPercent', () => {
  it('maps thresholds to letters', () => {
    expect(letterFromPercent(100)).toBe('A')
    expect(letterFromPercent(93)).toBe('A')
    expect(letterFromPercent(92)).toBe('B+')
    expect(letterFromPercent(87)).toBe('B+')
    expect(letterFromPercent(86)).toBe('B')
    expect(letterFromPercent(54)).toBe('F')
  })
})

describe('evaluateRequirements', () => {
  it('returns null when no rubric', () => {
    expect(evaluateRequirements(null, emptyCtx)).toBeNull()
    expect(evaluateRequirements(undefined, emptyCtx)).toBeNull()
    expect(evaluateRequirements('unknown-template', emptyCtx)).toBeNull()
  })

  it('returns scored results for templates with a rubric', () => {
    const out = evaluateRequirements('ecommerce', emptyCtx)
    expect(out).not.toBeNull()
    expect(out!.results.length).toBeGreaterThan(0)
    expect(out!.letter).toMatch(/^[A-Z][+]?$/)
    expect(out!.scorePercent).toBeGreaterThanOrEqual(0)
    expect(out!.scorePercent).toBeLessThanOrEqual(100)
  })
})
