import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LatencyDistribution } from './LatencyDistribution'

describe('LatencyDistribution', () => {
  it('renders p50, p95, and p99 when provided', () => {
    const html = renderToStaticMarkup(
      createElement(LatencyDistribution, {
        label: 'Feed pull',
        p50Ms: 10,
        p95Ms: 50,
        p99Ms: 80,
      }),
    )
    expect(html).toContain('Feed pull')
    expect(html).toContain('p50')
    expect(html).toContain('p95')
    expect(html).toContain('p99')
    expect(html).toContain('10ms')
    expect(html).toContain('50ms')
    expect(html).toContain('80ms')
  })

  it('returns null when all quantiles are zero or missing', () => {
    const html = renderToStaticMarkup(
      createElement(LatencyDistribution, {
        p50Ms: 0,
        p95Ms: undefined,
        p99Ms: 0,
      }),
    )
    expect(html).toBe('')
  })
})
