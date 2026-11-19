import {
  useTemplateFloorPreviewStore,
  type TemplatePreviewKey,
} from '../editor-core/stores/templateFloorPreviewStore'
import type { TemplateLabVariationRow } from '../lib/templateLabRows'

export function variationRowKey(row: {
  templateId: string
  variationId: string
}): TemplatePreviewKey {
  return `${row.templateId}:${row.variationId}` as TemplatePreviewKey
}

export function useTemplateLabPreviewActions(
  /** Blocks floor preview (e.g. active live session). Placement can stay disabled separately. */
  previewDisabled: boolean,
  loadedVariationId: string | null,
  snapshotTemplateId: string | null,
) {
  const previewKey = useTemplateFloorPreviewStore((s) => s.previewKey)

  const clearPreview = () => useTemplateFloorPreviewStore.getState().clearPreview()

  const showPreview = (row: TemplateLabVariationRow | null) => {
    if (previewDisabled) {
      clearPreview()
      return
    }
    if (!row) {
      clearPreview()
      return
    }
    const key = variationRowKey(row)
    const placed =
      loadedVariationId === row.variationId &&
      snapshotTemplateId === row.templateId
    if (placed) {
      clearPreview()
      return
    }
    useTemplateFloorPreviewStore.getState().setPreview(key, row.snapshot)
  }

  const isGhostRow = (row: TemplateLabVariationRow) =>
    previewKey === variationRowKey(row)

  return { previewKey, clearPreview, showPreview, isGhostRow }
}