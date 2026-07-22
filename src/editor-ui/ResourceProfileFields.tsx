import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import {
  resolveProxyInstanceSize,
  resolveProxyProvisionedLimits,
  type ProxyInstanceSize,
} from '../lib/cacheProxyResources'
import { useResourceProfiles } from '../lib/resourceProfileStore'
import {
  formatProvisionedLabel,
  resolveProvisionedLimits,
} from '../lib/resolveProvisionedLimits'
import { trackEvent } from '../lib/analytics'
import { RESOURCE_PROFILE_HELPER } from '../lib/billingCopy'

const fieldClass =
  'w-full rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-3 py-2 text-sm text-[var(--c9-text)] focus:border-[var(--c9-accent)] focus:outline-none'
const labelClass = 'mb-1 block text-xs uppercase tracking-wider text-[var(--c9-muted)]'

const PROXY_SIZE_HELPER =
  'Sizes the caching-proxy sidecar separately from Redis. CPU/RAM amounts differ from Redis profiles.'

type SizeConfigKey = 'instanceSize' | 'proxyInstanceSize'

export function ResourceProfileFields({
  idPrefix,
  nodeType,
  config,
  showDefaultOption = false,
  updateConfig,
  label = 'Resource profile',
  helperText = RESOURCE_PROFILE_HELPER,
  configKey = 'instanceSize',
  readOnly = false,
}: {
  idPrefix: string
  nodeType: CanvasNode['type']
  config: Record<string, unknown>
  showDefaultOption?: boolean
  updateConfig: (patch: Partial<CanvasNode['config']>) => void
  label?: string
  helperText?: string
  configKey?: SizeConfigKey
  readOnly?: boolean
}) {
  const catalog = useResourceProfiles()
  const isProxy = configKey === 'proxyInstanceSize'
  const rawSize = config[configKey]
  const instanceSize = showDefaultOption
    ? String(rawSize ?? '')
    : isProxy
      ? resolveProxyInstanceSize(config)
      : String(rawSize ?? 'small')

  const limits = isProxy
    ? resolveProxyProvisionedLimits(config)
    : resolveProvisionedLimits(
        nodeType,
        configKey === 'instanceSize'
          ? config
          : { ...config, instanceSize: rawSize },
        catalog,
      )

  return (
    <>
      <div>
        <label className={labelClass} htmlFor={`${idPrefix}-size`}>
          {label}
        </label>
        <p className="mb-1 text-[10px] leading-snug text-[var(--c9-muted)]">
          {isProxy ? PROXY_SIZE_HELPER : helperText}
        </p>
        <select
          id={`${idPrefix}-size`}
          className={`${fieldClass}${readOnly ? ' cursor-not-allowed opacity-60' : ''}`}
          value={instanceSize}
          disabled={readOnly}
          onChange={(e) => {
            if (readOnly) return
            const prev = instanceSize
            const v = e.target.value.trim()
            if (isProxy) {
              if (!v) {
                updateConfig({
                  proxyInstanceSize: undefined,
                  proxyResourceProfile: undefined,
                })
              } else {
                const size = v as ProxyInstanceSize
                updateConfig({
                  proxyInstanceSize: size,
                  proxyResourceProfile: size,
                })
              }
            } else {
              updateConfig(v ? { instanceSize: v } : { instanceSize: undefined })
            }
            const template = useCanvasStore.getState().snapshotTemplateId ?? 'unknown'
            trackEvent('design_option_changed', {
              template,
              optionName: isProxy ? 'proxy_resource_profile' : 'resource_profile',
              previousCategory: prev || 'default',
              newCategory: v || 'default',
            })
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
