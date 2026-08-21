import { describe, expect, it } from 'vitest'
import {
  BACKEND_SUPPORTS_SHARDING,
  backendEngineOrDefault,
  backendEnginesForType,
  backendSupportsReadReplicas,
  backendSupportsReplicas,
  isBackendSupportedEngine,
} from './backendCapabilities'

describe('backendCapabilities', () => {
  it('exposes only provisioned engines', () => {
    expect(backendEnginesForType('database')).toEqual(['postgresql'])
    expect(backendEnginesForType('cache')).toEqual(['redis'])
    expect(backendEnginesForType('message_queue')).toEqual(['rabbitmq'])
    expect(backendEnginesForType('compute')).toEqual([])
  })

  it.each([
    ['database', 'mongodb'],
    ['cache', 'memcached'],
    ['message_queue', 'kafka'],
    ['message_queue', 'nats'],
  ] as const)('rejects unsupported %s engine %s', (type, engine) => {
    expect(isBackendSupportedEngine(type, engine)).toBe(false)
    expect(backendEngineOrDefault(type, engine)).toBe(
      backendEnginesForType(type)[0],
    )
  })

  it('accepts supported engines regardless of case or padding', () => {
    expect(isBackendSupportedEngine('database', ' PostgreSQL ')).toBe(true)
    expect(backendEngineOrDefault('cache', 'REDIS')).toBe('redis')
  })

  it('returns undefined for types without an engine choice', () => {
    expect(backendEngineOrDefault('compute', 'anything')).toBeUndefined()
    expect(isBackendSupportedEngine('compute', 'anything')).toBe(true)
  })

  it('keeps sharding off until the deployer provisions it', () => {
    expect(BACKEND_SUPPORTS_SHARDING).toBe(false)
  })

  it('allows compute and worker replicas on the deploy wire', () => {
    expect(backendSupportsReplicas('compute')).toBe(true)
    expect(backendSupportsReplicas('worker')).toBe(true)
    expect(backendSupportsReplicas('cache')).toBe(false)
    expect(backendSupportsReplicas('database')).toBe(false)
    expect(backendSupportsReplicas('message_queue')).toBe(false)
  })

  it('allows database read replicas via readReplicas knob', () => {
    expect(backendSupportsReadReplicas('database')).toBe(true)
    expect(backendSupportsReadReplicas('cache')).toBe(false)
    expect(backendSupportsReadReplicas('compute')).toBe(false)
  })
})
