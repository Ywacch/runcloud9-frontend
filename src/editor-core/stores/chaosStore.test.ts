import { beforeEach, describe, expect, it } from 'vitest'
import { useChaosStore } from './chaosStore'

describe('chaosStore', () => {
  beforeEach(() => {
    useChaosStore.getState().clear()
  })

  it('keeps partition overlays until clear', () => {
    useChaosStore.getState().register('stall_replica', 'db')
    const active = useChaosStore.getState().active
    expect(active?.stateful).toBe(true)
    useChaosStore.getState().tick()
    expect(useChaosStore.getState().active).not.toBeNull()
    useChaosStore.getState().clear()
    expect(useChaosStore.getState().active).toBeNull()
  })

  it('keeps promotion overlays non-stateful', () => {
    useChaosStore.getState().register('promote_replica', 'db')
    const active = useChaosStore.getState().active
    expect(active?.stateful).toBe(false)
    useChaosStore.getState().tick()
    expect(useChaosStore.getState().active).not.toBeNull()
  })

  it('expires ephemeral pod_kill overlays', () => {
    const now = Date.now()
    useChaosStore.getState().register('pod_kill', 'db', now)
    const active = useChaosStore.getState().active
    expect(active?.stateful).toBe(false)
    if (active) {
      active.startedAt = now - active.clearAfterMs - 1
      useChaosStore.setState({ active: { ...active } })
    }
    useChaosStore.getState().tick()
    expect(useChaosStore.getState().active).toBeNull()
  })
})
