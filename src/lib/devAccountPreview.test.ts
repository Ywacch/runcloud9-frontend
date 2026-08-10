import { describe, expect, it } from 'vitest'
import {
  applyDevAccountPreviewUser,
  DEV_ENGINEER_USER,
  devActiveDeployments,
  devDeploymentHistory,
  devDeploymentRecord,
  hasDevAccountAccess,
  shouldFallbackToDevAccountFixtures,
  shouldUseDevAccountFixtures,
} from './devAccountPreview'

describe('devAccountPreview', () => {
  it('opens account chrome without a session in Vite dev', () => {
    expect(hasDevAccountAccess(null)).toBe(import.meta.env.DEV)
    expect(hasDevAccountAccess({ access_token: 'tok' })).toBe(true)
  })

  it('uses fixtures only when unsigned in dev', () => {
    expect(shouldUseDevAccountFixtures(null)).toBe(import.meta.env.DEV)
    expect(shouldUseDevAccountFixtures('tok')).toBe(false)
  })

  it('falls back after 5xx or network errors in dev', () => {
    expect(shouldFallbackToDevAccountFixtures(undefined)).toBe(import.meta.env.DEV)
    expect(shouldFallbackToDevAccountFixtures(502)).toBe(import.meta.env.DEV)
    expect(shouldFallbackToDevAccountFixtures(401)).toBe(false)
    expect(shouldFallbackToDevAccountFixtures(403)).toBe(false)
  })

  it('hydrates the engineer preview user when unsigned', () => {
    let user: typeof DEV_ENGINEER_USER | null = null
    applyDevAccountPreviewUser((me) => {
      user = me
    }, null)
    if (import.meta.env.DEV) {
      expect(user).toEqual(DEV_ENGINEER_USER)
    } else {
      expect(user).toBeNull()
    }
  })

  it('does not overwrite a signed-in user', () => {
    let user: typeof DEV_ENGINEER_USER | null = null
    applyDevAccountPreviewUser((me) => {
      user = me
    }, { user: { id: 'real-user' } })
    expect(user).toBeNull()
  })

  it('returns a running session plus mixed history', () => {
    const now = Date.parse('2026-08-09T15:00:00Z')
    const active = devActiveDeployments(now)
    const history = devDeploymentHistory(50, now)
    expect(active).toHaveLength(1)
    expect(active[0]?.status).toBe('running')
    expect(history.map((row) => row.status)).toEqual([
      'terminated',
      'terminated',
      'failed',
      'terminated',
    ])
    expect(history.map((row) => row.template)).toEqual([
      'url-shortener',
      'ecommerce',
      'social-feed-pull',
      'url-shortener',
    ])
  })

  it('clamps history limit', () => {
    const now = Date.parse('2026-08-09T15:00:00Z')
    expect(devDeploymentHistory(2, now)).toHaveLength(2)
  })

  it('returns metrics for terminated preview runs', () => {
    const rec = devDeploymentRecord('cloud9-url-shortener-devpreview-c4d5e6')
    expect(rec?.metricsSummary).toMatchObject({
      peak_rps: 86,
      peak_p99_ms: 24,
      actual_duration_seconds: 540,
    })
  })

  it('returns running preview deploy without metrics', () => {
    const rec = devDeploymentRecord('cloud9-social-feed-devpreview-a1b2c3')
    expect(rec?.status).toBe('running')
    expect(rec?.metricsSummary).toBeUndefined()
  })
})
