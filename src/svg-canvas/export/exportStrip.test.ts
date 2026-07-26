import { describe, expect, it } from 'vitest'
import { EXPORT_STRIP_QUERY, shouldStripFromExport } from './exportStrip'

function el(
  partial: { id?: string; attrs?: Record<string, string> },
): {
  id?: string
  getAttribute: (name: string) => string | null
} {
  return {
    id: partial.id,
    getAttribute: (name) =>
      partial.attrs && name in partial.attrs
        ? (partial.attrs[name] ?? null)
        : null,
  }
}

describe('exportStrip', () => {
  it('strips the interaction layer by id', () => {
    expect(shouldStripFromExport(el({ id: 'interactionLayer' }))).toBe(true)
  })

  it('strips marked export-strip and transient FX nodes', () => {
    expect(
      shouldStripFromExport(el({ attrs: { 'data-export-strip': '' } })),
    ).toBe(true)
    expect(
      shouldStripFromExport(el({ attrs: { 'data-health-rim': '' } })),
    ).toBe(true)
    expect(
      shouldStripFromExport(el({ attrs: { 'data-traffic-layer': '' } })),
    ).toBe(true)
    expect(
      shouldStripFromExport(
        el({ attrs: { 'data-walkthrough-node-overlay': '' } }),
      ),
    ).toBe(true)
  })

  it('keeps node label chrome for normal canvas downloads', () => {
    expect(
      shouldStripFromExport(el({ attrs: { 'data-node-label-chrome': 'true' } })),
    ).toBe(false)
  })

  it('keeps floor and diagram content', () => {
    expect(
      shouldStripFromExport(
        el({ attrs: { 'data-floor': 'infinite', 'data-floor-theme': 'dark' } }),
      ),
    ).toBe(false)
    expect(shouldStripFromExport(el({ attrs: { 'data-edge-layer': '' } }))).toBe(
      false,
    )
  })

  it('query covers interaction + FX selectors', () => {
    expect(EXPORT_STRIP_QUERY).toContain('#interactionLayer')
    expect(EXPORT_STRIP_QUERY).toContain('[data-export-strip]')
    expect(EXPORT_STRIP_QUERY).toContain('[data-health-rim]')
  })
})
