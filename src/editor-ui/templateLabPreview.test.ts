import { afterEach, describe, expect, it } from 'vitest'
import { useTemplateFloorPreviewStore } from '../editor-core/stores/templateFloorPreviewStore'
import type { TemplateLabVariationRow } from '../lib/templateLabRows'
import {
  clearTemplateFloorPreview,
  showTemplateFloorPreview,
  variationRowKey,
} from './templateLabPreview'

function row(
  partial: Partial<TemplateLabVariationRow> = {},
): TemplateLabVariationRow {
  return {
    templateId: 'url-shortener',
    variationId: 'app-db',
    variationLabel: 'App and database',
    variationDescription: '',
    snapshot: {
      version: '1.0',
      templateId: 'url-shortener',
      nodes: [
        {
          id: 'app-1',
          type: 'compute',
          position: [0, 0, 0],
          label: 'App',
          config: {},
          status: 'idle',
        },
      ],
      edges: [],
      exportedAt: '2026-01-01T00:00:00.000Z',
    },
    available: true,
    simulatable: true,
    deployable: true,
    premium: false,
    comingSoon: false,
    ...partial,
  }
}

afterEach(() => {
  clearTemplateFloorPreview()
})

describe('showTemplateFloorPreview', () => {
  it('keeps the snapshot after a second hover of the same row', () => {
    const r = row()
    const opts = {
      previewDisabled: false,
      loadedVariationId: null,
      snapshotTemplateId: null,
    }
    showTemplateFloorPreview(r, opts)
    showTemplateFloorPreview(r, opts)
    const st = useTemplateFloorPreviewStore.getState()
    expect(st.previewKey).toBe(variationRowKey(r))
    expect(st.snapshot?.nodes).toHaveLength(1)
  })

  it('does not ghost the variation already on the floor', () => {
    const r = row()
    showTemplateFloorPreview(r, {
      previewDisabled: false,
      loadedVariationId: r.variationId,
      snapshotTemplateId: r.templateId,
    })
    expect(useTemplateFloorPreviewStore.getState().snapshot).toBeNull()
  })

  it('does not ghost during a live session', () => {
    showTemplateFloorPreview(row(), {
      previewDisabled: true,
      loadedVariationId: null,
      snapshotTemplateId: null,
    })
    expect(useTemplateFloorPreviewStore.getState().snapshot).toBeNull()
  })
})
