import { useCallback, useEffect, useMemo, useState, type PointerEvent } from 'react'
import { templateCanLoadInPicker } from '../lib/templateAvailability'
import type { TemplateLabVariationRow } from '../lib/templateLabRows'
import { familyMetaForId } from '../lib/templateFamilyMeta'
import type { TemplateFamilyId } from '../lib/templateFamilyCatalog'
import type { TemplateSelectAction } from './TemplateModal'
import { useTemplateLabFamilies } from './useTemplateLabFamilies'
import {
  useTemplateLabPreviewActions,
  variationRowKey,
} from './templateLabPreview'

type Props = {
  disabled?: boolean
  loadedVariationId: string | null
  snapshotTemplateId: string | null
  onPlace: (action: TemplateSelectAction) => boolean | void
}

function isFinePointer(e: PointerEvent): boolean {
  return e.pointerType === 'mouse' || e.pointerType === 'pen'
}

function defaultVariationForFamily(
  variations: TemplateLabVariationRow[],
): TemplateLabVariationRow | null {
  const loadable = variations.filter((row) => templateCanLoadInPicker(row))
  return loadable[0] ?? variations[0] ?? null
}

export function TemplateLabMiniRail({
  disabled,
  loadedVariationId,
  snapshotTemplateId,
  onPlace,
}: Props) {
  const { families, loading } = useTemplateLabFamilies()
  const [variationSel, setVariationSel] = useState<
    Partial<Record<TemplateFamilyId, string>>
  >({})

  const { showPreview, clearPreview } = useTemplateLabPreviewActions(
    Boolean(disabled),
    loadedVariationId,
    snapshotTemplateId,
  )

  useEffect(() => {
    return () => clearPreview()
  }, [clearPreview])

  const rowForFamily = useCallback(
    (familyId: TemplateFamilyId): TemplateLabVariationRow | null => {
      const item = families.find((f) => f.family.id === familyId)
      if (!item) return null
      const selKey = variationSel[familyId]
      if (selKey) {
        const found = item.allVariations.find((r) => variationRowKey(r) === selKey)
        if (found) return found
      }
      if (
        snapshotTemplateId &&
        loadedVariationId &&
        item.allVariations.some(
          (r) =>
            r.templateId === snapshotTemplateId &&
            r.variationId === loadedVariationId,
        )
      ) {
        return (
          item.allVariations.find(
            (r) =>
              r.templateId === snapshotTemplateId &&
              r.variationId === loadedVariationId,
          ) ?? null
        )
      }
      return defaultVariationForFamily(item.allVariations)
    },
    [families, variationSel, snapshotTemplateId, loadedVariationId],
  )

  const placedFamilyId = useMemo((): TemplateFamilyId | null => {
    if (!snapshotTemplateId || !loadedVariationId) return null
    for (const item of families) {
      if (
        item.allVariations.some(
          (r) =>
            r.templateId === snapshotTemplateId &&
            r.variationId === loadedVariationId,
        )
      ) {
        return item.family.id
      }
    }
    return null
  }, [families, snapshotTemplateId, loadedVariationId])

  const placeRow = (row: TemplateLabVariationRow | null, familyId: TemplateFamilyId) => {
    if (!row || !templateCanLoadInPicker(row)) return
    clearPreview()
    const ok = onPlace({
      kind: 'preset',
      id: row.templateId,
      variationId: row.variationId,
      preset: () => row.snapshot,
    })
    if (ok !== false) {
      setVariationSel((s) => ({ ...s, [familyId]: variationRowKey(row) }))
    }
  }

  if (loading || families.length === 0) return null

  return (
    <div className="sl-cv-mini" role="group" aria-label="Labs">
      {families.map((item) => {
        const meta = familyMetaForId(item.family.id)
        const row = rowForFamily(item.family.id)
        const pressed = placedFamilyId === item.family.id
        const tip = row
          ? `${item.family.title} · ${row.variationLabel}`
          : item.family.title
        return (
          <button
            key={item.family.id}
            type="button"
            disabled={disabled || !row || !templateCanLoadInPicker(row)}
            aria-pressed={pressed}
            aria-label={
              pressed
                ? `Placed: ${tip}`
                : `Place ${tip}`
            }
            title={tip}
            onClick={() => placeRow(row, item.family.id)}
            onPointerOver={(e) => {
              if (isFinePointer(e)) showPreview(row)
            }}
            onPointerLeave={(e) => {
              if (isFinePointer(e)) clearPreview()
            }}
            onFocus={() => showPreview(row)}
            onBlur={(e) => {
              if (!e.relatedTarget?.closest('.sl-cv-mini')) clearPreview()
            }}
          >
            <span style={{ color: meta.accent }}>{meta.icon}</span>
          </button>
        )
      })}
    </div>
  )
}