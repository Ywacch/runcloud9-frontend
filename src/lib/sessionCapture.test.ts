import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('./api', () => ({
  getDeployment: vi.fn(),
}))

let isTerminalDeploymentStatus: (
  status: string | null | undefined,
) => boolean

beforeAll(async () => {
  ;({ isTerminalDeploymentStatus } = await import('./sessionCapture'))
})

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
