import { describe, expect, it } from 'vitest'
import { REQUEST_DEPLOY_EVENT } from './deployEvents'

describe('deployEvents', () => {
  it('uses a stable request-deploy event name', () => {
    expect(REQUEST_DEPLOY_EVENT).toBe('runcloud9:request-deploy')
  })
})
