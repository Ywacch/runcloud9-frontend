import { useMemo, useState } from 'react'
import { healChaos, triggerChaos } from '../lib/api'
import { debugAuthError, mapAuthErrorMessage } from '../lib/authErrorMessage'
import {
  chaosContextForNode,
  chaosScenarioConfirm,
  chaosScenarioLabel,
  chaosScenarioSubtitle,
  chaosScenariosForTarget,
  chaosTargetForNode,
  isPartitionChaosScenario,
  stallTargetPodForInstance,
  type ChaosRequest,
  type ChaosScenario,
} from '../lib/chaos'
import { trackEvent } from '../lib/analytics'
import { useMetricsStore } from '../editor-core/stores/metricsStore'
import {
  isChaosTrialUsedMessage,
} from '../lib/stripeCheckout'
import { ApiError } from '../lib/apiError'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useChaosStore } from '../editor-core/stores/chaosStore'

export function ChaosActions({
  node,
  previewMode = false,
}: {
  node: CanvasNode
  /** DEV inspector preview: show live chrome without calling the API. */
  previewMode?: boolean
}) {
  const deploymentId = useCanvasStore((s) => s.deploymentId)
  const mode = useCanvasStore((s) => s.mode)
  const selectedInstanceId = useCanvasStore((s) => s.selectedInstanceId)
  const registerChaos = useChaosStore((s) => s.register)
  const clearChaos = useChaosStore((s) => s.clear)
  const activeChaos = useChaosStore((s) => s.active)
  const partitionActive = useChaosStore((s) => s.hasActivePartition())

  const [busy, setBusy] = useState<ChaosScenario | 'heal' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const target = chaosTargetForNode(node.type)
  const scenarios = target
    ? chaosScenariosForTarget(target, chaosContextForNode(node))
    : []
  const ready = previewMode || (mode === 'live' && Boolean(deploymentId))

  const targetBusy = useMemo(() => {
    if (!activeChaos || !target) return false
    if (activeChaos.stateful) return false
    return activeChaos.targetComponent === target
  }, [activeChaos, target])

  const showHeal = Boolean(
    ready &&
      activeChaos?.stateful &&
      target &&
      activeChaos.targetComponent === target,
  )

  if (!target || scenarios.length === 0) return null

  const stallPod =
    node.type === 'database'
      ? stallTargetPodForInstance(selectedInstanceId)
      : undefined

  const run = async (scenario: ChaosScenario) => {
    if (previewMode || !deploymentId || !target) return
    const targetPod = scenario === 'stall_replica' ? stallPod : undefined
    const copyOpts = targetPod ? { targetPod } : undefined
    const ok = window.confirm(
      `${chaosScenarioLabel(scenario, copyOpts)} on ${target}?\n\n${chaosScenarioConfirm(scenario, target, copyOpts)}`,
    )
    if (!ok) return
    setBusy(scenario)
    setError(null)
    try {
      const body: ChaosRequest = { scenario, targetComponent: target }
      if (targetPod) body.targetPod = targetPod
      await triggerChaos(deploymentId, body)
      registerChaos(scenario, target)
      const template = useCanvasStore.getState().snapshotTemplateId ?? 'unknown'
      trackEvent('chaos_injected', {
        template,
        chaosKind: scenario,
        targetComponentType: target,
        loadgenActive: Boolean(useMetricsStore.getState().loadgen?.active),
      })
    } catch (e) {
      debugAuthError(e, 'chaos')
      const raw =
        e instanceof ApiError
          ? e.rawMessage || e.message
          : e instanceof Error
            ? e.message
            : ''
      if (isChaosTrialUsedMessage(raw)) {
        setError('You used your free chaos trial for this feature.')
      } else {
        setError(
          mapAuthErrorMessage(e, 'Chaos request failed. Check deployment status and try again.'),
        )
      }
    } finally {
      setBusy(null)
    }
  }

  const runHeal = async () => {
    if (previewMode || !deploymentId) return
    const ok = window.confirm(
      'Heal active partition?\n\nRemoves the network policy and restores traffic.',
    )
    if (!ok) return
    setBusy('heal')
    setError(null)
    try {
      await healChaos(deploymentId)
      clearChaos()
    } catch (e) {
      debugAuthError(e, 'chaos-heal')
      setError(
        mapAuthErrorMessage(e, 'Heal failed. Check deployment status and try again.'),
      )
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-[var(--c9-border)] bg-[var(--c9-surface)]/50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--c9-muted)]">
        Chaos
      </p>
      {!ready ? (
        <p className="text-xs text-[var(--c9-muted)]">
          Available when the deployment is running.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {showHeal ? (
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void runHeal()}
              className="rounded border border-violet-500/60 bg-violet-950/40 px-3 py-2 text-left text-xs text-violet-100 transition-colors hover:border-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="font-medium">Heal partition</span>
              <span className="mt-0.5 block text-[10px] text-violet-200/80">
                Remove the active network partition
              </span>
            </button>
          ) : null}
          {scenarios.map((scenario) => {
            const partitionBlocked =
              partitionActive && isPartitionChaosScenario(scenario)
            const copyOpts =
              scenario === 'stall_replica' && stallPod
                ? { targetPod: stallPod }
                : undefined
            return (
              <button
                key={scenario}
                type="button"
                disabled={Boolean(busy) || targetBusy || partitionBlocked}
                onClick={() => void run(scenario)}
                className="rounded border border-[var(--c9-border-strong)] bg-[var(--c9-bg)] px-3 py-2 text-left text-xs text-[var(--c9-text)] transition-colors hover:border-[var(--c9-accent)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="font-medium">
                  {chaosScenarioLabel(scenario, copyOpts)}
                </span>
                <span className="mt-0.5 block text-[10px] text-[var(--c9-muted)]">
                  {chaosScenarioSubtitle(scenario, target, copyOpts)}
                </span>
              </button>
            )
          })}
        </div>
      )}
      {targetBusy ? (
        <p className="text-[10px] text-violet-300">Chaos in progress on this component.</p>
      ) : null}
      {showHeal && activeChaos ? (
        <p className="text-[10px] text-violet-300">
          {chaosScenarioLabel(activeChaos.scenario)} is active until you Heal.
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
