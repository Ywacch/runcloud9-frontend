import { describe, expect, it } from 'vitest'
import {
  normalizePurchaseMode,
  purchaseModeFromConfig,
  purchasePathInfo,
  seedEventCapacityFromConfig,
  seedEventNameFromConfig,
  templateSupportsPurchaseMode,
} from './purchaseMode'

describe('purchaseMode', () => {
  it('is ticket-drop only', () => {
    expect(templateSupportsPurchaseMode('ticket-drop')).toBe(true)
    expect(templateSupportsPurchaseMode('ecommerce')).toBe(false)
    expect(templateSupportsPurchaseMode(undefined)).toBe(false)
  })

  it('normalizes purchase modes', () => {
    expect(normalizePurchaseMode('safe')).toBe('safe')
    expect(normalizePurchaseMode('optimistic')).toBe('optimistic')
    expect(normalizePurchaseMode('SAFE')).toBe('safe')
    expect(normalizePurchaseMode('unsafe')).toBe('unsafe')
    expect(normalizePurchaseMode('')).toBe('unsafe')
    expect(normalizePurchaseMode('bogus')).toBe('unsafe')
  })

  it('reads purchaseMode from node config', () => {
    expect(purchaseModeFromConfig({ purchaseMode: 'safe' })).toBe('safe')
    expect(purchaseModeFromConfig({ purchaseMode: 'optimistic' })).toBe('optimistic')
    expect(purchaseModeFromConfig({})).toBe('unsafe')
  })

  it('describes each path for the inspector card', () => {
    expect(purchasePathInfo('unsafe').sql.length).toBeGreaterThan(0)
    expect(purchasePathInfo('safe').underDrop).toMatch(/oversell/)
    expect(purchasePathInfo('optimistic').underDrop).toMatch(/409/)
  })

  it('normalizes seed event fields', () => {
    expect(seedEventNameFromConfig({})).toBe('Midnight Arena - Floor')
    expect(seedEventNameFromConfig({ seedEventName: '  Arena  ' })).toBe('Arena')
    expect(seedEventCapacityFromConfig({ seedEventCapacity: 50 })).toBe(50)
    expect(seedEventCapacityFromConfig({})).toBe(100)
  })
})
