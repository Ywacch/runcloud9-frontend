import { describe, expect, it } from 'vitest'
import {
  isQuietLogComponent,
  logComponentMatches,
  normalizeLogComponent,
} from './logComponent'

describe('normalizeLogComponent', () => {
  it.each([
    ['db', 'db'],
    ['database', 'db'],
    ['postgres', 'db'],
    ['postgres-replica', 'db'],
    ['cache', 'cache'],
    ['redis', 'cache'],
    ['cache-proxy', 'cache'],
    ['redis-internal', 'cache'],
    ['app-server', 'app-server'],
    ['compute', 'app-server'],
    ['mq', 'mq'],
    ['rabbitmq', 'mq'],
    ['lb', 'lb'],
    ['nginx', 'lb'],
    ['worker', 'worker'],
  ] as const)('maps %s to %s', (input, want) => {
    expect(normalizeLogComponent(input)).toBe(want)
  })

  it('leaves unknown ids unchanged after trim/case fold', () => {
    expect(normalizeLogComponent('  Custom  ')).toBe('custom')
  })
})

describe('logComponentMatches', () => {
  it('matches canvas database to postgres wire labels', () => {
    expect(logComponentMatches('postgres', 'db')).toBe(true)
    expect(logComponentMatches('redis', 'cache')).toBe(true)
    expect(logComponentMatches('app-server', 'db')).toBe(false)
  })
})

describe('isQuietLogComponent', () => {
  it('pins db/cache/mq/lb, not app-server', () => {
    expect(isQuietLogComponent('postgres')).toBe(true)
    expect(isQuietLogComponent('redis')).toBe(true)
    expect(isQuietLogComponent('mq')).toBe(true)
    expect(isQuietLogComponent('lb')).toBe(true)
    expect(isQuietLogComponent('app-server')).toBe(false)
    expect(isQuietLogComponent('worker')).toBe(false)
  })
})
