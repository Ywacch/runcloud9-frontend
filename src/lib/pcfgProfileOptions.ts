import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { resolveProxyProvisionedLimits } from './cacheProxyResources'
import {
  formatProvisionedShort,
  resolveProvisionedLimits,
} from './resolveProvisionedLimits'
import { getResourceProfilesCached } from './resourceProfileStore'
import { isInstanceSizePlanLocked, type InstanceSize } from './userTier'
import type { PcfgProfOption } from '../editor-ui/stacklabConfigControls'

const SIZE_OPTIONS: InstanceSize[] = ['small', 'medium', 'large']

function sizeLabel(size: string): string {
  return size ? size.charAt(0).toUpperCase() + size.slice(1) : size
}

export function pcfgProfileOptions(
  nodeType: CanvasNode['type'],
  maxInstanceSize: InstanceSize = 'large',
): PcfgProfOption[] {
  const catalog = getResourceProfilesCached()
  return SIZE_OPTIONS.filter((size) => !isInstanceSizePlanLocked(size, maxInstanceSize)).map(
    (size) => ({
      value: size,
      label: sizeLabel(size),
      meta: formatProvisionedShort(
        resolveProvisionedLimits(nodeType, { instanceSize: size }, catalog),
      ),
    }),
  )
}

export function pcfgProxyProfileOptions(
  config: Record<string, unknown>,
  maxInstanceSize: InstanceSize = 'large',
): PcfgProfOption[] {
  return SIZE_OPTIONS.filter((size) => !isInstanceSizePlanLocked(size, maxInstanceSize)).map(
    (size) => ({
      value: size,
      label: sizeLabel(size),
      meta: formatProvisionedShort(
        resolveProxyProvisionedLimits({ ...config, proxyInstanceSize: size }),
      ),
    }),
  )
}
