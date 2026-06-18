import { describe, expect, it, beforeEach } from 'vitest'
import { MetricsBuffer } from './MetricsBuffer'
import type { BufferedSample } from './wsMetricsTypes'

function sample(ts: number, rate = 10): BufferedSample {
  return {
    receivedAt: ts,
    serverTimestamp: ts,
    payload: {
      timestamp: new Date(ts).toISOString(),
      components: {
        'app-server': { requestRate: rate },
      },
    },
    events: [],
  }
}

describe('MetricsBuffer', () => {
  let buffer: MetricsBuffer

  beforeEach(() => {
    buffer = new MetricsBuffer()
  })

  it('caps at BUFFER_MAX_SAMPLES on overflow', () => {
    for (let i = 0; i < 40; i++) {
      buffer.add(sample(1000 + i * 2000))
    }
    expect(buffer.length).toBe(30)
    expect(buffer.getSamples()[0]!.serverTimestamp).toBe(1000 + 10 * 2000)
  })

  it('dedupes identical serverTimestamp on add', () => {
    buffer.add(sample(5000, 10))
    buffer.add(sample(5000, 99))
    expect(buffer.length).toBe(1)
    expect(buffer.getSamples()[0]!.payload.components!['app-server']!.requestRate).toBe(99)
  })

  it('finds bracket around playhead', () => {
    buffer.add(sample(2000, 10))
    buffer.add(sample(4000, 20))
    buffer.add(sample(6000, 30))
    const bracket = buffer.samplesAroundPlayhead(3000)
    expect(bracket).not.toBeNull()
    expect(bracket!.before.serverTimestamp).toBe(2000)
    expect(bracket!.after.serverTimestamp).toBe(4000)
    expect(bracket!.t).toBeCloseTo(0.5)
  })

  it('isFrozen when fewer than two samples ahead of playhead', () => {
    buffer.add(sample(2000))
    buffer.add(sample(4000))
    expect(buffer.isFrozen(3500)).toBe(true)
    buffer.add(sample(6000))
    expect(buffer.isFrozen(3500)).toBe(false)
  })
})
