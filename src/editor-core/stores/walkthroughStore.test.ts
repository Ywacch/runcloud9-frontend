import { beforeEach, describe, expect, it, vi } from 'vitest'

const { trackEvent } = vi.hoisted(() => ({
  trackEvent: vi.fn(),
}))

vi.mock('../../lib/analytics', () => ({
  trackEvent,
}))

const fakeJourney = {
  id: 'journey-a',
  method: 'GET',
  path: '/',
  label: 'Read',
  trafficPercent: 100,
  explanation: 'Test journey',
  steps: [
    { component: 'app-server', label: 'App' },
    { component: 'db', label: 'DB' },
    { component: 'cache', label: 'Cache' },
  ],
}

vi.mock('../../lib/requestJourney', () => ({
  getJourneys: vi.fn(() => [fakeJourney]),
}))

vi.mock('../../lib/walkthroughPath', () => ({
  buildJourneyWalkthroughPath: vi.fn(() => ({
    clientNodeId: 'client-1',
    stepNodeIds: ['app-1', 'db-1', 'cache-1'],
    edgeIntoStep: [null, 'e1', 'e2'],
    participatingNodeIds: ['client-1', 'app-1', 'db-1', 'cache-1'],
  })),
}))

const canvasState = {
  mode: 'design' as const,
  snapshotTemplateId: 'url-shortener',
  nodes: {
    'app-1': { id: 'app-1', type: 'app-server', name: 'App', config: {} },
  },
  edges: {},
  walkthroughHighlightedEdgeIds: [] as string[],
  setNarrativeHighlightNodeIds: vi.fn(),
  setMovementLocked: vi.fn(),
  selectNode: vi.fn(),
  clearWalkthrough: vi.fn(),
  setWalkthroughHighlights: vi.fn(),
  setEdgeAnimated: vi.fn(),
}

vi.mock('./canvasStore', () => ({
  useCanvasStore: {
    getState: () => canvasState,
  },
}))

vi.mock('./templateRegistryStore', () => ({
  useTemplateRegistryStore: {
    getState: () => ({ byId: {} }),
  },
}))

import { useWalkthroughStore } from './walkthroughStore'

describe('walkthroughStore analytics', () => {
  beforeEach(() => {
    trackEvent.mockReset()
    canvasState.walkthroughHighlightedEdgeIds = []
    useWalkthroughStore.setState({
      activeJourneyId: null,
      journey: null,
      path: null,
      currentStepIndex: 0,
      playing: false,
      speed: 1,
    })
  })

  it('fires walkthrough_completed when reaching the last step, not walkthrough_stopped on stop', () => {
    const store = useWalkthroughStore.getState()
    store.startWalkthrough('journey-a')
    store.nextStep()
    store.nextStep()
    expect(trackEvent).toHaveBeenCalledWith('walkthrough_completed', {
      template: 'url-shortener',
      journeyId: 'journey-a',
      stepCount: 3,
    })
    trackEvent.mockClear()
    store.stop()
    expect(trackEvent).not.toHaveBeenCalledWith(
      'walkthrough_stopped',
      expect.anything(),
    )
  })

  it('fires walkthrough_stopped with stepReached when stopped early', () => {
    const store = useWalkthroughStore.getState()
    store.startWalkthrough('journey-a')
    trackEvent.mockClear()
    store.stop()
    expect(trackEvent).toHaveBeenCalledWith('walkthrough_stopped', {
      template: 'url-shortener',
      journeyId: 'journey-a',
      lastStepIndex: 0,
      stepCount: 3,
      stepReached: 1,
    })
  })

  it('can complete again after restarting from step 0', () => {
    const store = useWalkthroughStore.getState()
    store.startWalkthrough('journey-a')
    store.nextStep()
    store.nextStep()
    trackEvent.mockClear()
    store.goToStep(0)
    store.nextStep()
    store.nextStep()
    expect(trackEvent).toHaveBeenCalledWith('walkthrough_completed', {
      template: 'url-shortener',
      journeyId: 'journey-a',
      stepCount: 3,
    })
  })
})
