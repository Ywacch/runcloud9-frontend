import { describe, expect, it } from 'vitest'
import { defaultEdgeProtocol } from './defaultEdgeProtocol'

describe('defaultEdgeProtocol', () => {
  it('uses HTTP for load_balancer -> compute', () => {
    expect(defaultEdgeProtocol('load_balancer', 'compute')).toBe('http')
  })

  it('uses HTTP for client -> load_balancer and client -> compute', () => {
    expect(defaultEdgeProtocol('client', 'load_balancer')).toBe('http')
    expect(defaultEdgeProtocol('client', 'compute')).toBe('http')
  })

  it('uses TCP for anything -> database', () => {
    expect(defaultEdgeProtocol('compute', 'database')).toBe('tcp')
    expect(defaultEdgeProtocol('worker', 'database')).toBe('tcp')
    expect(defaultEdgeProtocol('load_balancer', 'database')).toBe('tcp')
  })

  it('uses TCP for anything -> cache', () => {
    expect(defaultEdgeProtocol('compute', 'cache')).toBe('tcp')
    expect(defaultEdgeProtocol('worker', 'cache')).toBe('tcp')
  })

  it('uses TCP for anything -> message_queue', () => {
    expect(defaultEdgeProtocol('compute', 'message_queue')).toBe('tcp')
    expect(defaultEdgeProtocol('worker', 'message_queue')).toBe('tcp')
  })

  it('uses TCP for message_queue -> worker', () => {
    expect(defaultEdgeProtocol('message_queue', 'worker')).toBe('tcp')
  })

  it('uses HTTP for compute -> compute', () => {
    expect(defaultEdgeProtocol('compute', 'compute')).toBe('http')
  })

  it('uses HTTP for compute -> worker (only mq -> worker is TCP for worker targets)', () => {
    expect(defaultEdgeProtocol('compute', 'worker')).toBe('http')
  })
})
