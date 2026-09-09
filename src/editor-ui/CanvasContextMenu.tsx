import { useEffect, useMemo, useRef, useState } from 'react'
import { triggerChaos } from '../lib/api'
import { debugAuthError, mapAuthErrorMessage } from '../lib/authErrorMessage'
import {
  CREATE_MENU_ROOT,
  canPlaceOnCanvas,
  createMenuItemLockedForFree,
  explorerComponentLocksActive,
  filterCreateMenuItems,
  findCreateGroup,
  nodeMenuActions,
  type CreateMenuLeaf,
} from '../lib/canvasContextMenuCatalog'
import {
  chaosScenarioConfirm,
  chaosScenarioLabel,
  chaosTargetForNode,
  type ChaosScenario,
} from '../lib/chaos'
import { placeFromPicker } from '../lib/pickerPlacement'
import { ContextMenuIcon } from './ContextMenuIcon'
import { trackEvent } from '../lib/analytics'
import { UPGRADE_TO_UNLOCK_TOOLTIP } from '../lib/billingCopy'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useMetricsStore } from '../editor-core/stores/metricsStore'
import { useChaosStore } from '../editor-core/stores/chaosStore'
import { useCanvasContextMenuStore } from '../editor-core/stores/contextMenuStore'
import { useAuthStore } from '../product/stores/authStore'
import { subscribeCanvasViewportScreenRefresh } from '../canvas/utils/canvasViewportBridge'

const MENU_W = 260
const MENU_MAX_H = 320

function clampMenuPosition(
  clientX: number,
  clientY: number,
): { left: number; top: number } {
  const pad = 8
  const vw = window.innerWidth
  const vh = window.innerHeight
  let left = clientX
  let top = clientY
  if (left + MENU_W + pad > vw) left = Math.max(pad, vw - MENU_W - pad)
  if (top + MENU_MAX_H + pad > vh) top = Math.max(pad, vh - MENU_MAX_H - pad)
  return { left, top }
}

export function CanvasContextMenu() {
  const menu = useCanvasContextMenuStore((s) => s.menu)
  const close = useCanvasContextMenuStore((s) => s.close)
  const nodes = useCanvasStore((s) => s.nodes)
  const mode = useCanvasStore((s) => s.mode)
  const movementLocked = useCanvasStore((s) => s.movementLocked)
  const deploymentId = useCanvasStore((s) => s.deploymentId)
  const loadedVariationId = useCanvasStore((s) => s.loadedVariationId)
  const addNode = useCanvasStore((s) => s.addNode)
  const updateNodeConfig = useCanvasStore((s) => s.updateNodeConfig)
  const selectNode = useCanvasStore((s) => s.selectNode)
  const removeNode = useCanvasStore((s) => s.removeNode)
  const registerChaos = useChaosStore((s) => s.register)
  const activeChaos = useChaosStore((s) => s.active)
  const isPremiumUser = useAuthStore((s) => s.isPremium)

  const [query, setQuery] = useState('')
  const [groupId, setGroupId] = useState<string | null>(null)
  const [chaosError, setChaosError] = useState<string | null>(null)
  const [chaosBusy, setChaosBusy] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setQuery('')
    setGroupId(null)
    setChaosError(null)
    setChaosBusy(false)
  }, [menu])

  useEffect(() => {
    if (!menu || menu.kind !== 'create') return
    const id = window.setTimeout(() => searchRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (groupId) setGroupId(null)
        else close()
      }
    }
    const onPointerDown = (e: PointerEvent) => {
      const el = rootRef.current
      if (el && e.target instanceof Node && el.contains(e.target)) return
      close()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [menu, groupId, close])

  useEffect(() => {
    if (!menu) return
    return subscribeCanvasViewportScreenRefresh(() => close())
  }, [menu, close])

  const node = menu?.kind === 'node' ? nodes[menu.nodeId] : null
  const chaosTarget = node ? chaosTargetForNode(node.type) : null
  const chaosTargetBusy = Boolean(
    activeChaos && chaosTarget && activeChaos.targetComponent === chaosTarget,
  )

  const nodeActions = useMemo(() => {
    if (!node) return []
    return nodeMenuActions({
      node,
      mode,
      deploymentId,
      chaosTargetBusy,
      loadedVariationId,
    })
  }, [node, mode, deploymentId, chaosTargetBusy, loadedVariationId])

  const filteredRoot = useMemo(
    () => filterCreateMenuItems(CREATE_MENU_ROOT, query),
    [query],
  )
  const activeGroup = groupId ? findCreateGroup(CREATE_MENU_ROOT, groupId) : null
  const listItems = activeGroup
    ? filterCreateMenuItems(activeGroup.children, query)
    : filteredRoot

  if (!menu) return null

  if (
    menu.kind === 'create' &&
    (!canPlaceOnCanvas(mode, movementLocked) || loadedVariationId)
  ) {
    return null
  }

  const { left, top } = clampMenuPosition(menu.clientX, menu.clientY)

  const placeLeaf = (leaf: CreateMenuLeaf) => {
    if (menu.kind !== 'create') return
    if (loadedVariationId) return
    if (
      explorerComponentLocksActive() &&
      !isPremiumUser &&
      createMenuItemLockedForFree(leaf)
    ) {
      return
    }
    placeFromPicker({
      nodeType: leaf.nodeType,
      position: menu.position,
      nodes,
      addNode,
      updateNodeConfig,
    })
    close()
  }

  const runChaos = async (scenario: ChaosScenario) => {
    if (!node || !deploymentId) return
    const target = chaosTargetForNode(node.type)
    if (!target) return
    const ok = window.confirm(
      `${chaosScenarioLabel(scenario)} on ${target}?\n\n${chaosScenarioConfirm(scenario, target)}`,
    )
    if (!ok) return
    setChaosBusy(true)
    setChaosError(null)
    try {
      await triggerChaos(deploymentId, { scenario, targetComponent: target })
      registerChaos(scenario, target)
      const template = useCanvasStore.getState().snapshotTemplateId ?? 'unknown'
      trackEvent('chaos_injected', {
        template,
        chaosKind: scenario,
        targetComponentType: target,
        loadgenActive: Boolean(useMetricsStore.getState().loadgen?.active),
      })
      close()
    } catch (e) {
      debugAuthError(e, 'context-menu-chaos')
      setChaosError(
        mapAuthErrorMessage(
          e,
          'Chaos request failed. Check deployment status and try again.',
        ),
      )
    } finally {
      setChaosBusy(false)
    }
  }

  return (
    <div
      ref={rootRef}
      role="menu"
      className="fixed z-50 flex max-h-[min(320px,70vh)] w-[260px] flex-col overflow-hidden rounded-lg border border-[var(--c9-border)] bg-[var(--c9-surface)]/95 text-xs text-[var(--c9-text)] shadow-xl backdrop-blur-md"
      style={{ left, top }}
    >
      {menu.kind === 'create' ? (
        <>
          <div className="border-b border-[var(--c9-border)] px-2.5 py-1.5 text-[10px] text-[var(--c9-muted)]">
            {activeGroup ? (
              <button
                type="button"
                className="hover:text-[var(--c9-text)]"
                onClick={() => setGroupId(null)}
              >
                Create
              </button>
            ) : (
              <span>Create</span>
            )}
            {activeGroup ? (
              <>
                <span className="mx-1 opacity-50">›</span>
                <span className="text-[var(--c9-text)]">{activeGroup.label}</span>
              </>
            ) : null}
          </div>
          <div className="border-b border-[var(--c9-border)] px-2 py-1.5">
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What do you need?"
              className="w-full rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-2 py-1.5 text-xs text-[var(--c9-text)] placeholder:text-[var(--c9-muted)] focus:border-[var(--c9-accent)] focus:outline-none"
            />
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto py-1">
            {listItems.length === 0 ? (
              <li className="px-3 py-2 text-[var(--c9-muted)]">No matches</li>
            ) : (
              listItems.map((item) => {
                const locked =
                  explorerComponentLocksActive() &&
                  !isPremiumUser &&
                  createMenuItemLockedForFree(item)
                if (item.kind === 'group') {
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={locked}
                        title={locked ? UPGRADE_TO_UNLOCK_TOOLTIP : undefined}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-[var(--c9-bg)] disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => {
                          if (locked) return
                          setGroupId(item.id)
                          setQuery('')
                        }}
                      >
                        <ContextMenuIcon item={item} locked={locked} />
                        <span className="flex-1 font-medium">{item.label}</span>
                        <span className="text-[var(--c9-muted)]">›</span>
                      </button>
                    </li>
                  )
                }
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={locked}
                      title={locked ? UPGRADE_TO_UNLOCK_TOOLTIP : undefined}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-[var(--c9-bg)] disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => placeLeaf(item)}
                    >
                      <ContextMenuIcon item={item} locked={locked} />
                      <span className="flex-1 font-medium">{item.label}</span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </>
      ) : node ? (
        <>
          <div className="border-b border-[var(--c9-border)] px-2.5 py-1.5 text-[10px] text-[var(--c9-muted)]">
            <span className="text-[var(--c9-text)]">{node.label}</span>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto py-1">
            {nodeActions.map((action) => {
              const key =
                action.kind === 'chaos'
                  ? `chaos-${action.scenario}`
                  : action.kind
              const disabled =
                ('disabled' in action && action.disabled) ||
                (action.kind === 'chaos' && chaosBusy)
              return (
                <li key={key}>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={disabled}
                    title={
                      'reason' in action && action.reason
                        ? action.reason
                        : undefined
                    }
                    className="flex w-full items-center px-3 py-2 text-left hover:bg-[var(--c9-bg)] disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => {
                      if (action.kind === 'open_inspector') {
                        selectNode(node.id)
                        close()
                        return
                      }
                      if (action.kind === 'delete') {
                        removeNode(node.id)
                        close()
                        return
                      }
                      if (action.kind === 'chaos') {
                        void runChaos(action.scenario)
                      }
                    }}
                  >
                    <span
                      className={
                        action.kind === 'delete' || action.kind === 'chaos'
                          ? 'font-medium text-red-300/90'
                          : 'font-medium'
                      }
                    >
                      {action.label}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {chaosError ? (
            <p className="border-t border-[var(--c9-border)] px-3 py-2 text-[10px] text-red-400">
              {chaosError}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
