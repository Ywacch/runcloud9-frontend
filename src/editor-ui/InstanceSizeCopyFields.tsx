import type { CanvasNode } from '../editor-core/stores/canvasStore'
import {
  normalizeInstanceSize,
  normalizeInstanceSizes,
} from '../lib/instanceSizes'

const fieldClass =
  'w-full rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-3 py-2 text-sm text-[var(--c9-text)] focus:border-[var(--c9-accent)] focus:outline-none'
const labelClass = 'mb-1 block text-xs uppercase tracking-wider text-[var(--c9-muted)]'

export function InstanceSizeCopyFields({
  idPrefix,
  config,
  replicaCount,
  updateConfig,
  readOnly = false,
}: {
  idPrefix: string
  config: Record<string, unknown>
  replicaCount: number
  updateConfig: (patch: Partial<CanvasNode['config']>) => void
  readOnly?: boolean
}) {
  const sizes = normalizeInstanceSizes(config, replicaCount)
  return (
    <>
      {sizes.map((size, i) => (
        <div key={`${idPrefix}-copy-${i}`}>
          <label className={labelClass} htmlFor={`${idPrefix}-copy-${i}-size`}>
            Copy {i + 1} size
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
            <option value="small">small</option>
            <option value="medium">medium</option>
            <option value="large">large</option>
          </select>
        </div>
      ))}
    </>
  )
}
