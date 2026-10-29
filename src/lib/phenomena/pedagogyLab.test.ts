import { describe, expect, it } from 'vitest'
import { labPredictionCorrect } from './pedagogyLab'
import { PHENOMENON_REPLY_BEFORE_PARENT } from './types'

describe('labPredictionCorrect', () => {
  it('expects monotonic_violation for reply-before-parent', () => {
    expect(
      labPredictionCorrect(['monotonic_violation'], PHENOMENON_REPLY_BEFORE_PARENT),
    ).toBe(true)
    expect(labPredictionCorrect(['ryw_violation'], PHENOMENON_REPLY_BEFORE_PARENT)).toBe(
      false,
    )
  })
})
