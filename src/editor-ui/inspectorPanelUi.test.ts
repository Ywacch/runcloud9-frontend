import { describe, expect, it } from 'vitest'
import { runtimeHealthPodsForScope } from './inspectorPanelUi'

describe('runtimeHealthPodsForScope', () => {
  const pods = [
    {
      name: 'app-server-roll-abc',
      ready: true,
      restartCount: 0,
    },
    {
      name: 'app-server-roll-def',
      ready: false,
      restartCount: 1,
    },
  ]

  it('returns all pods for cluster scope', () => {
    expect(runtimeHealthPodsForScope(pods, 'cluster')).toEqual(pods)
    expect(runtimeHealthPodsForScope(pods, null)).toEqual(pods)
  })

  it('filters to the selected pod name', () => {
    expect(runtimeHealthPodsForScope(pods, 'app-server-roll-abc')).toEqual([
      pods[0],
    ])
  })

  it('returns null when no pod matches the selected instance', () => {
    expect(runtimeHealthPodsForScope(pods, 'missing-pod')).toBeNull()
  })
})
