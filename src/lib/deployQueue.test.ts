import { describe, expect, it } from 'vitest'
import {
  formatQueueWaitEstimate,
  formatQueueWaitingDetail,
  formatRoomWaitingDetail,
  hasQueueWaitFields,
  isDesignExceedsClusterCapacity,
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

  it('formats doorway waiting detail with position and ETA', () => {
    expect(
      formatQueueWaitingDetail({
        queuePosition: 2,
        estimatedWaitSeconds: 240,
      }),
    ).toBe('#2. About ~4m.')
    expect(
      formatQueueWaitingDetail({
        queuePosition: null,
        estimatedWaitSeconds: 90,
      }),
    ).toBe('About ~1m 30s.')
  })

  it('formats room waiting detail without leading position', () => {
    expect(
      formatRoomWaitingDetail({
        estimatedWaitSeconds: 120,
      }),
    ).toBe(
      'Needs more free capacity than is available. Smaller deploys may start first. About ~2m.',
    )
    expect(formatRoomWaitingDetail({})).not.toMatch(/#\d/)
  })

  it('detects when queue wait fields are present', () => {
    expect(hasQueueWaitFields({ queuePosition: 1, estimatedWaitSeconds: 40 })).toBe(
      true,
    )
    expect(hasQueueWaitFields({ queuePosition: null, estimatedWaitSeconds: 0 })).toBe(
      true,
    )
    expect(
      hasQueueWaitFields({ queuePosition: null, estimatedWaitSeconds: null }),
    ).toBe(false)
  })

  it('detects design_exceeds_cluster_capacity by reason or message', () => {
    expect(
      isDesignExceedsClusterCapacity({
        reason: 'design_exceeds_cluster_capacity',
      }),
    ).toBe(true)
    expect(
      isDesignExceedsClusterCapacity({
        message:
          'this design needs more CPU or memory than the cluster provides',
      }),
    ).toBe(true)
    expect(
      isDesignExceedsClusterCapacity({
        message: 'Design exceeds your resource quota',
      }),
    ).toBe(false)
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
