import { describe, expect, it } from 'vitest'
import { defaultEdgeStyle } from '../store/svgTypes'
import { resolveEdgePaint } from './edgePresets'

describe('resolveEdgePaint', () => {
  it('keeps flow colors from edge style', () => {
    const style = { ...defaultEdgeStyle(), color: '#3b82f6', dash: '8,6' as const }
    const paint = resolveEdgePaint(style, 'flow', 'dark')
    expect(paint.color).toBe('#3b82f6')
    expect(paint.dash).toBe('8,6')
    expect(paint.showJunctions).toBe(true)
  })

  it('uses light wires on dark floor for schematic', () => {
    const paint = resolveEdgePaint(defaultEdgeStyle(), 'schematic', 'dark')
    expect(paint.color).toBe('#e8e8ea')
    expect(paint.width).toBeGreaterThanOrEqual(2)
    expect(paint.showJunctions).toBe(true)
  })

  it('uses black wires on light floor for schematic', () => {
    const paint = resolveEdgePaint(defaultEdgeStyle(), 'schematic', 'light')
    expect(paint.color).toBe('#0a0a0a')
  })
})
