import { useEffect, useId, useMemo, useRef, useState } from 'react'
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
import { isChaosTrialUsedMessage } from '../lib/stripeCheckout'
import { ApiError } from '../lib/apiError'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useChaosStore } from '../editor-core/stores/chaosStore'

const ARM_SECONDS = 6

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
  const [pick, setPick] = useState<ChaosScenario | null>(null)
  const [armed, setArmed] = useState<ChaosScenario | null>(null)
  const [countdown, setCountdown] = useState(ARM_SECONDS)
  const [menuOpen, setMenuOpen] = useState(false)
  const [successNote, setSuccessNote] = useState<string | null>(null)
  const menuId = useId()
  const pickerRef = useRef<HTMLDivElement | null>(null)

  const target = chaosTargetForNode(node.type)
  const scenarios = target
    ? chaosScenariosForTarget(target, chaosContextForNode(node))
    : []
  const ready = previewMode || (mode === 'live' && Boolean(deploymentId))

  const stallPod =
    node.type === 'database'
      ? stallTargetPodForInstance(selectedInstanceId)
      : undefined

  const selected = pick ?? scenarios[0] ?? null

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

  useEffect(() => {
    if (!armed) return
    setCountdown(ARM_SECONDS)
    const tick = window.setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          window.clearInterval(tick)
          setArmed(null)
          return 0
        }
        return n - 1
      })
    }, 1000)
    return () => window.clearInterval(tick)
  }, [armed])

  useEffect(() => {
    if (!armed) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setArmed(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [armed])

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target
      if (!(t instanceof Node)) return
      if (pickerRef.current && !pickerRef.current.contains(t)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  if (!target || scenarios.length === 0) return null

  const copyOpts =
    selected === 'stall_replica' && stallPod ? { targetPod: stallPod } : undefined

  const scenarioSubtitle = selected
    ? chaosScenarioSubtitle(selected, target, copyOpts)
    : 'Restarts one pod for this component.'

  const runScenario = async (scenario: ChaosScenario) => {
    if (previewMode || !deploymentId || !target) return
    const targetPod = scenario === 'stall_replica' ? stallPod : undefined
    const opts = targetPod ? { targetPod } : undefined
    setBusy(scenario)
    setError(null)
    setSuccessNote(null)
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
      setSuccessNote(`${chaosScenarioLabel(scenario, opts)} issued.`)
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
      setArmed(null)
    }
  }

  const runHeal = async () => {
    if (previewMode || !deploymentId) return
    setBusy('heal')
    setError(null)
    setSuccessNote(null)
    try {
      await healChaos(deploymentId)
      clearChaos()
      setSuccessNote('Partition healed.')
    } catch (e) {
      debugAuthError(e, 'chaos-heal')
      setError(
        mapAuthErrorMessage(e, 'Heal failed. Check deployment status and try again.'),
      )
    } finally {
      setBusy(null)
    }
  }

  const partitionBlocked =
    selected != null && partitionActive && isPartitionChaosScenario(selected)

  const hintText = armed
    ? chaosScenarioConfirm(armed, target, copyOpts)
    : scenarioSubtitle

  return (
    <div className={`chaos${armed ? ' armed' : ''}`} data-chaos>
      <div className="chaos-row">
        <span className="danger-mark" aria-hidden>!</span>
        <span className="chaos-lab">CHAOS</span>

        {scenarios.length > 1 ? (
          <div className="chaos-picker" ref={pickerRef}>
            <button
              type="button"
              className="chaos-trig"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              disabled={!ready || Boolean(armed) || targetBusy}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span>{selected ? chaosScenarioLabel(selected, copyOpts) : '—'}</span>
              <span className="car">▾</span>
            </button>
            <div className={`chaos-menu${menuOpen ? ' is-open' : ''}`} id={menuId} role="menu">
              {scenarios.map((scenario) => {
                const optCopy =
                  scenario === 'stall_replica' && stallPod
                    ? { targetPod: stallPod }
                    : undefined
                return (
                  <button
                    key={scenario}
                    type="button"
                    role="menuitem"
                    className={`chaos-opt${scenario === selected ? ' is-on' : ''}`}
                    onClick={() => {
                      setPick(scenario)
                      setMenuOpen(false)
                    }}
                  >
                    <span>{chaosScenarioLabel(scenario, optCopy)}</span>
                    <span className="chaos-opt-t">→ {target}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : selected ? (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink)' }}>
            {chaosScenarioLabel(selected, copyOpts)}
          </span>
        ) : null}

        <span className="chaos-tgt">→ {target}</span>
        <span className="chaos-sp" />

        {showHeal ? (
          <button
            type="button"
            className="btn tiny"
            disabled={Boolean(busy) || Boolean(armed)}
            onClick={() => void runHeal()}
          >
            Heal
          </button>
        ) : null}

        {armed ? (
          <>
            <span className="chaos-count">{countdown}s</span>
            <button
              type="button"
              className="btn confirm tiny"
              disabled={Boolean(busy)}
              onClick={() => {
                if (armed) void runScenario(armed)
              }}
            >
              Confirm
            </button>
            <button
              type="button"
              className="btn ghost tiny"
              disabled={Boolean(busy)}
              onClick={() => setArmed(null)}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn danger tiny"
            disabled={!ready || Boolean(busy) || targetBusy || partitionBlocked || !selected}
            onClick={() => {
              if (selected) setArmed(selected)
            }}
          >
            Arm
          </button>
        )}
      </div>

      {!ready ? (
        <p className="chaos-hint">Available when the deployment is running.</p>
      ) : (
        <p className="chaos-hint">{hintText}</p>
      )}

      {targetBusy ? (
        <p className="chaos-hint is-note">Chaos in progress on this component.</p>
      ) : null}
      {showHeal && activeChaos ? (
        <p className="chaos-hint">
          {chaosScenarioLabel(activeChaos.scenario)} is active until you Heal.
        </p>
      ) : null}
      {successNote ? <p className="chaos-hint is-note">{successNote}</p> : null}
      {error ? (
        <p className="chaos-hint" role="alert" style={{ borderLeftColor: 'var(--red)' }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
