import { describe, expect, it } from 'vitest'
import {
  clampSessionMinutes,
  canPickSessionLength,
  resolveDeploySessionMinutes,
} from './sessionMinutes'

const engineerLimits = { sessionDefaultMins: 9, sessionCapMins: 15 }
const freeLimits = { sessionDefaultMins: 9, sessionCapMins: 9 }
const internalLimits = { sessionDefaultMins: 9, sessionCapMins: 30 }

describe('sessionMinutes', () => {
  it('canPickSessionLength is true only when cap exceeds default', () => {
    expect(canPickSessionLength(engineerLimits)).toBe(true)
    expect(canPickSessionLength(internalLimits)).toBe(true)
    expect(canPickSessionLength(freeLimits)).toBe(false)
  })

  it('clampSessionMinutes clamps to tier bounds', () => {
    expect(clampSessionMinutes(5, engineerLimits)).toBe(9)
    expect(clampSessionMinutes(12, engineerLimits)).toBe(12)
    expect(clampSessionMinutes(20, engineerLimits)).toBe(15)
    expect(clampSessionMinutes(NaN, engineerLimits)).toBe(9)
  })

  it('resolveDeploySessionMinutes omits for free tier', () => {
    expect(resolveDeploySessionMinutes(15, freeLimits)).toBeUndefined()
    expect(resolveDeploySessionMinutes(15, engineerLimits)).toBe(15)
  })
})
