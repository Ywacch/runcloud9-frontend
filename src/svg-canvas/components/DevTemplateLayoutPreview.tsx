import { useEffect, useMemo, useRef, useState } from 'react'
import { getTemplates } from '../../lib/api'
import {
  applyDevTemplateLayout,
  DEV_LAYOUT_STAGES,
  isDevTemplateLayoutPreviewEnabled,
  listDevLayoutSlots,
  parseDevLayoutQuery,
  type DevLayoutStage,
} from '../../lib/devTemplateLayoutPreview'
import { useTemplateRegistryStore } from '../../editor-core/stores/templateRegistryStore'
import { useCanvasStore } from '../../editor-core/stores/canvasStore'

export function DevTemplateLayoutPreview({ compact = false }: { compact?: boolean }) {
  const templates = useTemplateRegistryStore((s) => s.byId)
  const snapshotTemplateId = useCanvasStore((s) => s.snapshotTemplateId)
  const loadedVariationId = useCanvasStore((s) => s.loadedVariationId)
  const [stage, setStage] = useState<DevLayoutStage>('loaded')
  const [error, setError] = useState<string | null>(null)
  const appliedQueryRef = useRef<string | null>(null)

  const slots = useMemo(() => listDevLayoutSlots(templates), [templates])
  const selectedKey =
    snapshotTemplateId && loadedVariationId
      ? `${snapshotTemplateId}:${loadedVariationId}`
      : (slots[0]?.key ?? '')

  useEffect(() => {
    if (!isDevTemplateLayoutPreviewEnabled()) return
    let cancelled = false
    if (Object.keys(useTemplateRegistryStore.getState().byId).length === 0) {
      void getTemplates()
        .then((rows) => {
          if (cancelled) return
          useTemplateRegistryStore.getState().mergeTemplates(rows)
        })
        .catch(() => {
          if (!cancelled) setError('Templates API unavailable')
        })
    }
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isDevTemplateLayoutPreviewEnabled()) return
    if (typeof window === 'undefined') return
    const parsed = parseDevLayoutQuery(window.location.search)
    if (!parsed) return
    if (!templates[parsed.templateId]?.variations?.some((v) => v.id === parsed.variationId)) {
      return
    }
    const key = `${parsed.templateId}:${parsed.variationId}:${parsed.stage}`
    if (appliedQueryRef.current === key) return
    appliedQueryRef.current = key
    setStage(parsed.stage)
    applyDevTemplateLayout(parsed, templates)
  }, [templates])

  if (!isDevTemplateLayoutPreviewEnabled()) return null

  const btn = compact
    ? 'rounded px-1.5 py-0.5 text-[10px]'
    : 'rounded px-2 py-1 text-xs'
  const shell = compact
    ? 'pointer-events-auto flex flex-col gap-1 rounded-md border border-[var(--c9-border)] bg-[var(--c9-surface)]/90 p-1.5 shadow-sm backdrop-blur-sm'
    : 'flex flex-wrap items-center gap-1 rounded-md border border-zinc-300 bg-white p-1'

  const apply = (nextStage: DevLayoutStage, key = selectedKey) => {
    const slot = slots.find((row) => row.key === key)
    if (!slot) {
      setError('Pick a variation after templates load')
      return
    }
    setStage(nextStage)
    setError(null)
    appliedQueryRef.current = `${slot.templateId}:${slot.variationId}:${nextStage}`
    const ok = applyDevTemplateLayout(
      {
        templateId: slot.templateId,
        variationId: slot.variationId,
        stage: nextStage,
      },
      templates,
    )
    if (!ok) setError(`No preset for ${slot.key}`)
  }

  return (
    <div className={shell} data-dev-layout-preview>
      <div className="flex flex-wrap items-center gap-1">
        <span
          className={
            compact ? 'px-1 text-[10px] text-[var(--c9-muted)]' : 'px-1 text-xs text-zinc-500'
          }
        >
          Layout
        </span>
        <select
          className={
            compact
              ? 'max-w-[11rem] rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-1 py-0.5 text-[10px] text-[var(--c9-text)]'
              : 'max-w-[16rem] rounded border border-zinc-300 bg-white px-1 py-0.5 text-xs'
          }
          value={selectedKey}
          disabled={slots.length === 0}
          aria-label="Template variation to preview"
          onChange={(event) => apply(stage, event.target.value)}
        >
          {slots.length === 0 ? (
            <option value="">Loading templates…</option>
          ) : (
            slots.map((slot) => (
              <option key={slot.key} value={slot.key}>
                {slot.familyTitle} · {slot.label}
              </option>
            ))
          )}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {DEV_LAYOUT_STAGES.map((opt) => (
          <button
            key={opt.id}
            type="button"
            title={opt.hint}
            disabled={slots.length === 0}
            className={`${btn} ${
              stage === opt.id
                ? compact
                  ? 'bg-[var(--c9-bg-subtle)] text-[var(--c9-text)]'
                  : 'bg-zinc-800 text-white'
                : compact
                  ? 'text-[var(--c9-muted)] hover:text-[var(--c9-text)]'
                  : 'text-zinc-500 hover:text-zinc-800'
            }`}
            onClick={() => apply(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {error ? (
        <p className={compact ? 'px-1 text-[10px] text-amber-400' : 'px-1 text-xs text-amber-600'}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
