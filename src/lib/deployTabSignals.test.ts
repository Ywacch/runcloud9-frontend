import { describe, expect, it } from 'vitest'
import {
  DEPLOY_TAB_BASE_TITLE,
  deployTabSignalForTransition,
  deriveDeployTabPhase,
  flashDeployTabTitle,
  overlayWaitKindFromFlags,
  steadyDeployTabTitle,
} from './deployTabSignals'

describe('deployTabSignals', () => {
  it('derives tab phase from status and metrics', () => {
    expect(
      deriveDeployTabPhase({
        mode: 'design',
        deployStatus: 'queued',
      }),
    ).toBe('room')
    expect(
      deriveDeployTabPhase({
        mode: 'design',
        deployStatus: 'provisioning',
        provisionPhase: 'waiting_for_provision_slot',
      }),
    ).toBe('door')
    expect(
      deriveDeployTabPhase({
        mode: 'design',
        deployStatus: 'provisioning',
        provisionPhase: 'deploying',
      }),
    ).toBe('provisioning')
    expect(
      deriveDeployTabPhase({
        mode: 'live',
        deployStatus: 'running',
      }),
    ).toBe('running')
    expect(
      deriveDeployTabPhase({
        mode: 'design',
        deployStatus: 'provisioning',
        provisioningError: 'boom',
      }),
    ).toBe('failed')
  })

  it('builds steady and flash titles', () => {
    expect(steadyDeployTabTitle('room')).toBe(`(Waiting) ${DEPLOY_TAB_BASE_TITLE}`)
    expect(steadyDeployTabTitle('provisioning')).toBe(
      `(Provisioning) ${DEPLOY_TAB_BASE_TITLE}`,
    )
    expect(flashDeployTabTitle('room_to_provisioning')).toContain(
      'Ready to provision',
    )
    expect(flashDeployTabTitle('running')).toContain('Deploy live')
    expect(flashDeployTabTitle('failed')).toContain('Deploy failed')
  })

  it('emits signals only for meaningful transitions', () => {
    expect(deployTabSignalForTransition('room', 'provisioning')).toBe(
      'room_to_provisioning',
    )
    expect(deployTabSignalForTransition('room', 'door')).toBe(
      'room_to_provisioning',
    )
    expect(deployTabSignalForTransition('door', 'running')).toBe('running')
    expect(deployTabSignalForTransition('provisioning', 'failed')).toBe(
      'failed',
    )
    expect(deployTabSignalForTransition('door', 'provisioning')).toBeNull()
    expect(deployTabSignalForTransition('room', 'room')).toBeNull()
  })

  it('maps overlay wait kinds', () => {
    expect(
      overlayWaitKindFromFlags({ isQueued: true, isDoorwayWait: false }),
    ).toBe('room')
    expect(
      overlayWaitKindFromFlags({ isQueued: false, isDoorwayWait: true }),
    ).toBe('door')
    expect(
      overlayWaitKindFromFlags({ isQueued: false, isDoorwayWait: false }),
    ).toBe('provisioning')
  })
})
