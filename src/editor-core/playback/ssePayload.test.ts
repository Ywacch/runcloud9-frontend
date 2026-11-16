import { describe, expect, it } from 'vitest'
import { parseMetricsStreamPayload } from './ssePayload'

describe('parseMetricsStreamPayload', () => {
  it('maps SSE data JSON to the same fields as a WebSocket frame', () => {
    const json =
      '{"timestamp":"2026-11-16T11:00:00.123456789Z","namespace":"ns-1","components":{},"snapshotAgeMs":42}'
    const frame = parseMetricsStreamPayload(json)
    expect(frame.namespace).toBe('ns-1')
    expect(frame.snapshotAgeMs).toBe(42)
    expect(frame.collectPending).toBeUndefined()
    expect(frame.components).toEqual({})
  })
})