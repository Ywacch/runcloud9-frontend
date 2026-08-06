import type { CanvasNode } from '../editor-core/stores/canvasStore'
import {
  WORKER_REPLICA_MAX,
  WORKER_REPLICA_MIN,
  clampWorkerReplicas,
} from '../lib/replicaConfig'
import { ResourceProfileFields } from './ResourceProfileFields'
import { InfoTooltip } from './InfoTooltip'

const fieldClass =
  'w-full rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-3 py-2 text-sm text-[var(--c9-text)] focus:border-[var(--c9-accent)] focus:outline-none'
const labelClass = 'mb-1 block text-xs uppercase tracking-wider text-[var(--c9-muted)]'

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
}: {
  config: Record<string, unknown>
  updateConfig: (patch: Partial<CanvasNode['config']>) => void
  readOnly?: boolean
  simulationMode?: boolean
}) {
  const workerReplicas = clampWorkerReplicas(config.replicas ?? 1)
  const prefetch = optionalPositiveInt(config.workerPrefetch)
  const concurrency = optionalPositiveInt(config.workerConcurrency)

  return (
    <>
      <div>
        <label className={labelClass} htmlFor="worker-replicas">
          <span className="inline-flex items-center gap-1">
            Replicas
            <InfoTooltip
              text={`Scale fan-out with replicas on a single worker node (max ${WORKER_REPLICA_MAX}).`}
            />
          </span>
        </label>
        <input
          id="worker-replicas"
          type="number"
          min={WORKER_REPLICA_MIN}
          max={WORKER_REPLICA_MAX}
          step={1}
          className={`${fieldClass}${readOnly ? ' cursor-not-allowed opacity-60' : ''}`}
          value={workerReplicas}
          readOnly={readOnly}
          disabled={readOnly}
          onChange={(e) => {
            if (readOnly) return
            const n = Number(e.target.value)
            if (!Number.isFinite(n)) return
            updateConfig({
              replicas: clampWorkerReplicas(n),
            })
          }}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="worker-prefetch">
          <span className="inline-flex items-center gap-1">
            Prefetch
            <InfoTooltip text="RabbitMQ QoS prefetch per consumer (empty = image default)." />
          </span>
        </label>
        <input
          id="worker-prefetch"
          type="number"
          min={1}
          step={1}
          placeholder="Default"
          className={`${fieldClass}${readOnly ? ' cursor-not-allowed opacity-60' : ''}`}
          value={prefetch}
          readOnly={readOnly}
          disabled={readOnly}
          onChange={(e) => {
            if (readOnly) return
            const v = e.target.value.trim()
            if (!v) {
              updateConfig({ workerPrefetch: undefined })
              return
            }
            const n = Number(v)
            if (!Number.isFinite(n) || n < 1) return
            updateConfig({ workerPrefetch: Math.floor(n) })
          }}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="worker-concurrency">
          <span className="inline-flex items-center gap-1">
            Concurrency
            <InfoTooltip text="Concurrent handlers per worker process (empty = image default)." />
          </span>
        </label>
        <input
          id="worker-concurrency"
          type="number"
          min={1}
          step={1}
          placeholder="Default"
          className={`${fieldClass}${readOnly ? ' cursor-not-allowed opacity-60' : ''}`}
          value={concurrency}
          readOnly={readOnly}
          disabled={readOnly}
          onChange={(e) => {
            if (readOnly) return
            const v = e.target.value.trim()
            if (!v) {
              updateConfig({ workerConcurrency: undefined })
              return
            }
            const n = Number(v)
            if (!Number.isFinite(n) || n < 1) return
            updateConfig({ workerConcurrency: Math.floor(n) })
          }}
        />
      </div>
      <ResourceProfileFields
        idPrefix="worker"
        nodeType="worker"
        config={config}
        updateConfig={updateConfig}
        readOnly={readOnly}
      />
      {simulationMode ? (
        <div>
          <label className={labelClass} htmlFor="worker-cap">
            Capacity override (RPS, optional)
          </label>
          <input
            id="worker-cap"
            type="number"
            min={1}
            step={1}
            placeholder="Auto"
            className={fieldClass}
            value={
              Number.isFinite(Number(config.nodeCapacityRps)) &&
              Number(config.nodeCapacityRps) > 0
                ? String(Number(config.nodeCapacityRps))
                : ''
            }
            onChange={(e) => {
              const v = e.target.value.trim()
              if (!v) {
                updateConfig({ nodeCapacityRps: undefined })
                return
              }
              const n = Number(v)
              if (Number.isFinite(n) && n > 0) {
                updateConfig({ nodeCapacityRps: n })
              }
            }}
          />
        </div>
      ) : null}
    </>
  )
}
