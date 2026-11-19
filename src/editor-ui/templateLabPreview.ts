import { useCallback } from 'react'
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

export function clearTemplateFloorPreview(): void {
  useTemplateFloorPreviewStore.getState().clearPreview()
}

export function showTemplateFloorPreview(
  row: TemplateLabVariationRow | null,
  opts: {
    previewDisabled: boolean
    loadedVariationId: string | null
    snapshotTemplateId: string | null
  },
): void {
  if (opts.previewDisabled) {
    clearTemplateFloorPreview()
    return
  }
  if (!row) {
    clearTemplateFloorPreview()
    return
  }
  if (row.snapshot.nodes.length === 0) return
  const placed =
    opts.loadedVariationId === row.variationId &&
    opts.snapshotTemplateId === row.templateId
  if (placed) {
    clearTemplateFloorPreview()
    return
  }
  useTemplateFloorPreviewStore
    .getState()
    .setPreview(variationRowKey(row), row.snapshot)
}

export function useTemplateLabPreviewActions(
  /** Blocks floor preview (e.g. active live session). Placement can stay disabled separately. */
  previewDisabled: boolean,
  loadedVariationId: string | null,
  snapshotTemplateId: string | null,
) {
  const previewKey = useTemplateFloorPreviewStore((s) => s.previewKey)

  const clearPreview = useCallback(() => {
    clearTemplateFloorPreview()
  }, [])

  const showPreview = useCallback(
    (row: TemplateLabVariationRow | null) => {
      showTemplateFloorPreview(row, {
        previewDisabled,
        loadedVariationId,
        snapshotTemplateId,
      })
    },
    [previewDisabled, loadedVariationId, snapshotTemplateId],
  )

  const isGhostRow = (row: TemplateLabVariationRow) =>
    previewKey === variationRowKey(row)

  return { previewKey, clearPreview, showPreview, isGhostRow }
}
