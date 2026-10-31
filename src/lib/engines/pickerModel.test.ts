import { describe, expect, it } from 'vitest'
import type { MetaJobsResponse } from '../api'
import { buildEnginePickerModel } from './pickerModel'

const fixtureCatalog: MetaJobsResponse = {
  catalogVersion: '2',
  jobs: [{ id: 'timeline', label: 'Timeline' }],
  engines: [
    { id: 'redis', label: 'Redis', family: 'kv', weight: 'light' },
    { id: 'postgresql', label: 'PostgreSQL', family: 'relational', weight: 'light' },
  ],
  pairs: [
    {
      job: 'timeline',
      engine: 'redis',
      fit: 'natural',
      build: 'available',
      reason: 'sorted sets',
      fidelity: 'real',
    },
    {
      job: 'timeline',
      engine: 'postgresql',
      fit: 'workable',
      build: 'available',
      reason: 'table on db',
      fidelity: 'real',
    },
    {
      job: 'timeline',
      engine: 'memcached',
      fit: 'poor',
      build: 'not_built',
      reason: 'no adapter',
      fidelity: 'real',
    },
  ],
  guarantees: [],
}

describe('buildEnginePickerModel', () => {
  it('marks impossible and not_built states', () => {
    const model = buildEnginePickerModel('timeline', fixtureCatalog, [])
    const mem = model.find((o) => o.engine === 'memcached')
    expect(mem?.state).toBe('not_built')
  })

  it('marks tier gate on locked pairs', () => {
    const model = buildEnginePickerModel('timeline', fixtureCatalog, [
      { job: 'timeline', engine: 'postgresql', gate: 'tier' },
    ])
    const pg = model.find((o) => o.engine === 'postgresql')
    expect(pg?.state).toBe('tier_locked')
    const redis = model.find((o) => o.engine === 'redis')
    expect(redis?.state).toBe('selectable')
  })
})
