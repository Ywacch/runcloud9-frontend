import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { getTemplates } from '../lib/api'
import {
  TEMPLATE_COMING_SOON_HINT,
  TEMPLATE_LIVE_NOT_OFFERED_HINT,
  templateCanLoadInPicker,
  templateOfferBadge,
} from '../lib/templateAvailability'
import {
  buildTemplateLabFamilies,
  type TemplateLabFamily,
  type TemplateLabVariationRow,
} from '../lib/templateLabRows'
import { useTemplateRegistryStore } from '../editor-core/stores/templateRegistryStore'
import { useTemplateFloorPreviewStore } from '../editor-core/stores/templateFloorPreviewStore'
import type { TemplateSelectAction } from './TemplateModal'
import type { TemplateFamilyId } from '../lib/templateFamilyCatalog'

function OfferBadge({ row }: { row: TemplateLabVariationRow }) {
  const badge = templateOfferBadge(row)
  if (badge === 'ready') {
    return (
      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
        Ready
      </span>
    )
  }
  if (badge === 'simulation-only') {
    return (
      <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-medium text-sky-300">
        Simulation only
      </span>
    )
  }
  return (
    <span className="rounded-full bg-gray-500/25 px-2 py-0.5 text-[10px] font-medium text-gray-400">
      Coming soon
    </span>
  )
}

type Props = {
  disabled?: boolean
  loadedVariationId: string | null
  snapshotTemplateId: string | null
  onPlace: (action: TemplateSelectAction) => boolean | void
}

export function TemplateLabSection({
  disabled,
  loadedVariationId,
  snapshotTemplateId,
  onPlace,
}: Props) {
  const [families, setFamilies] = useState<TemplateLabFamily[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openFamilyId, setOpenFamilyId] = useState<TemplateFamilyId | null>(
    'url-shortener',
  )
  const [focusIndex, setFocusIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getTemplates()
      .then((list) => {
        if (cancelled) return
        useTemplateRegistryStore.getState().mergeTemplates(list)
        setFamilies(buildTemplateLabFamilies(list))
        setError(null)
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load templates')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const openFamily = useMemo(
    () => families.find((f) => f.family.id === openFamilyId) ?? null,
    [families, openFamilyId],
  )

  const rows = openFamily?.allVariations ?? []

  const placeRow = useCallback(
    (row: TemplateLabVariationRow) => {
      if (!templateCanLoadInPicker(row)) return false
      return onPlace({
        kind: 'preset',
        id: row.templateId,
        variationId: row.variationId,
        preset: () => row.snapshot,
      })
    },
    [onPlace],
  )

  const previewRow = useCallback(
    (row: TemplateLabVariationRow | null) => {
      const clear = useTemplateFloorPreviewStore.getState().clearPreview
      if (!row || disabled) {
        clear()
        return
      }
      const isPlaced =
        loadedVariationId === row.variationId &&
        snapshotTemplateId === row.templateId
      if (isPlaced) {
        clear()
        return
      }
      useTemplateFloorPreviewStore
        .getState()
        .setPreview(`${row.templateId}:${row.variationId}`, row.snapshot)
    },
    [disabled, loadedVariationId, snapshotTemplateId],
  )

  useEffect(() => {
    return () => useTemplateFloorPreviewStore.getState().clearPreview()
  }, [])

  const onKeyDown = (e: KeyboardEvent) => {
    if (!openFamily || rows.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusIndex((i) => Math.min(rows.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusIndex((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      const row = rows[focusIndex]
      if (row && templateCanLoadInPicker(row)) {
        e.preventDefault()
        placeRow(row)
      }
    }
  }

  const selectedKey =
    snapshotTemplateId && loadedVariationId
      ? `${snapshotTemplateId}:${loadedVariationId}`
      : null

  return (
    <div
      ref={listRef}
      className="space-y-2"
      onKeyDown={onKeyDown}
      role="region"
      aria-label="Template labs"
    >
      {loading ? (
        <p className="text-xs text-[var(--c9-muted)]">Loading labs…</p>
      ) : error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : (
        families.map((item) => {
          const isOpen = openFamilyId === item.family.id
          return (
            <div
              key={item.family.id}
              className="rounded-lg border border-[var(--c9-border)] bg-[var(--c9-badge-bg)]/40"
            >
              <button
                type="button"
                disabled={disabled}
                className="flex w-full flex-col gap-1 px-3 py-2 text-left disabled:opacity-40"
                aria-expanded={isOpen}
                onClick={() => {
                  setOpenFamilyId((cur) =>
                    cur === item.family.id ? null : item.family.id,
                  )
                  setFocusIndex(0)
                  previewRow(null)
                }}
              >
                <span className="text-sm font-semibold text-[var(--c9-text)]">
                  {item.family.title}
                </span>
                <span className="text-[11px] leading-snug text-[var(--c9-muted)]">
                  {item.family.summary}
                </span>
              </button>
              {isOpen ? (
                <ul className="border-t border-[var(--c9-border)] px-1 pb-2 pt-1">
                  {item.allVariations.map((row, idx) => {
                    const loadable = templateCanLoadInPicker(row)
                    const rowKey = `${row.templateId}:${row.variationId}`
                    const selected = selectedKey === rowKey
                    return (
                      <li key={rowKey}>
                        <button
                          type="button"
                          disabled={disabled || !loadable}
                          className={`mt-1 w-full rounded-md px-2 py-2 text-left transition ${
                            selected
                              ? 'border border-blue-500/60 bg-blue-500/10'
                              : 'border border-transparent hover:bg-[var(--c9-surface)]/60'
                          } ${focusIndex === idx && isOpen ? 'ring-1 ring-blue-400/50' : ''} disabled:cursor-not-allowed disabled:opacity-50`}
                          onFocus={() => setFocusIndex(idx)}
                          onMouseEnter={() => previewRow(row)}
                          onMouseLeave={() => previewRow(null)}
                          onFocusCapture={() => previewRow(row)}
                          onBlur={() => previewRow(null)}
                          onClick={() => placeRow(row)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="min-w-0">
                              <span className="block text-xs font-medium text-[var(--c9-text)]">
                                {row.variationLabel}
                              </span>
                              <span className="mt-0.5 block text-[10px] leading-snug text-[var(--c9-muted)]">
                                {row.variationDescription}
                              </span>
                            </span>
                            <OfferBadge row={row} />
                          </div>
                          {!loadable ? (
                            <span className="mt-1 block text-[10px] text-gray-500">
                              {TEMPLATE_COMING_SOON_HINT}
                            </span>
                          ) : !row.available ? (
                            <span className="mt-1 block text-[10px] text-gray-500">
                              {TEMPLATE_LIVE_NOT_OFFERED_HINT}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </div>
          )
        })
      )}
    </div>
  )
}