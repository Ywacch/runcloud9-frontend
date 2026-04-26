import { describe, expect, it } from 'vitest'
import { isTerminalDeploymentStatus } from './sessionCapture'

describe('isTerminalDeploymentStatus', () => {
  it('returns true only for terminal statuses', () => {
    expect(isTerminalDeploymentStatus('failed')).toBe(true)
    expect(isTerminalDeploymentStatus('terminated')).toBe(true)
    expect(isTerminalDeploymentStatus('running')).toBe(false)
    expect(isTerminalDeploymentStatus('provisioning')).toBe(false)
    expect(isTerminalDeploymentStatus(undefined)).toBe(false)
  })
})
