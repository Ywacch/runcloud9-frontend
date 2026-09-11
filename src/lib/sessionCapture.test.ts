import { describe, expect, it, vi } from 'vitest'
import { isTerminalDeploymentStatus } from './sessionCapture'

vi.mock('./api', () => ({
  getDeployment: vi.fn(),
}))

describe('isTerminalDeploymentStatus', () => {
  it('returns true only for terminal statuses', () => {
    expect(isTerminalDeploymentStatus('failed')).toBe(true)
    expect(isTerminalDeploymentStatus('terminated')).toBe(true)
    expect(isTerminalDeploymentStatus('running')).toBe(false)
    expect(isTerminalDeploymentStatus('provisioning')).toBe(false)
    expect(isTerminalDeploymentStatus('queued')).toBe(false)
    expect(isTerminalDeploymentStatus(undefined)).toBe(false)
  })
})
