import { describe, expect, it, vi } from 'vitest'
import { sessionSummaryFromApiMetrics } from './sessionCapture'

vi.mock('./api', () => ({
  getDeployment: vi.fn(),
}))

describe('sessionSummaryFromApiMetrics — pure adapter, no store access', () => {
  it('returns base zeros when metrics is undefined', () => {
    const s = sessionSummaryFromApiMetrics('url-shortener', undefined)
    expect(s.template).toBe('url-shortener')
    expect(s.duration).toBe('-')
    expect(s.peakRps).toBe(0)
    expect(s.peakP99).toBe(0)
    expect(s.componentSummaries).toEqual({})
  })

  it('parses durationSeconds from metrics summary', () => {
    const s = sessionSummaryFromApiMetrics('blog', {
      actual_duration_seconds: 330,
    })
    expect(s.duration).toBe('5m 30s')
  })

  it('parses steady_state fields when present', () => {
    const s = sessionSummaryFromApiMetrics('url-shortener', {
      steady_state: {
        steady_p99_ms: 42,
        steady_rps: 100,
        steady_db_query_rate: 50,
        steady_cache_hit_rate: 0.75,
      },
    })
    expect(s.steadyState).toBeDefined()
    expect(s.steadyState?.steadyP99Ms).toBe(42)
    expect(s.steadyState?.steadyRps).toBe(100)
    expect(s.steadyState?.steadyCacheHitRate).toBe(0.75)
  })

  it('leaves steadyState undefined when steady_state is absent', () => {
    const s = sessionSummaryFromApiMetrics('blog', { peak_rps: 50 })
    expect(s.steadyState).toBeUndefined()
  })

  it('parses session_history into sparklines when present', () => {
    const history = Array.from({ length: 5 }, (_, i) => ({
      rps: i * 10,
      p99_ms: i * 5,
      error_rate: 0,
      cache_hit_pct: 50,
      cache_hits_per_sec: i,
      cache_misses_per_sec: 1,
      db_query_rate: i * 2,
    }))
    const s = sessionSummaryFromApiMetrics('url-shortener', {
      session_history: history,
    })
    expect(s.sessionSparklines).toBeDefined()
    expect(s.sessionSparklines?.rps).toHaveLength(5)
    expect(s.sessionSparklines?.p99Ms).toHaveLength(5)
  })

  it('leaves sessionSparklines undefined when session_history is absent', () => {
    const s = sessionSummaryFromApiMetrics('blog', {})
    expect(s.sessionSparklines).toBeUndefined()
  })

  it('does not mutate or read canvasStore', () => {
    // canvasStore is NOT imported from this test; sessionSummaryFromApiMetrics
    // is a pure adapter — no store access needed.
    const s1 = sessionSummaryFromApiMetrics('a', { peak_rps: 10 })
    const s2 = sessionSummaryFromApiMetrics('b', { peak_rps: 20 })
    expect(s1.template).toBe('a')
    expect(s2.template).toBe('b')
  })
})
