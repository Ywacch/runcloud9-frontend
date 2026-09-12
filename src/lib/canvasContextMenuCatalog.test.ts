import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import {
  CREATE_MENU_ROOT,
  canMoveOnCanvas,
  canPlaceOnCanvas,
  createMenuItemLockedForFree,
  explorerComponentLocksActive,
  filterCreateMenuItems,
  findCreateGroup,
  isEngineerOnlyNodeType,
  nodeMenuActions,
} from './canvasContextMenuCatalog'

function node(type: CanvasNode['type']): CanvasNode {
  return {
    id: `${type}-1`,
    type,
    label: type,
    position: [0, 0, 0],
    config: {},
    status: 'idle',
  }
}

describe('canvasContextMenuCatalog', () => {
  it('exposes proxy nested engines without fake catalogs', () => {
    const db = findCreateGroup(CREATE_MENU_ROOT, 'database')
    expect(db?.children.map((c) => c.label)).toEqual(['PostgreSQL'])
    const cache = findCreateGroup(CREATE_MENU_ROOT, 'cache')
    expect(cache?.children.map((c) => c.label)).toEqual(['Redis'])
    const mq = findCreateGroup(CREATE_MENU_ROOT, 'message_queue')
    expect(mq?.children.map((c) => c.label)).toEqual(['RabbitMQ'])
  })

  it('search flattens matching engines', () => {
    const hits = filterCreateMenuItems(CREATE_MENU_ROOT, 'postgre')
    expect(hits).toHaveLength(1)
    expect(hits[0].kind).toBe('place')
    if (hits[0].kind === 'place') {
      expect(hits[0].nodeType).toBe('database')
      expect(hits[0].label).toBe('PostgreSQL')
    }
  })

  it('canPlaceOnCanvas blocks live and locked', () => {
    expect(canPlaceOnCanvas('design', false)).toBe(true)
    expect(canPlaceOnCanvas('simulate', false)).toBe(true)
    expect(canPlaceOnCanvas('live', false)).toBe(false)
    expect(canPlaceOnCanvas('design', true)).toBe(false)
  })

  it('canMoveOnCanvas is blocked only by the movement lock', () => {
    expect(canMoveOnCanvas(false)).toBe(true)
    expect(canMoveOnCanvas(true)).toBe(false)
  })

  it('marks LB MQ and worker as engineer-only for free locks', () => {
    expect(isEngineerOnlyNodeType('load_balancer')).toBe(true)
    expect(isEngineerOnlyNodeType('message_queue')).toBe(true)
    expect(isEngineerOnlyNodeType('worker')).toBe(true)
    expect(isEngineerOnlyNodeType('compute')).toBe(false)

    const lb = CREATE_MENU_ROOT.find((i) => i.id === 'load_balancer')
    const mq = findCreateGroup(CREATE_MENU_ROOT, 'message_queue')
    const compute = CREATE_MENU_ROOT.find((i) => i.id === 'compute')
    expect(lb && createMenuItemLockedForFree(lb)).toBe(true)
    expect(mq && createMenuItemLockedForFree(mq)).toBe(true)
    expect(compute && createMenuItemLockedForFree(compute)).toBe(false)
  })

  it('disables explorer component locks in Vite DEV', () => {
    // Vitest runs under Vite DEV, matching local `pnpm dev` unlock behavior.
    expect(explorerComponentLocksActive()).toBe(false)
  })

  it('includes db partition scenarios when readReplicas >= 1', () => {
    const dbNode: CanvasNode = {
      ...node('database'),
      type: 'database',
      config: { readReplicas: 2 },
    }
    const live = nodeMenuActions({
      node: dbNode,
      mode: 'live',
      deploymentId: 'dep-1',
      chaosTargetBusy: false,
    })
    const chaos = live
      .filter((a): a is Extract<typeof a, { kind: 'chaos' }> => a.kind === 'chaos')
      .map((a) => a.scenario)
    expect(chaos).toContain('stall_replica')
    expect(chaos).toContain('split_primary_replica')
  })

  it('nodeMenuActions includes chaos only in live', () => {
    const design = nodeMenuActions({
      node: node('cache'),
      mode: 'design',
      deploymentId: null,
      chaosTargetBusy: false,
    })
    expect(design.some((a) => a.kind === 'chaos')).toBe(false)
    expect(design.some((a) => a.kind === 'delete' && !a.disabled)).toBe(true)

    const live = nodeMenuActions({
      node: node('cache'),
      mode: 'live',
      deploymentId: 'dep-1',
      chaosTargetBusy: false,
    })
    const chaos = live
      .filter((a): a is Extract<typeof a, { kind: 'chaos' }> => a.kind === 'chaos')
      .map((a) => a.scenario)
    expect(chaos).toEqual(['pod_kill', 'cache_flush', 'split_app_store'])
  })

  it('disables chaos when target busy', () => {
    const live = nodeMenuActions({
      node: node('compute'),
      mode: 'live',
      deploymentId: 'dep-1',
      chaosTargetBusy: true,
    })
    const kill = live.find((a) => a.kind === 'chaos')
    expect(kill?.kind === 'chaos' && kill.disabled).toBe(true)
  })
})
