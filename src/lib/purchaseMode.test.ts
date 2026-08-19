import { describe, expect, it } from 'vitest'
import {
  normalizePurchaseMode,
  purchaseModeFromConfig,
  templateSupportsPurchaseMode,
} from './purchaseMode'

describe('purchaseMode', () => {
  it('is ticket-drop only', () => {
    expect(templateSupportsPurchaseMode('ticket-drop')).toBe(true)
    expect(templateSupportsPurchaseMode('ecommerce')).toBe(false)
    expect(templateSupportsPurchaseMode(undefined)).toBe(false)
  })

  it('normalizes to unsafe or safe', () => {
    expect(normalizePurchaseMode('safe')).toBe('safe')
    expect(normalizePurchaseMode('SAFE')).toBe('safe')
    expect(normalizePurchaseMode('unsafe')).toBe('unsafe')
    expect(normalizePurchaseMode('')).toBe('unsafe')
    expect(normalizePurchaseMode('bogus')).toBe('unsafe')
  })

  it('reads purchaseMode from node config', () => {
    expect(purchaseModeFromConfig({ purchaseMode: 'safe' })).toBe('safe')
    expect(purchaseModeFromConfig({})).toBe('unsafe')
  })
})
