import type { CanvasMode, CanvasNode } from '../editor-core/stores/canvasStore'
import {
  chaosScenarioLabel,
  chaosScenariosForTarget,
  chaosTargetForNode,
  type ChaosScenario,
} from './chaos'

export type CreateMenuLeaf = {
  kind: 'place'
  id: string
  label: string
  nodeType: CanvasNode['type']
  /** Optional engineer-tier hint (place still allowed; deploy may block). */
  engineerHint?: boolean
}

export type CreateMenuGroup = {
  kind: 'group'
  id: string
  label: string
  children: CreateMenuLeaf[]
}

export type CreateMenuItem = CreateMenuLeaf | CreateMenuGroup

const ENGINEER_TYPES = new Set<CanvasNode['type']>([
  'load_balancer',
  'message_queue',
  'worker',
])

/** Railway-style create catalog — only engines we actually deploy. */
export const CREATE_MENU_ROOT: CreateMenuItem[] = [
  {
    kind: 'place',
    id: 'load_balancer',
    label: 'Load Balancer',
    nodeType: 'load_balancer',
    engineerHint: true,
  },
  {
    kind: 'place',
    id: 'compute',
    label: 'App Server',
    nodeType: 'compute',
  },
  {
    kind: 'group',
    id: 'database',
    label: 'Database',
    children: [
      {
        kind: 'place',
        id: 'database-postgresql',
        label: 'PostgreSQL',
        nodeType: 'database',
      },
    ],
  },
  {
    kind: 'group',
    id: 'cache',
    label: 'Cache',
    children: [
      {
        kind: 'place',
        id: 'cache-redis',
        label: 'Redis',
        nodeType: 'cache',
      },
    ],
  },
  {
    kind: 'group',
    id: 'message_queue',
    label: 'Message Queue',
    children: [
      {
        kind: 'place',
        id: 'mq-rabbitmq',
        label: 'RabbitMQ',
        nodeType: 'message_queue',
        engineerHint: true,
      },
    ],
  },
  {
    kind: 'place',
    id: 'worker',
    label: 'Worker',
    nodeType: 'worker',
    engineerHint: true,
  },
]

export function canPlaceOnCanvas(
  mode: CanvasMode,
  movementLocked: boolean,
): boolean {
  if (mode === 'live') return false
  if (movementLocked) return false
  return mode === 'design' || mode === 'simulate'
}

export function filterCreateMenuItems(
  items: CreateMenuItem[],
  query: string,
): CreateMenuItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return items

  const out: CreateMenuItem[] = []
  for (const item of items) {
    if (item.kind === 'place') {
      if (item.label.toLowerCase().includes(q)) out.push(item)
      continue
    }
    if (item.label.toLowerCase().includes(q)) {
      out.push(item)
      continue
    }
    for (const child of item.children) {
      if (child.label.toLowerCase().includes(q)) out.push(child)
    }
  }
  return out
}

export function findCreateGroup(
  items: CreateMenuItem[],
  groupId: string,
): CreateMenuGroup | null {
  for (const item of items) {
    if (item.kind === 'group' && item.id === groupId) return item
  }
  return null
}

export type NodeMenuAction =
  | { kind: 'open_inspector'; label: string }
  | { kind: 'delete'; label: string; disabled?: boolean; reason?: string }
  | {
      kind: 'chaos'
      label: string
      scenario: ChaosScenario
      disabled?: boolean
      reason?: string
    }

export function nodeMenuActions(params: {
  node: CanvasNode
  mode: CanvasMode
  deploymentId: string | null
  chaosTargetBusy: boolean
}): NodeMenuAction[] {
  const { node, mode, deploymentId, chaosTargetBusy } = params
  const actions: NodeMenuAction[] = [
    { kind: 'open_inspector', label: 'Open inspector' },
  ]

  const editMode = mode === 'design' || mode === 'simulate'
  if (editMode && node.type !== 'client') {
    actions.push({ kind: 'delete', label: 'Delete' })
  } else if (mode === 'live' && node.type !== 'client') {
    actions.push({
      kind: 'delete',
      label: 'Delete',
      disabled: true,
      reason: 'Stop the session to edit the design',
    })
  }

  if (mode === 'live') {
    const target = chaosTargetForNode(node.type)
    if (target) {
      const ready = Boolean(deploymentId)
      for (const scenario of chaosScenariosForTarget(target)) {
        actions.push({
          kind: 'chaos',
          label: chaosScenarioLabel(scenario),
          scenario,
          disabled: !ready || chaosTargetBusy,
          reason: !ready
            ? 'Available when the deployment is running'
            : chaosTargetBusy
              ? 'Chaos already in progress on this component'
              : undefined,
        })
      }
    }
  }

  return actions
}

export function createItemShowsEngineerHint(item: CreateMenuLeaf): boolean {
  return Boolean(item.engineerHint) || ENGINEER_TYPES.has(item.nodeType)
}
