import { describe, expect, it } from 'vitest'
import { protocolBadgeLayout } from './edgeProtocolBadge'

describe('edgeProtocolBadge', () => {
  it('labels HTTP/TCP and marks topology issues', () => {
    expect(protocolBadgeLayout('http').text).toBe('HTTP')
    expect(protocolBadgeLayout('tcp').text).toBe('TCP')
    expect(protocolBadgeLayout('http', 'bad edge').text).toBe('HTTP !')
    expect(protocolBadgeLayout('tcp', 'bad').fill).toBe('#7f1d1d')
    expect(protocolBadgeLayout('http').fill).toBe('#1f2937')
  })
})
