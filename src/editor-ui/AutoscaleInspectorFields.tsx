import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { useEffect, useState } from 'react'
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
import { syncAutoLoadBalancerForReplicas } from '../lib/ensureLoadBalancerForReplicas'

const AUTOSCALE_LOCK_TIP = 'CPU autoscale is limited to internal accounts.'

function commitAutoscale(
  updateConfig: (patch: Partial<CanvasNode['config']>) => void,
  patch: Partial<CanvasNode['config']>,
) {
  updateConfig(patch)
  syncAutoLoadBalancerForReplicas()
}

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
  const locked = !available
  const controlsDisabled = readOnly || locked
  const [lockHintUntil, setLockHintUntil] = useState(0)
  const lockHint = lockHintUntil > Date.now()
  const enabled = autoscaleFromConfig(config.autoscale) != null
  const ac: AutoscaleConfig =
    autoscaleFromConfig(config.autoscale) ?? defaultAutoscale(maxReplicas)

  useEffect(() => {
    if (lockHintUntil <= Date.now()) return
    const timer = window.setTimeout(() => setLockHintUntil(0), lockHintUntil - Date.now())
    return () => window.clearTimeout(timer)
  }, [lockHintUntil])

  return (
    <>
      <PcfgField
        label="CPU autoscale"
        sub="Kubernetes scales this node on CPU between min and max replicas. Admission charges the max."
      >
        <span title={locked ? AUTOSCALE_LOCK_TIP : undefined}>
          <PcfgChk
            id="autoscale-enabled"
            label="Scale on CPU"
            checked={enabled}
            disabled={readOnly}
            onChange={(on) => {
              if (readOnly) return
              if (locked && on) {
                setLockHintUntil(Date.now() + 4000)
                return
              }
              setLockHintUntil(0)
              if (!on) {
                commitAutoscale(updateConfig, { autoscale: undefined })
                return
              }
              commitAutoscale(updateConfig, { autoscale: defaultAutoscale(maxReplicas) })
            }}
          />
        </span>
        {lockHint ? (
          <p className="note amber" role="status">
            {AUTOSCALE_LOCK_TIP}
          </p>
        ) : null}
      </PcfgField>
      {enabled ? (
        <>
          <PcfgField label="Min replicas" sub="Deployment starts at this count.">
            <PcfgStepper
              label="Min replicas"
              value={ac.min}
              min={APP_SERVER_REPLICA_MIN}
              max={ac.max}
              disabled={controlsDisabled}
              onChange={(next) => {
                if (locked) return
                const min = clampAutoscaleMin(next, ac.max)
                commitAutoscale(updateConfig, {
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
              disabled={controlsDisabled}
              onChange={(next) => {
                if (locked) return
                const max = clampAutoscaleMax(next, ac.min, maxReplicas)
                commitAutoscale(updateConfig, {
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
              disabled={controlsDisabled}
              onChange={(next) => {
                if (locked) return
                commitAutoscale(updateConfig, {
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
