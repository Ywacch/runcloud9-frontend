import { describe, expect, it } from 'vitest'
import {
  IntrospectHttpError,
  introspectErrorMessage,
  isDeploymentInactiveError,
  isLiveSessionPastEnd,
  LIVE_SESSION_ENDED_MESSAGE,
  parseIntrospectErrorBody,
} from './liveSessionEnding'

describe('isLiveSessionPastEnd', () => {
  it('is false before the client end time', () => {
    expect(isLiveSessionPastEnd(1000, 500)).toBe(false)
  })

  it('is true at or after the client end time', () => {
    expect(isLiveSessionPastEnd(1000, 1000)).toBe(true)
    expect(isLiveSessionPastEnd(1000, 1500)).toBe(true)
  })
})

describe('parseIntrospectErrorBody', () => {
  it('maps deployment inactive JSON to a friendly message', () => {
    expect(
      parseIntrospectErrorBody('{"error":"deployment is not active"}', 410),
    ).toBe(LIVE_SESSION_ENDED_MESSAGE)
  })

  it('returns plain API error strings', () => {
    expect(parseIntrospectErrorBody('{"error":"nope"}', 400)).toBe('nope')
  })
})

describe('introspectErrorMessage', () => {
  it('uses IntrospectHttpError message', () => {
    expect(
      introspectErrorMessage(new IntrospectHttpError(410, LIVE_SESSION_ENDED_MESSAGE)),
    ).toBe(LIVE_SESSION_ENDED_MESSAGE)
  })
})

describe('isDeploymentInactiveError', () => {
  it('detects 410 introspect errors', () => {
    expect(isDeploymentInactiveError(new IntrospectHttpError(410, 'gone'))).toBe(true)
  })
})
