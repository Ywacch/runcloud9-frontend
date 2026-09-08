import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TemplateInfo } from './api'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useTemplateRegistryStore } from '../editor-core/stores/templateRegistryStore'
import { isoToNode } from '../canvas/utils/positionAdapter'
import * as fitBridge from '../canvas/utils/canvasFitBridge'
import { AUTO_LOAD_BALANCER_ID } from './ensureLoadBalancerForReplicas'
import { CLIENT_LOADGEN_ID } from './spawnClientNode'
import {
  applyDevTemplateLayout,
  listDevLayoutSlots,
  parseDevLayoutQuery,
  parseDevLayoutStage,
  slotKey,
} from './devTemplateLayoutPreview'

const socialFeed: TemplateInfo = {
  id: 'social-feed',
  name: 'Social Feed',
  description: 'test',
  components: 5,
  bottleneck: 'db',
  available: true,
  premium: false,
  simulatable: true,
  deployable: true,
  tags: [],
  variations: [
    {
      id: 'timeline-async',
      label: 'Async fan-out',
      description: 'MQ + worker',
      nodes: [
        {
          id: 'app',
          type: 'compute',
          position: isoToNode(0, 0),
          label: 'App Server',
          config: { replicas: 1 },
        },
        {
          id: 'mq',
          type: 'message_queue',
          position: isoToNode(2, 0),
          label: 'Queue',
          config: {},
        },
        {
          id: 'worker',
          type: 'worker',
          position: isoToNode(4, 0),
          label: 'Worker',
          config: { replicas: 1 },
        },
        {
          id: 'cache',
          type: 'cache',
          position: isoToNode(2, 2),
          label: 'Redis',
          config: {},
        },
        {
          id: 'db',
          type: 'database',
          position: isoToNode(4, 2),
          label: 'Postgres',
          config: {},
        },
      ],
      edges: [
        { id: 'app-mq', sourceId: 'app', targetId: 'mq', protocol: 'http' },
        { id: 'mq-worker', sourceId: 'mq', targetId: 'worker', protocol: 'tcp' },
        { id: 'app-cache', sourceId: 'app', targetId: 'cache', protocol: 'tcp' },
        { id: 'worker-cache', sourceId: 'worker', targetId: 'cache', protocol: 'tcp' },
        { id: 'worker-db', sourceId: 'worker', targetId: 'db', protocol: 'tcp' },
      ],
    },
  ],
}

describe('devTemplateLayoutPreview', () => {
  beforeEach(() => {
    useCanvasStore.getState().clearCanvas()
    useCanvasStore.getState().setMode('design')
    useTemplateRegistryStore.setState({ byId: {}, loadgenConfigById: {} })
    vi.spyOn(fitBridge, 'requestCanvasFit').mockImplementation(() => {})
  })

  it('parses layout query keys', () => {
    expect(parseDevLayoutStage('scaled')).toBe('scaled')
    expect(parseDevLayoutQuery('')).toBeNull()
    expect(parseDevLayoutQuery('devLayout=social-feed:timeline-async&devStage=loadgen')).toEqual({
      templateId: 'social-feed',
      variationId: 'timeline-async',
      stage: 'loadgen',
    })
    expect(slotKey('social-feed', 'timeline-async')).toBe('social-feed:timeline-async')
  })

  it('lists catalog slots from the family table', () => {
    const slots = listDevLayoutSlots({ 'social-feed': socialFeed })
    const asyncSlot = slots.find((row) => row.variationId === 'timeline-async')
    expect(asyncSlot?.templateId).toBe('social-feed')
    expect(asyncSlot?.label).toBe('Async fan-out')
  })

  it('loads the variation without traffic source', () => {
    if (!import.meta.env.DEV) return
    expect(
      applyDevTemplateLayout(
        {
          templateId: 'social-feed',
          variationId: 'timeline-async',
          stage: 'loaded',
        },
        { 'social-feed': socialFeed },
      ),
    ).toBe(true)
    const { nodes } = useCanvasStore.getState()
    expect(nodes.app).toBeTruthy()
    expect(nodes[CLIENT_LOADGEN_ID]).toBeUndefined()
    expect(nodes[AUTO_LOAD_BALANCER_ID]).toBeUndefined()
  })

  it('adds traffic source on the loadgen stage', () => {
    if (!import.meta.env.DEV) return
    applyDevTemplateLayout(
      {
        templateId: 'social-feed',
        variationId: 'timeline-async',
        stage: 'loadgen',
      },
      { 'social-feed': socialFeed },
    )
    const { nodes } = useCanvasStore.getState()
    expect(nodes[CLIENT_LOADGEN_ID]).toBeTruthy()
    expect(nodes[CLIENT_LOADGEN_ID].position[2]).toBeGreaterThan(nodes.app.position[2])
  })

  it('scales app replicas and injects auto LB before loadgen', () => {
    if (!import.meta.env.DEV) return
    applyDevTemplateLayout(
      {
        templateId: 'social-feed',
        variationId: 'timeline-async',
        stage: 'scaled',
      },
      { 'social-feed': socialFeed },
    )
    const { nodes, edges } = useCanvasStore.getState()
    expect(nodes.app.config.replicas).toBe(2)
    expect(nodes[AUTO_LOAD_BALANCER_ID]).toBeTruthy()
    expect(nodes[CLIENT_LOADGEN_ID]).toBeTruthy()
    expect(
      Object.values(edges).some(
        (edge) =>
          edge.sourceId === CLIENT_LOADGEN_ID &&
          edge.targetId === AUTO_LOAD_BALANCER_ID,
      ),
    ).toBe(true)
  })
})
