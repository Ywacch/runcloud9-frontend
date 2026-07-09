import { describe, expect, it } from 'vitest'
import { compactPodName } from './replicaMetricsDisplay'

describe('compactPodName', () => {
  it('keeps the unique pod suffix for k8s names', () => {
    expect(compactPodName('app-server-5fb79c6d-abc12')).toBe('5fb79c6d-abc12')
  })

  it('truncates very short single-token names', () => {
    expect(compactPodName('averylongreplicaname')).toMatch(/…$/)
  })
})
