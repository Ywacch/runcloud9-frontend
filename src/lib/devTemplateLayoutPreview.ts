import type { TemplateInfo, TemplateVariation } from './api'
import { requestCanvasFit } from '../canvas/utils/canvasFitBridge'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useSimulationStore } from '../editor-core/stores/simulationStore'
import { useTemplateRegistryStore } from '../editor-core/stores/templateRegistryStore'
import { ensureLoadBalancerForReplicas } from './ensureLoadBalancerForReplicas'
import { spawnClientLoadgenNode } from './spawnClientNode'
import { TEMPLATE_FAMILIES } from './templateFamilyCatalog'
import { templatePresetToCanvasSnapshot } from './templatePresetAdapter'

/** Vite dev only. Tree-shaken from production builds. */
export function isDevTemplateLayoutPreviewEnabled(): boolean {
  return import.meta.env.DEV
}

export type DevLayoutStage = 'loaded' | 'loadgen' | 'scaled'

export const DEV_LAYOUT_STAGES: { id: DevLayoutStage; label: string; hint: string }[] = [
  { id: 'loaded', label: 'Loaded', hint: 'Template variation as the picker places it' },
  { id: 'loadgen', label: 'Loadgen', hint: 'After live deploy: Traffic Source + reflow' },
  { id: 'scaled', label: 'Loadgen + LB', hint: 'App x2, auto LB, then Traffic Source' },
]

export const DEV_LAYOUT_QUERY_KEY = 'devLayout'
export const DEV_STAGE_QUERY_KEY = 'devStage'

export type DevLayoutSlot = {
  key: string
  templateId: string
  variationId: string
  familyTitle: string
  label: string
}

export type DevLayoutSelection = {
  templateId: string
  variationId: string
  stage: DevLayoutStage
}

export function slotKey(templateId: string, variationId: string): string {
  return `${templateId}:${variationId}`
}

export function parseDevLayoutStage(
  raw: string | null | undefined,
): DevLayoutStage {
  if (raw === 'loadgen' || raw === 'scaled' || raw === 'loaded') return raw
  return 'loaded'
}

export function parseDevLayoutQuery(
  search: string | URLSearchParams,
): DevLayoutSelection | null {
  const params =
    typeof search === 'string' ? new URLSearchParams(search.replace(/^\?/, '')) : search
  const raw = params.get(DEV_LAYOUT_QUERY_KEY)
  if (!raw) return null
  const colon = raw.indexOf(':')
  if (colon <= 0 || colon === raw.length - 1) return null
  return {
    templateId: raw.slice(0, colon),
    variationId: raw.slice(colon + 1),
    stage: parseDevLayoutStage(params.get(DEV_STAGE_QUERY_KEY)),
  }
}

export function writeDevLayoutQuery(selection: DevLayoutSelection): void {
  if (!isDevTemplateLayoutPreviewEnabled() || typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.set(
    DEV_LAYOUT_QUERY_KEY,
    slotKey(selection.templateId, selection.variationId),
  )
  url.searchParams.set(DEV_STAGE_QUERY_KEY, selection.stage)
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

export function listDevLayoutSlots(
  templates: Record<string, TemplateInfo>,
): DevLayoutSlot[] {
  const slots: DevLayoutSlot[] = []
  for (const family of TEMPLATE_FAMILIES) {
    for (const slot of family.slots) {
      const template = templates[slot.templateId]
      const variation = template?.variations?.find((row) => row.id === slot.variationId)
      if (!variation) continue
      slots.push({
        key: slotKey(slot.templateId, slot.variationId),
        templateId: slot.templateId,
        variationId: slot.variationId,
        familyTitle: family.title,
        label: variation.label,
      })
    }
  }
  return slots
}

function findVariation(
  templates: Record<string, TemplateInfo>,
  templateId: string,
  variationId: string,
): TemplateVariation | null {
  const template = templates[templateId]
  const variation = template?.variations?.find((row) => row.id === variationId)
  return variation ?? null
}

function scaleComputeReplicas(): void {
  const st = useCanvasStore.getState()
  for (const node of Object.values(st.nodes)) {
    if (node.type !== 'compute') continue
    const replicas = Number(node.config.replicas ?? 1)
    if (replicas > 1) continue
    st.updateNodeConfig(node.id, { replicas: 2 })
  }
}

/**
 * Replace the canvas with a catalog variation, then optionally the live
 * loadgen / auto-LB layout — no deploy required.
 */
export function applyDevTemplateLayout(
  selection: DevLayoutSelection,
  templates: Record<string, TemplateInfo> = useTemplateRegistryStore.getState().byId,
): boolean {
  if (!isDevTemplateLayoutPreviewEnabled()) return false
  const variation = findVariation(templates, selection.templateId, selection.variationId)
  if (!variation) return false

  useSimulationStore.getState().stop()
  const snapshot = templatePresetToCanvasSnapshot(variation, selection.templateId)
  const st = useCanvasStore.getState()
  st.loadTemplateSnapshot(snapshot, 'design')
  st.setLoadedVariationId(selection.variationId)
  st.setTemplatePresetMode(null)

  if (selection.stage === 'scaled') {
    scaleComputeReplicas()
    ensureLoadBalancerForReplicas()
  }
  if (selection.stage === 'loadgen' || selection.stage === 'scaled') {
    spawnClientLoadgenNode()
  }

  requestCanvasFit()
  writeDevLayoutQuery(selection)
  return true
}
