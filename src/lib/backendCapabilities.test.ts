import { describe, expect, it, afterEach } from 'vitest'
import {
  BACKEND_SUPPORTS_SHARDING,
  applyEnginesCatalog,
  backendEngineOrDefault,
  backendEnginesForType,
  backendSupportsReadReplicas,
  backendSupportsReplicaApplyDelay,
  backendSupportsReplicas,
  isBackendSupportedEngine,
  resetBackendEnginesCatalog,
} from './backendCapabilities'
import type { MetaJobsResponse } from './api'

const sampleCatalog: MetaJobsResponse = {
  catalogVersion: '2',
  jobs: [],
  engines: [{ id: 'postgresql', label: 'PostgreSQL', family: 'relational', weight: 'light', replicaApplyDelay: true }],
  pairs: [
    {
      job: 'main_db',
      engine: 'postgresql',
      fit: 'natural',
      build: 'available',
      reason: '',
      fidelity: 'real',
    },
    {
      job: 'hot_cache',
      engine: 'redis',
      fit: 'natural',
      build: 'available',
      reason: '',
      fidelity: 'real',
    },
    {
      job: 'work_queue',
      engine: 'rabbitmq',
      fit: 'natural',
      build: 'available',
      reason: '',
      fidelity: 'real',
    },
  ],
  guarantees: [],
}

describe('backendCapabilities', () => {
  afterEach(() => {
    resetBackendEnginesCatalog()
  })
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

  it('keeps hardcoded defaults when the catalog is unavailable', () => {
    expect(backendEnginesForType('database')).toEqual(['postgresql'])
  })

  it('uses catalog pairs with build available when applied', () => {
    applyEnginesCatalog(sampleCatalog)
    expect(backendEnginesForType('database')).toEqual(['postgresql'])
    expect(backendEngineOrDefault('cache', 'memcached')).toBe('redis')
    expect(backendSupportsReplicaApplyDelay('postgresql')).toBe(true)
    expect(backendSupportsReplicaApplyDelay('mysql')).toBe(false)
  })

  it('defaults lag dial to postgresql without catalog engines', () => {
    expect(backendSupportsReplicaApplyDelay(undefined)).toBe(true)
    expect(backendSupportsReplicaApplyDelay('mysql')).toBe(false)
  })
})
