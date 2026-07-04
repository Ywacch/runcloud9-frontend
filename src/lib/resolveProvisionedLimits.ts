import type { CanvasNode } from '../editor-core/stores/canvasStore'
import type { ResourceLimitsJSON, ResourceProfilesResponse } from './api'

const PROFILE_COMPONENTS = new Set<CanvasNode['type']>([
  'database',
  'message_queue',
  'load_balancer',
])

function componentCatalogKey(
  nodeType: CanvasNode['type'],
): keyof ResourceProfilesResponse['components'] {
  if (nodeType === 'database') return 'db'
  if (nodeType === 'message_queue') return 'mq'
  return 'lb'
}

/** Mirrors backend deployer.ResolveNodeResources sizing rules. */
export function resolveProvisionedLimits(
  nodeType: CanvasNode['type'],
  config: Record<string, unknown>,
  catalog: ResourceProfilesResponse,
): ResourceLimitsJSON {
  const size = String(config.instanceSize ?? '').trim()
  if (size && catalog.profiles[size]) {
    return catalog.profiles[size]
  }
  if (PROFILE_COMPONENTS.has(nodeType)) {
    return catalog.components[componentCatalogKey(nodeType)]
  }
  return catalog.profiles.small
}

export function formatProvisionedLabel(limits: ResourceLimitsJSON): string {
  return `${limits.cpu} CPU · ${limits.memory} RAM`
}

export function formatProvisionedShort(limits: ResourceLimitsJSON): string {
  return `${limits.cpu} · ${limits.memory}`
}

export function formatProvisionedTooltip(limits: ResourceLimitsJSON): string {
  return `Provisioned · ${formatProvisionedShort(limits)}`
}
