import type { CanvasNode } from '../editor-core/stores/canvasStore'
import {
  normalizeInstanceSize,
  normalizeInstanceSizes,
} from '../lib/instanceSizes'
import {
  isInstanceSizePlanLocked,
  type InstanceSize,
} from '../lib/userTier'
import { INSTANCE_SIZE_LARGE_LOCKED_HELPER } from '../lib/billingCopy'

const fieldClass =
  'w-full rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-3 py-2 text-sm text-[var(--c9-text)] focus:border-[var(--c9-accent)] focus:outline-none'
const labelClass = 'mb-1 block text-xs uppercase tracking-wider text-[var(--c9-muted)]'

const SIZE_OPTIONS: InstanceSize[] = ['small', 'medium', 'large']

export function InstanceSizeCopyFields({
  idPrefix,
  config,
  replicaCount,
  updateConfig,
  readOnly = false,
  labelForIndex,
  maxInstanceSize = 'large',
}: {
  idPrefix: string
  config: Record<string, unknown>
  replicaCount: number
  updateConfig: (patch: Partial<CanvasNode['config']>) => void
  readOnly?: boolean
  labelForIndex?: (index: number) => string
  maxInstanceSize?: InstanceSize
}) {
  const sizes = normalizeInstanceSizes(config, replicaCount)
  const showLargeLocked = maxInstanceSize !== 'large'
  return (
    <>
      {sizes.map((size, i) => (
        <div key={`${idPrefix}-copy-${i}`}>
          <label className={labelClass} htmlFor={`${idPrefix}-copy-${i}-size`}>
            {labelForIndex ? labelForIndex(i) : `Copy ${i + 1} size`}
          </label>
          <select
            id={`${idPrefix}-copy-${i}-size`}
            className={`${fieldClass}${readOnly ? ' cursor-not-allowed opacity-60' : ''}`}
            value={size}
            disabled={readOnly}
            onChange={(e) => {
              if (readOnly) return
              const nextArr = [...sizes]
              nextArr[i] = normalizeInstanceSize(e.target.value)
              updateConfig({
                instanceSizes: nextArr,
                instanceSize: nextArr[0],
              })
            }}
          >
            {SIZE_OPTIONS.map((option) => (
              <option
                key={option}
                value={option}
                disabled={isInstanceSizePlanLocked(option, maxInstanceSize)}
              >
                {option}
              </option>
            ))}
          </select>
        </div>
      ))}
      {showLargeLocked ? (
        <p className="text-[11px] text-[var(--c9-muted)]">
          {INSTANCE_SIZE_LARGE_LOCKED_HELPER}
        </p>
      ) : null}
    </>
  )
}
