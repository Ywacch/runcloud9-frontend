import type { TemplateInfo, TemplatePreset } from './api'
import { isEngineerOnlyNodeType } from './canvasContextMenuCatalog'
import { engineerUpgradeActionLabel } from './billingCopy'
import type { DeployRequestMessage } from './deployRequestMessage'
import { hasPaidTier, type UserRecord } from './userTier'

export type TemplatePresetMode = 'full' | 'explorer'

export type NodeTypeLike = { type: string }

/** Whether this template offers both full and Explorer-runnable presets. */
export function templateHasExplorerRunnable(
  template: Pick<TemplateInfo, 'preset' | 'presetLite'> | null | undefined,
): boolean {
  return Boolean(template?.preset && template.presetLite)
}

/**
 * Pick preset for canvas load.
 * Paid users always get full `preset`.
 * Free users: `full` → preset (default); `explorer` → presetLite when present.
 */
export function selectTemplatePreset(
  template: Pick<TemplateInfo, 'id' | 'preset' | 'presetLite'>,
  user: UserRecord | null,
  mode: TemplatePresetMode = 'full',
): TemplatePreset | undefined {
  if (!template.preset) return undefined
  if (hasPaidTier(user)) return template.preset
  if (mode === 'explorer') return template.presetLite ?? template.preset
  return template.preset
}

export function designHasEngineerOnlyNodes(
  nodes: Record<string, NodeTypeLike>,
): boolean {
  return Object.values(nodes).some((n) =>
    isEngineerOnlyNodeType(n.type as never),
  )
}

/**
 * Soft-block deploy when Explorer is viewing full architecture with locked components.
 * Returns null when deploy may proceed to existing preflight/API gates.
 */
export function explorerFullModeDeployBlock(opts: {
  isFreeUser: boolean
  mode: TemplatePresetMode | null | undefined
  nodes: Record<string, NodeTypeLike>
  billingEnabled: boolean
  hasExplorerRunnable?: boolean
}): DeployRequestMessage | null {
  if (!opts.isFreeUser) return null
  if (opts.mode === 'explorer') return null
  if (!designHasEngineerOnlyNodes(opts.nodes)) return null

  return {
    title: 'Engineer components on canvas',
    body: opts.hasExplorerRunnable
      ? 'This design includes load balancers, queues, or workers. Upgrade to Engineer to deploy this shape, or switch to the Explorer runnable preset.'
      : 'This design includes load balancers, queues, or workers. Upgrade to Engineer to deploy this architecture.',
    actionLabel: engineerUpgradeActionLabel(opts.billingEnabled),
    secondaryActionLabel: opts.hasExplorerRunnable
      ? 'Switch to Explorer runnable'
      : undefined,
  }
}
