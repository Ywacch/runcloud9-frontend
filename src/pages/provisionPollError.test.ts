import { describe, expect, it } from 'vitest'
import {
  clearProvisionPollErrorOnSuccess,
  nextProvisionPollError,
  PROVISION_FAILED_MESSAGE,
  PROVISION_POLL_UNREACHABLE_MESSAGE,
} from './provisionPollError'

describe('nextProvisionPollError', () => {
  it('keeps the previous error until three consecutive failures', () => {
    expect(nextProvisionPollError(1, null)).toBeNull()
    expect(nextProvisionPollError(2, null)).toBeNull()
    expect(nextProvisionPollError(3, null)).toBe(
      PROVISION_POLL_UNREACHABLE_MESSAGE,
    )
  })

  it('does not replace a real provisioning failure message', () => {
    expect(
      nextProvisionPollError(3, PROVISION_FAILED_MESSAGE),
    ).toBe(PROVISION_POLL_UNREACHABLE_MESSAGE)
  })
})

describe('clearProvisionPollErrorOnSuccess', () => {
  it('clears only the unreachable copy', () => {
    expect(
      clearProvisionPollErrorOnSuccess(PROVISION_POLL_UNREACHABLE_MESSAGE),
    ).toBeNull()
    expect(
      clearProvisionPollErrorOnSuccess(PROVISION_FAILED_MESSAGE),
    ).toBe(PROVISION_FAILED_MESSAGE)
  })
})
