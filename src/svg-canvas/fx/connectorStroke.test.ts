import { describe, expect, it } from 'vitest'
import {
  CONNECTOR_DASH_PATTERN,
  CONNECTOR_HTTP_COLOR,
  CONNECTOR_SHAFT_WIDTH,
  CONNECTOR_TCP_COLOR,
  connectorStrokeForProtocol,
} from './connectorStroke'

describe('connectorStroke', () => {
  it('maps http to solid blue from connection-ex exports', () => {
    const stroke = connectorStrokeForProtocol('http', 'flow', 'dark')
    expect(stroke).toEqual({
      color: CONNECTOR_HTTP_COLOR,
      width: CONNECTOR_SHAFT_WIDTH,
      dash: undefined,
    })
  })

  it('maps tcp to dashed orange from connection-ex exports', () => {
    const stroke = connectorStrokeForProtocol('tcp', 'flow', 'dark')
    expect(stroke).toEqual({
      color: CONNECTOR_TCP_COLOR,
      width: CONNECTOR_SHAFT_WIDTH,
      dash: CONNECTOR_DASH_PATTERN,
    })
  })

  it('defers to schematic preset', () => {
    expect(connectorStrokeForProtocol('http', 'schematic', 'dark')).toBeNull()
  })
})
