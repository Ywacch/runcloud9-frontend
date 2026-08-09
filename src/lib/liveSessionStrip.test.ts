import { describe, expect, it } from 'vitest'
import {
  DEV_LIVE_STRIP_PREVIEW,
  formatDeployLabel,
  formatSessionMmSs,
  loadMixForTemplate,
  loadMixSegmentsForTemplate,
  MIX_LABEL_MIN_PCT,
  mixSegmentShowsLabel,
} from './liveSessionStrip'

describe('formatSessionMmSs', () => {
  it('formats minutes and seconds', () => {
    expect(formatSessionMmSs(0)).toBe('0:00')
    expect(formatSessionMmSs(7 * 60 + 8)).toBe('7:08')
    expect(formatSessionMmSs(90)).toBe('1:30')
  })
})

describe('formatDeployLabel', () => {
  it('drops cloud9 prefix and trailing hashes', () => {
    expect(formatDeployLabel('cloud9-url-shortener-cd9fbd72-3cace8')).toBe(
      'url-shortener · 3cace8',
    )
  })

  it('keeps a short id unchanged', () => {
    expect(formatDeployLabel('demo')).toBe('demo')
  })
})

describe('DEV_LIVE_STRIP_PREVIEW', () => {
  it('uses a social-feed mix the live strip can render', () => {
    const mix = loadMixSegmentsForTemplate(DEV_LIVE_STRIP_PREVIEW.templateId)
    expect(mix).not.toBeNull()
    expect(mix!.length).toBeGreaterThanOrEqual(2)
    expect(mix!.length).toBeLessThanOrEqual(4)
    expect(formatDeployLabel(DEV_LIVE_STRIP_PREVIEW.deploymentId)).toBe(
      'social-feed · 3cace8',
    )
    expect(DEV_LIVE_STRIP_PREVIEW.kpiRows.some((r) => r.kind === 'error')).toBe(
      true,
    )
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

describe('loadMixSegmentsForTemplate', () => {
  it('returns null without a workload profile', () => {
    expect(loadMixSegmentsForTemplate(null)).toBeNull()
    expect(loadMixSegmentsForTemplate('unknown-template')).toBeNull()
  })

  it('returns 2-4 colored segments for social-feed', () => {
    const segs = loadMixSegmentsForTemplate('social-feed')
    expect(segs).not.toBeNull()
    expect(segs!.length).toBeGreaterThanOrEqual(2)
    expect(segs!.length).toBeLessThanOrEqual(4)
    const labeled = segs!.filter((s) => mixSegmentShowsLabel(s.pct))
    const unlabeled = segs!.filter((s) => !mixSegmentShowsLabel(s.pct))
    expect(labeled.every((s) => s.pct >= MIX_LABEL_MIN_PCT)).toBe(true)
    expect(unlabeled.every((s) => s.pct < MIX_LABEL_MIN_PCT)).toBe(true)
  })

  it('returns two segments for url-shortener', () => {
    const segs = loadMixSegmentsForTemplate('url-shortener')
    expect(segs).not.toBeNull()
    expect(segs).toHaveLength(2)
    expect(segs![0]!.pct).toBeGreaterThan(segs![1]!.pct)
  })
})
