import type { CanvasNode } from '../editor-core/stores/canvasStore'
import {
  normalizeInstanceSize,
  normalizeInstanceSizes,
} from '../lib/instanceSizes'
import { pcfgProfileOptions } from '../lib/pcfgProfileOptions'
import {
  isInstanceSizePlanLocked,
  type InstanceSize,
} from '../lib/userTier'
import { INSTANCE_SIZE_LARGE_LOCKED_HELPER } from '../lib/billingCopy'
import { PcfgField, PcfgProf } from './stacklabConfigControls'

export function InstanceSizeCopyFields({
  idPrefix,
  nodeType,
  config,
  replicaCount,
  updateConfig,
  readOnly = false,
  labelForIndex,
  maxInstanceSize = 'large',
}: {
  idPrefix: string
  nodeType: CanvasNode['type']
  config: Record<string, unknown>
  replicaCount: number
  updateConfig: (patch: Partial<CanvasNode['config']>) => void
  readOnly?: boolean
  labelForIndex?: (index: number) => string
  maxInstanceSize?: InstanceSize
}) {
  const sizes = normalizeInstanceSizes(config, replicaCount)
  const profileOptions = pcfgProfileOptions(nodeType, maxInstanceSize)
  const showLargeLocked = maxInstanceSize !== 'large'

  return (
    <>
      {sizes.map((size, i) => (
        <PcfgField
          key={`${idPrefix}-copy-${i}`}
          label={labelForIndex ? labelForIndex(i) : `Copy ${i + 1} size`}
          sub={
            showLargeLocked && isInstanceSizePlanLocked('large', maxInstanceSize)
              ? INSTANCE_SIZE_LARGE_LOCKED_HELPER
              : undefined
          }
        >
          <PcfgProf
            id={`${idPrefix}-copy-${i}-size`}
            value={size}
            options={profileOptions}
            disabled={readOnly}
            onChange={(next) => {
              if (readOnly) return
              if (isInstanceSizePlanLocked(next, maxInstanceSize)) return
              const nextArr = [...sizes]
              nextArr[i] = normalizeInstanceSize(next)
              updateConfig({
                instanceSizes: nextArr,
                instanceSize: nextArr[0],
              })
            }}
          />
        </PcfgField>
      ))}
    </>
  )
}
