import { describe, expect, it } from 'vitest'
import { formatSessionMmSs, loadMixForTemplate } from './liveSessionStrip'

describe('formatSessionMmSs', () => {
  it('formats minutes and seconds', () => {
    expect(formatSessionMmSs(0)).toBe('0:00')
    expect(formatSessionMmSs(7 * 60 + 8)).toBe('7:08')
    expect(formatSessionMmSs(90)).toBe('1:30')
  })
})

describe('loadMixForTemplate', () => {
  it('returns null without a workload profile', () => {
    expect(loadMixForTemplate(null)).toBeNull()
    expect(loadMixForTemplate('unknown-template')).toBeNull()
  })

  it('returns read/write percents for social-feed', () => {
    const mix = loadMixForTemplate('social-feed')
    expect(mix).not.toBeNull()
    expect(mix!.readPct + mix!.writePct).toBe(100)
    expect(mix!.readLabel.length).toBeGreaterThan(0)
    expect(mix!.writeLabel.length).toBeGreaterThan(0)
  })
})
