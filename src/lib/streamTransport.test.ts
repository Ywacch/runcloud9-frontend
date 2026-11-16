import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextStreamTransport, sseStreamsEnabled } from './streamTransport'

describe('nextStreamTransport', () => {
  it('returns ws when flag is off at zero failures', () => {
    expect(nextStreamTransport(false, 0)).toBe('ws')
  })

  it('returns sse when flag is on at zero failures', () => {
    expect(nextStreamTransport(true, 0)).toBe('sse')
  })

  it('returns sse when flag is on at one failure', () => {
    expect(nextStreamTransport(true, 1)).toBe('sse')
  })

  it('returns ws when flag is on at two failures', () => {
    expect(nextStreamTransport(true, 2)).toBe('ws')
  })
})

describe('sseStreamsEnabled', () => {
  const env = import.meta.env

  afterEach(() => {
    vi.stubEnv('VITE_STREAM_SSE', env.VITE_STREAM_SSE as string | undefined)
  })

  it('is false when env is unset', () => {
    vi.stubEnv('VITE_STREAM_SSE', undefined)
    expect(sseStreamsEnabled()).toBe(false)
  })

  it('is true only when env is the string true', () => {
    vi.stubEnv('VITE_STREAM_SSE', 'true')
    expect(sseStreamsEnabled()).toBe(true)
    vi.stubEnv('VITE_STREAM_SSE', 'false')
    expect(sseStreamsEnabled()).toBe(false)
  })
})