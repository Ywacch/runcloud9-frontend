import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { useResourceProfiles } from '../lib/resourceProfileStore'
import {
  formatProvisionedLabel,
  resolveProvisionedLimits,
} from '../lib/resolveProvisionedLimits'

const fieldClass =
  'w-full rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-3 py-2 text-sm text-[var(--c9-text)] focus:border-[var(--c9-accent)] focus:outline-none'
const labelClass = 'mb-1 block text-xs uppercase tracking-wider text-[var(--c9-muted)]'

const RESOURCE_PROFILE_HELPER =
  'Adjusts Kubernetes CPU/memory reservations for this component.'

export function ResourceProfileFields({
  idPrefix,
  nodeType,
  config,
  showDefaultOption = false,
  updateConfig,
}: {
  idPrefix: string
  nodeType: CanvasNode['type']
  config: Record<string, unknown>
  showDefaultOption?: boolean
  updateConfig: (patch: Partial<CanvasNode['config']>) => void
}) {
  const catalog = useResourceProfiles()
  const instanceSize = showDefaultOption
    ? String(config.instanceSize ?? '')
    : String(config.instanceSize ?? 'small')
  const limits = resolveProvisionedLimits(nodeType, config, catalog)

  return (
    <>
      <div>
        <label className={labelClass} htmlFor={`${idPrefix}-size`}>
          Resource profile
        </label>
        <p className="mb-1 text-[10px] leading-snug text-[var(--c9-muted)]">
          {RESOURCE_PROFILE_HELPER}
        </p>
        <select
          id={`${idPrefix}-size`}
          className={fieldClass}
          value={instanceSize}
          onChange={(e) => {
            const v = e.target.value.trim()
            updateConfig(v ? { instanceSize: v } : { instanceSize: undefined })
          }}
        >
          {showDefaultOption ? <option value="">Default</option> : null}
          <option value="small">small</option>
          <option value="medium">medium</option>
          <option value="large">large</option>
        </select>
      </div>
      <p className="text-[11px] text-[var(--c9-muted)]">
        {formatProvisionedLabel(limits)}
      </p>
    </>
  )
}
