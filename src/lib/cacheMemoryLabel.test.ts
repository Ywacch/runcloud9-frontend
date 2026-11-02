import { describe, expect, it } from 'vitest'
import { cacheMemoryAmount } from './cacheMemoryLabel'

describe('cacheMemoryAmount', () => {
  it('prints KiB under 1 MiB', () => {
    expect(cacheMemoryAmount(18914)).toEqual({ text: '18', unit: 'KiB' })
  })

  it('prints whole MiB at 1 MiB and above', () => {
    expect(cacheMemoryAmount(1024 * 1024)).toEqual({ text: '1', unit: 'MiB' })
    expect(cacheMemoryAmount(230 * 1024 * 1024)).toEqual({ text: '230', unit: 'MiB' })
  })
})
