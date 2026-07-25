import { describe, expect, it } from 'vitest'
import {
  backendSupportedEnginesForArchetype,
  enginesForArchetype,
} from './engineSkins'

describe('backendSupportedEnginesForArchetype', () => {
  it('keeps unsupported skins in the catalog but out of the picker', () => {
    expect(enginesForArchetype('database').map((s) => s.engine)).toContain(
      'mongodb',
    )
    expect(
      backendSupportedEnginesForArchetype('database').map((s) => s.engine),
    ).toEqual(['postgresql'])
  })

  it.each([
    ['cache', 'redis'],
    ['message-queue', 'rabbitmq'],
  ] as const)('narrows %s to %s', (archetype, engine) => {
    expect(
      backendSupportedEnginesForArchetype(archetype).map((s) => s.engine),
    ).toEqual([engine])
  })

  it('leaves engine-less archetypes untouched', () => {
    expect(backendSupportedEnginesForArchetype('worker')).toEqual(
      enginesForArchetype('worker'),
    )
  })
})
