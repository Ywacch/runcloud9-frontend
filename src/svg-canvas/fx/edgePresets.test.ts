import { describe, expect, it } from 'vitest'
import { defaultEdgeStyle } from '../store/svgTypes'
import {
  FLOW_COLOR_DARK,
  FLOW_COLOR_LIGHT,
  resolveEdgePaint,
} from './edgePresets'

describe('resolveEdgePaint', () => {
  it('uses a brighter flow stroke on dark floors', () => {
    const paint = resolveEdgePaint(defaultEdgeStyle(), 'flow', 'dark')
    expect(paint.color).toBe(FLOW_COLOR_DARK)
    expect(paint.width).toBeGreaterThanOrEqual(2)
  })

  it('keeps the slate flow stroke on light floors', () => {
    const paint = resolveEdgePaint(defaultEdgeStyle(), 'flow', 'light')
    expect(paint.color).toBe(FLOW_COLOR_LIGHT)
  })

  it('preserves custom non-default flow colors', () => {
    const style = { ...defaultEdgeStyle(), color: '#3b82f6', dash: '8,6' as const }
    const paint = resolveEdgePaint(style, 'flow', 'dark')
    expect(paint.color).toBe('#3b82f6')
    expect(paint.dash).toBe('8,6')
  })

  it('uses light wires on dark floor for schematic', () => {
    const paint = resolveEdgePaint(defaultEdgeStyle(), 'schematic', 'dark')
    expect(paint.color).toBe('#e8e8ea')
    expect(paint.showJunctions).toBe(true)
  })

  it('uses black wires on light floor for schematic', () => {
    const paint = resolveEdgePaint(defaultEdgeStyle(), 'schematic', 'light')
    expect(paint.color).toBe('#0a0a0a')
  })
})
