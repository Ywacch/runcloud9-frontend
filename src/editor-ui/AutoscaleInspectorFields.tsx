import type { CanvasNode } from '../editor-core/stores/canvasStore'
import {
  AUTOSCALE_CPU_TARGET_MAX,
  AUTOSCALE_CPU_TARGET_MIN,
  autoscaleFromConfig,
  clampAutoscaleCpuTarget,
  clampAutoscaleMax,
  clampAutoscaleMin,
  defaultAutoscale,
  type AutoscaleConfig,
} from '../lib/autoscaleConfig'
import { APP_SERVER_REPLICA_MIN } from '../lib/replicaConfig'
import { PcfgChk, PcfgField, PcfgStepper } from './stacklabConfigControls'

export function AutoscaleInspectorFields({
  config,
  updateConfig,
  readOnly = false,
  maxReplicas,
  available = false,
}: {
  config: Record<string, unknown>
  updateConfig: (patch: Partial<CanvasNode['config']>) => void
  readOnly?: boolean
  maxReplicas: number
  available?: boolean
}) {
  if (!available) return null
  const enabled = autoscaleFromConfig(config.autoscale) != null
  const ac: AutoscaleConfig =
    autoscaleFromConfig(config.autoscale) ?? defaultAutoscale(maxReplicas)

  return (
    <>
      <PcfgField
        label="CPU autoscale"
        sub="Kubernetes scales this node on CPU between min and max replicas. Admission charges the max."
      >
        <PcfgChk
          id="autoscale-enabled"
          label="Scale on CPU"
          checked={enabled}
          disabled={readOnly}
          onChange={(on) => {
            if (!on) {
              updateConfig({ autoscale: undefined })
              return
            }
            updateConfig({ autoscale: defaultAutoscale(maxReplicas) })
          }}
        />
      </PcfgField>
      {enabled ? (
        <>
          <PcfgField label="Min replicas" sub="Deployment starts at this count.">
            <PcfgStepper
              label="Min replicas"
              value={ac.min}
              min={APP_SERVER_REPLICA_MIN}
              max={ac.max}
              disabled={readOnly}
              onChange={(next) => {
                const min = clampAutoscaleMin(next, ac.max)
                updateConfig({
                  autoscale: {
                    ...ac,
                    min,
                    max: clampAutoscaleMax(ac.max, min, maxReplicas),
                  },
                })
              }}
            />
          </PcfgField>
          <PcfgField label="Max replicas" sub="HPA ceiling and budget multiplier.">
            <PcfgStepper
              label="Max replicas"
              value={ac.max}
              min={ac.min}
              max={maxReplicas}
              disabled={readOnly}
              onChange={(next) => {
                const max = clampAutoscaleMax(next, ac.min, maxReplicas)
                updateConfig({
                  autoscale: {
                    ...ac,
                    max,
                    min: clampAutoscaleMin(ac.min, max),
                  },
                })
              }}
            />
          </PcfgField>
          <PcfgField
            label="CPU target"
            sub="Average CPU utilization the HPA tries to hold (percent)."
          >
            <PcfgStepper
              label="CPU target percent"
              value={ac.targetCPUPercent}
              min={AUTOSCALE_CPU_TARGET_MIN}
              max={AUTOSCALE_CPU_TARGET_MAX}
              disabled={readOnly}
              onChange={(next) => {
                updateConfig({
                  autoscale: {
                    ...ac,
                    targetCPUPercent: clampAutoscaleCpuTarget(next),
                  },
                })
              }}
            />
          </PcfgField>
        </>
      ) : null}
    </>
  )
}
