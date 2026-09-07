import { describe, expect, it } from 'vitest'
import chevronSvg from '../assets/connector-chevron.svg?raw'
import {
  CONNECTOR_CHEVRON_D,
  CONNECTOR_CHEVRON_SHAFT_INSET,
  connectorChevronTransform,
  parseConnectorChevronPath,
} from './connectorChevron'

describe('connectorChevron', () => {
  it('keeps painted d equal to connector-chevron.svg', () => {
    expect(parseConnectorChevronPath(chevronSvg)).toBe(CONNECTOR_CHEVRON_D)
  })

  it('places tip at the target with rotation from the incoming segment', () => {
    const transform = connectorChevronTransform({ x: 100, y: 50 }, { x: 40, y: 50 })
    expect(transform).toContain('translate(100 50)')
    expect(transform).toContain('rotate(0')
  })

  it('exposes a shaft inset for line termination', () => {
    expect(CONNECTOR_CHEVRON_SHAFT_INSET).toBeGreaterThan(0)
  })
})
