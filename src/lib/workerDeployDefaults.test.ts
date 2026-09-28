import { describe, expect, it } from 'vitest'
import {
  effectiveWorkerConcurrency,
  effectiveWorkerPrefetch,
  formatEffectiveWorkerInt,
} from './workerDeployDefaults'

describe('workerDeployDefaults', () => {
  it('uses image defaults when config omits worker ints', () => {
    expect(effectiveWorkerPrefetch({})).toEqual({ n: 10, fromDefault: true })
    expect(effectiveWorkerConcurrency({})).toEqual({ n: 1, fromDefault: true })
    expect(formatEffectiveWorkerInt(effectiveWorkerPrefetch({}))).toBe('10 (default)')
  })

  it('uses configured values', () => {
    expect(
      formatEffectiveWorkerInt(
        effectiveWorkerPrefetch({ workerPrefetch: 25 }),
      ),
    ).toBe('25')
  })
})
