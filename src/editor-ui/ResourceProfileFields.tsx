import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import {
  resolveProxyInstanceSize,
  type ProxyInstanceSize,
} from '../lib/cacheProxyResources'
import { pcfgProfileOptions, pcfgProxyProfileOptions } from '../lib/pcfgProfileOptions'
import { trackEvent } from '../lib/analytics'
import { INSTANCE_SIZE_LARGE_LOCKED_HELPER } from '../lib/billingCopy'
import {
  isInstanceSizePlanLocked,
  type InstanceSize,
} from '../lib/userTier'
import { PcfgField, PcfgProf } from './stacklabConfigControls'

type SizeConfigKey = 'instanceSize' | 'proxyInstanceSize'

export function ResourceProfileFields({
  idPrefix,
  nodeType,
  config,
  showDefaultOption = false,
  updateConfig,
  label = 'Resource profile',
  helperText,
  configKey = 'instanceSize',
  readOnly = false,
  maxInstanceSize = 'large',
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
  maxInstanceSize?: InstanceSize
}) {
  const isProxy = configKey === 'proxyInstanceSize'
  const rawSize = config[configKey]
  const instanceSize = showDefaultOption
    ? String(rawSize ?? '')
    : isProxy
      ? resolveProxyInstanceSize(config)
      : String(rawSize ?? 'small')

  const showLargeLocked = maxInstanceSize !== 'large'
  const profileOptions = isProxy
    ? pcfgProxyProfileOptions(config, maxInstanceSize)
    : pcfgProfileOptions(nodeType, maxInstanceSize)

  const applySize = (v: string) => {
    if (readOnly) return
    const prev = instanceSize
    if (isInstanceSizePlanLocked(v, maxInstanceSize)) return
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
  }

  const options = showDefaultOption
    ? [{ value: '', label: 'Default', meta: '' }, ...profileOptions]
    : profileOptions

  const sub =
    helperText || showLargeLocked
      ? [helperText, showLargeLocked ? INSTANCE_SIZE_LARGE_LOCKED_HELPER : '']
          .filter(Boolean)
          .join(' ')
      : undefined

  return (
    <PcfgField label={label} sub={sub}>
      <PcfgProf
        id={`${idPrefix}-size`}
        value={instanceSize}
        options={options}
        disabled={readOnly}
        onChange={applySize}
      />
    </PcfgField>
  )
}
