import { describe, expect, it } from 'vitest'
import {
  shouldVerifyDeploymentAfterWsRetries,
  WS_MAX_RETRY_ATTEMPTS,
} from './wsMaxRetryReconnect'

describe('shouldVerifyDeploymentAfterWsRetries', () => {
  it('escalates only after the max retry count', () => {
    expect(shouldVerifyDeploymentAfterWsRetries(WS_MAX_RETRY_ATTEMPTS - 1)).toBe(
      false,
    )
    expect(shouldVerifyDeploymentAfterWsRetries(WS_MAX_RETRY_ATTEMPTS)).toBe(true)
  })
})
