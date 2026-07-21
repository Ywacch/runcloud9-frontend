import { describe, expect, it } from 'vitest'
import {
  formatQueueWaitEstimate,
  formatQueueWaitingDetail,
  isQueueFullErrorMessage,
  isUserConcurrentDeployErrorMessage,
} from './deployQueue'

describe('deployQueue helpers', () => {
  it('formats wait estimates', () => {
    expect(formatQueueWaitEstimate(undefined)).toBe('~4m')
    expect(formatQueueWaitEstimate(45)).toBe('~45s')
    expect(formatQueueWaitEstimate(120)).toBe('~2m')
    expect(formatQueueWaitEstimate(150)).toBe('~2m 30s')
  })

  it('formats waiting detail with position and ETA', () => {
    expect(
      formatQueueWaitingDetail({
        queuePosition: 2,
        estimatedWaitSeconds: 240,
      }),
    ).toBe("You're #2 in line. Estimated wait ~4m.")
    expect(
      formatQueueWaitingDetail({
        queuePosition: null,
        estimatedWaitSeconds: 90,
      }),
    ).toBe('Waiting for capacity. Estimated wait ~1m 30s.')
  })

  it('detects queue_full and concurrent messages', () => {
    expect(isQueueFullErrorMessage('deploy queue is full — try again shortly')).toBe(
      true,
    )
    expect(isQueueFullErrorMessage('reason: queue_full')).toBe(true)
    expect(
      isUserConcurrentDeployErrorMessage(
        'you already have an active deployment — end it before creating another',
      ),
    ).toBe(true)
    expect(isQueueFullErrorMessage('you already have an active deployment')).toBe(
      false,
    )
  })
})
