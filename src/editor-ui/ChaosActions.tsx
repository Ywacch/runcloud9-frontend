import { useMemo, useState } from 'react'
import { triggerChaos } from '../lib/api'
import { debugAuthError, mapAuthErrorMessage } from '../lib/authErrorMessage'
import {
  chaosScenarioConfirm,
  chaosScenarioLabel,
  chaosScenariosForTarget,
  chaosTargetForNode,
  type ChaosScenario,
} from '../lib/chaos'
import { trackEvent } from '../lib/analytics'
import {
  isChaosTrialUsedMessage,
} from '../lib/stripeCheckout'
import { ApiError } from '../lib/apiError'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useChaosStore } from '../editor-core/stores/chaosStore'

export function ChaosActions({ node }: { node: CanvasNode }) {
  const deploymentId = useCanvasStore((s) => s.deploymentId)
  const mode = useCanvasStore((s) => s.mode)
  const registerChaos = useChaosStore((s) => s.register)
  const activeChaos = useChaosStore((s) => s.active)

  const [busy, setBusy] = useState<ChaosScenario | null>(null)
  const [error, setError] = useState<string | null>(null)

  const target = chaosTargetForNode(node.type)
  const scenarios = target ? chaosScenariosForTarget(target) : []
  const ready = mode === 'live' && Boolean(deploymentId)

  const targetBusy = useMemo(() => {
    if (!activeChaos || !target) return false
    return activeChaos.targetComponent === target
  }, [activeChaos, target])

  if (!target || scenarios.length === 0) return null

  const run = async (scenario: ChaosScenario) => {
    if (!deploymentId || !target) return
    const ok = window.confirm(
      `${chaosScenarioLabel(scenario)} on ${target}?\n\n${chaosScenarioConfirm(scenario, target)}`,
    )
    if (!ok) return
    setBusy(scenario)
    setError(null)
    try {
      await triggerChaos(deploymentId, { scenario, targetComponent: target })
      registerChaos(scenario, target)
      const template = useCanvasStore.getState().snapshotTemplateId ?? 'unknown'
      trackEvent('chaos_injected', { template, chaosKind: scenario, targetComponentType: target })
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
          {scenarios.map((scenario) => (
            <button
              key={scenario}
              type="button"
              disabled={Boolean(busy) || targetBusy}
              onClick={() => void run(scenario)}
              className="rounded border border-[var(--c9-border-strong)] bg-[var(--c9-bg)] px-3 py-2 text-left text-xs text-[var(--c9-text)] transition-colors hover:border-[var(--c9-accent)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="font-medium">{chaosScenarioLabel(scenario)}</span>
              <span className="mt-0.5 block text-[10px] text-[var(--c9-muted)]">
                {scenario === 'cache_flush'
                  ? 'Wipes Redis data (cache miss spike)'
                  : 'Restarts one pod for this component'}
              </span>
            </button>
          ))}
        </div>
      )}
      {targetBusy ? (
        <p className="text-[10px] text-violet-300">Chaos in progress on this component.</p>
      ) : null}
      {error ? (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
