import { describe, expect, it } from 'vitest'
import {
  defaultActorParams,
  defaultScheduleId,
  DEV_LOADGEN_CONFIG,
  formatActorParamLabel,
  formatSchedulePhaseSummary,
} from './loadSessionPrefs'

describe('loadSessionPrefs helpers', () => {
  it('prefers steady schedule when present', () => {
    expect(defaultScheduleId(DEV_LOADGEN_CONFIG)).toBe('steady')
  })

  it('builds actor defaults from config', () => {
    expect(defaultActorParams(DEV_LOADGEN_CONFIG)).toEqual({
      celebrityPostPct: 5,
      readAfterPostBoost: 1,
    })
  })

  it('formats actor param labels', () => {
    expect(formatActorParamLabel('celebrityPostPct')).toBe('Celebrity post pct')
  })

  it('summarizes schedule phases', () => {
    const summary = formatSchedulePhaseSummary(DEV_LOADGEN_CONFIG.schedules![1]!.phases)
    expect(summary).toContain('60s ×1')
    expect(summary).toContain('30s ×4')
  })
})
