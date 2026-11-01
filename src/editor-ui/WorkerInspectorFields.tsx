import type { CanvasNode } from '../editor-core/stores/canvasStore'
import {
  WORKER_REPLICA_MAX,
  WORKER_REPLICA_MIN,
  clampWorkerReplicas,
} from '../lib/replicaConfig'
import { normalizeInstanceSizes } from '../lib/instanceSizes'
import { ResourceProfileFields } from './ResourceProfileFields'
import { InstanceSizeCopyFields } from './InstanceSizeCopyFields'
import type { InstanceSize } from '../lib/userTier'
import { autoscaleFromConfig } from '../lib/autoscaleConfig'
import { AutoscaleInspectorFields } from './AutoscaleInspectorFields'
import { PcfgField, PcfgNum, PcfgStepper } from './stacklabConfigControls'

function optionalPositiveInt(raw: unknown): string {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || n < 1) return ''
  return String(Math.floor(n))
}

export function WorkerInspectorFields({
  config,
  updateConfig,
  readOnly = false,
  simulationMode = false,
  maxInstanceSize = 'large',
  maxReplicas = WORKER_REPLICA_MAX,
}: {
  config: Record<string, unknown>
  updateConfig: (patch: Partial<CanvasNode['config']>) => void
  readOnly?: boolean
  simulationMode?: boolean
  maxInstanceSize?: InstanceSize
  maxReplicas?: number
}) {
  const autoscaleOn = autoscaleFromConfig(config.autoscale) != null
  const workerReplicas = clampWorkerReplicas(config.replicas ?? 1, maxReplicas)
  const prefetch = optionalPositiveInt(config.workerPrefetch)
  const concurrency = optionalPositiveInt(config.workerConcurrency)

  return (
    <>
      <PcfgField
        label="Replicas"
        sub={
          autoscaleOn
            ? 'Fixed replicas are off while CPU autoscale is enabled.'
            : `Number of identical workers draining the queue in parallel. Max ${maxReplicas}.`
        }
      >
        <PcfgStepper
          label="Replicas"
          value={workerReplicas}
          min={WORKER_REPLICA_MIN}
          max={maxReplicas}
          disabled={readOnly || autoscaleOn}
          onChange={(next) => {
            const clamped = clampWorkerReplicas(next, maxReplicas)
            const sizes = normalizeInstanceSizes(config, clamped)
            updateConfig({
              replicas: clamped,
              instanceSizes: sizes,
              instanceSize: sizes[0],
            })
          }}
        />
      </PcfgField>
      <AutoscaleInspectorFields
        config={config}
        updateConfig={updateConfig}
        readOnly={readOnly}
        maxReplicas={maxReplicas}
      />
      <PcfgField
        label="Prefetch"
        htmlFor="worker-prefetch"
        sub="Messages the broker will deliver to a consumer before waiting for acks. Empty uses the image default."
      >
        <PcfgNum
          id="worker-prefetch"
          value={prefetch}
          unit="msgs"
          min={1}
          disabled={readOnly}
          placeholder="Default"
          onChange={(raw) => {
            if (!raw) {
              updateConfig({ workerPrefetch: undefined })
              return
            }
            updateConfig({ workerPrefetch: Math.floor(Number(raw)) })
          }}
        />
      </PcfgField>
      <PcfgField
        label="Concurrency"
        htmlFor="worker-concurrency"
        sub="Concurrent handlers per worker process. Empty uses the image default."
      >
        <PcfgNum
          id="worker-concurrency"
          value={concurrency}
          min={1}
          disabled={readOnly}
          placeholder="Default"
          onChange={(raw) => {
            if (!raw) {
              updateConfig({ workerConcurrency: undefined })
              return
            }
            updateConfig({ workerConcurrency: Math.floor(Number(raw)) })
          }}
        />
      </PcfgField>
      {workerReplicas > 1 ? (
        <InstanceSizeCopyFields
          idPrefix="worker"
          nodeType="worker"
          config={config}
          replicaCount={workerReplicas}
          updateConfig={updateConfig}
          readOnly={readOnly}
          maxInstanceSize={maxInstanceSize}
          labelForIndex={(i) => `Replica ${i + 1} size`}
        />
      ) : (
        <ResourceProfileFields
          idPrefix="worker"
          nodeType="worker"
          config={config}
          updateConfig={(patch) => {
            const size = String(patch.instanceSize ?? config.instanceSize ?? 'small')
            updateConfig({
              ...patch,
              instanceSizes: [size],
              instanceSize: size,
            })
          }}
          readOnly={readOnly}
          maxInstanceSize={maxInstanceSize}
        />
      )}
      {simulationMode ? (
        <PcfgField
          label="Capacity override"
          htmlFor="worker-cap"
          sub="Optional RPS ceiling. Empty leaves capacity on automatic."
        >
          <PcfgNum
            id="worker-cap"
            value={
              Number.isFinite(Number(config.nodeCapacityRps)) &&
              Number(config.nodeCapacityRps) > 0
                ? String(Number(config.nodeCapacityRps))
                : ''
            }
            unit="rps"
            min={1}
            placeholder="Auto"
            onChange={(raw) => {
              if (!raw) {
                updateConfig({ nodeCapacityRps: undefined })
                return
              }
              const n = Number(raw)
              if (Number.isFinite(n) && n > 0) updateConfig({ nodeCapacityRps: n })
            }}
          />
        </PcfgField>
      ) : null}
    </>
  )
}
