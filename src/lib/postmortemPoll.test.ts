import { describe, expect, it } from 'vitest'
import {
  POSTMORTEM_POLL_MAX_MS,
  postmortemSlideState,
  shouldPollPostmortem,
} from './postmortemPoll'
import type { AIPostmortem } from './aiPostmortem'

const okPm: AIPostmortem = {
  status: 'ok',
  summary: 'Done.',
  claims: [],
  insufficientEvidence: [],
}

describe('shouldPollPostmortem', () => {
  it('returns false for non-internal users', () => {
    expect(
      shouldPollPostmortem({
        postmortem: undefined,
        isInternal: false,
        hasDeploymentId: true,
        elapsedMs: 0,
      }),
    ).toBe(false)
  })

  it('returns false without deployment id', () => {
    expect(
      shouldPollPostmortem({
        postmortem: undefined,
        isInternal: true,
        hasDeploymentId: false,
        elapsedMs: 0,
      }),
    ).toBe(false)
  })

  it('polls when postmortem is absent', () => {
    expect(
      shouldPollPostmortem({
        postmortem: undefined,
        isInternal: true,
        hasDeploymentId: true,
        elapsedMs: 1000,
      }),
    ).toBe(true)
  })

  it('polls while status is pending', () => {
    expect(
      shouldPollPostmortem({
        postmortem: {
          status: 'pending',
          summary: '',
          claims: [],
          insufficientEvidence: [],
        },
        isInternal: true,
        hasDeploymentId: true,
        elapsedMs: 1000,
      }),
    ).toBe(true)
  })

  it('stops after settled ok', () => {
    expect(
      shouldPollPostmortem({
        postmortem: okPm,
        isInternal: true,
        hasDeploymentId: true,
        elapsedMs: 1000,
      }),
    ).toBe(false)
  })

  it('stops at time cap', () => {
    expect(
      shouldPollPostmortem({
        postmortem: undefined,
        isInternal: true,
        hasDeploymentId: true,
        elapsedMs: POSTMORTEM_POLL_MAX_MS,
      }),
    ).toBe(false)
  })
})

describe('postmortemSlideState', () => {
  it('is hidden for non-internal without postmortem', () => {
    expect(
      postmortemSlideState({
        postmortem: undefined,
        isInternal: false,
        polling: false,
        pollTimedOut: false,
      }),
    ).toBe('hidden')
  })

  it('is pending while polling', () => {
    expect(
      postmortemSlideState({
        postmortem: undefined,
        isInternal: true,
        polling: true,
        pollTimedOut: false,
      }),
    ).toBe('pending')
  })

  it('is error when polling timed out with no result', () => {
    expect(
      postmortemSlideState({
        postmortem: undefined,
        isInternal: true,
        polling: false,
        pollTimedOut: true,
      }),
    ).toBe('error')
  })

  it('is ready for ok with summary', () => {
    expect(
      postmortemSlideState({
        postmortem: okPm,
        isInternal: true,
        polling: false,
        pollTimedOut: false,
      }),
    ).toBe('ready')
  })
})
