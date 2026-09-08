import { useEffect, useState, type ReactNode } from 'react'
import { getTemplates, type TemplateInfo as ApiTemplateInfo, type TemplateVariation } from '../lib/api'
import { templateDisplayCopy } from '../lib/templateDisplayCopy'
import { templatePresetToCanvasSnapshot } from '../lib/templatePresetAdapter'
import { useAuthStore } from '../product/stores/authStore'
import { refreshCurrentUser } from '../lib/auth'
import { hasPaidTier, canAccessPremiumTemplates, type UserRecord } from '../lib/userTier'
import { useTemplateRegistryStore } from '../editor-core/stores/templateRegistryStore'
import type { CanvasSnapshot } from '../editor-core/stores/canvasStore'
import { IsoTopologyPreview } from '../svg-canvas/components/IsoTopologyPreview'
import {
  TEMPLATE_COMING_SOON_HINT,
  TEMPLATE_LIVE_NOT_OFFERED_HINT,
  remoteTemplateVisibleInPicker,
  templateCanLoadInPicker,
  templateOfferBadge,
  type TemplateAvailabilityFlags,
} from '../lib/templateAvailability'
import {
  findTemplateVariation,
  TEMPLATE_FAMILIES,
  type TemplateFamilyConfig,
  type TemplateFamilyId,
} from '../lib/templateFamilyCatalog'

/** Display names when the API has not been fetched yet (Sidebar label). */
const TEMPLATE_TITLE_FALLBACK: Record<string, string> = {
  'url-shortener': 'URL Shortener',
  ecommerce: 'E-Commerce',
  'social-feed': 'Social Feed',
  'social-feed-pull': 'Social Feed (Pull)',
  'ticket-drop': 'Ticket Drop',
}

const FAMILY_TEMPLATE_IDS = new Set(
  TEMPLATE_FAMILIES.flatMap((family) => family.slots.map((slot) => slot.templateId)),
)

export function templateTitleForId(id: string | null): string | null {
  if (!id) return null
  return TEMPLATE_TITLE_FALLBACK[id] ?? id
}

type LocalTemplateMeta = {
  icon: ReactNode
  accent: string
}

const LinkIcon = (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
)

const CartIcon = (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M6 6h15l-1.5 9h-12L4.5 6H2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="9" cy="20" r="1.5" fill="currentColor" />
    <circle cx="18" cy="20" r="1.5" fill="currentColor" />
  </svg>
)

const UsersIcon = (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm12-4v6m-3-3h6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
)

const TicketIcon = (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M4 8h16v3H4V8zm0 5h16v3H4v-3zm2-8h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path d="M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

const TEMPLATE_META_BY_ID: Record<string, LocalTemplateMeta> = {
  'url-shortener': {
    accent: 'var(--c9-info)',
    icon: LinkIcon,
  },
  ecommerce: {
    accent: 'var(--c9-success)',
    icon: CartIcon,
  },
  'social-feed': {
    accent: 'var(--c9-accent)',
    icon: UsersIcon,
  },
  'ticket-drop': {
    accent: 'var(--c9-warning, #f59e0b)',
    icon: TicketIcon,
  },
}

type VariationRow = ApiTemplateInfo &
  LocalTemplateMeta & {
    templateId: string
    variationId: string
    variationLabel: string
    variationDescription: string
    snapshot: CanvasSnapshot
  }

type FamilyModalItem = {
  kind: 'family'
  family: TemplateFamilyConfig
  preview: VariationRow | null
  variations: VariationRow[]
}

export type TemplateSelectAction =
  | {
      kind: 'preset'
      id: string
      variationId: string
      preset: () => CanvasSnapshot
    }
  | {
      kind: 'scratch'
      id: string
    }

type ModalTemplateItem = FamilyModalItem | { kind: 'remote'; row: ApiTemplateInfo }

function TemplateOfferBadgeChip({ row }: { row: TemplateAvailabilityFlags }) {
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
      <span className="rounded-full bg-purple-900/50 px-2 py-0.5 text-[10px] font-medium text-purple-300">
        Simulation only
      </span>
    )
  }
  return (
    <span className="rounded-full bg-gray-700 px-2 py-0.5 text-[10px] font-medium text-gray-400">
      Coming soon
    </span>
  )
}

const LockIconLarge = (
  <svg
    className="mx-auto h-14 w-14 text-gray-500"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <path
      d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v10H6V11Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

function buildVariationRow(
  template: ApiTemplateInfo,
  variation: TemplateVariation,
  meta: LocalTemplateMeta,
  templateId: string,
): VariationRow {
  return {
    ...template,
    templateId,
    variationId: variation.id,
    variationLabel: variation.label,
    variationDescription: variation.description,
    icon: meta.icon,
    accent: meta.accent,
    snapshot: templatePresetToCanvasSnapshot(variation, templateId),
  }
}

function buildFamilyItems(templates: ApiTemplateInfo[]): FamilyModalItem[] {
  const byId = new Map(templates.map((t) => [t.id, t]))
  return TEMPLATE_FAMILIES.map((family) => {
    const meta = TEMPLATE_META_BY_ID[family.metaKey] ?? TEMPLATE_META_BY_ID['social-feed']
    const variations: VariationRow[] = []
    for (const slot of family.slots) {
      const template = byId.get(slot.templateId)
      if (!template) continue
      const variation = findTemplateVariation(template, slot.variationId)
      if (!variation) continue
      variations.push(buildVariationRow(template, variation, meta, slot.templateId))
    }
    const loadable = variations.filter((row) => templateCanLoadInPicker(row))
    return {
      kind: 'family' as const,
      family,
      preview: loadable[0] ?? null,
      variations: loadable,
    }
  }).filter((item) => item.variations.length > 0)
}

function buildModalItems(
  templates: ApiTemplateInfo[],
  canUsePremiumTemplates: boolean,
): ModalTemplateItem[] {
  const familyItems = buildFamilyItems(templates)
  const remote: ModalTemplateItem[] = []
  for (const t of templates) {
    if (FAMILY_TEMPLATE_IDS.has(t.id)) continue
    if (!remoteTemplateVisibleInPicker(t, canUsePremiumTemplates)) continue
    remote.push({ kind: 'remote', row: t })
  }
  return [...familyItems, ...remote]
}

function FamilyCard({
  item,
  onChooseVariant,
}: {
  item: FamilyModalItem
  onChooseVariant: () => void
}) {
  const meta = TEMPLATE_META_BY_ID[item.family.metaKey] ?? TEMPLATE_META_BY_ID['social-feed']
  const preview = item.preview
  return (
    <button
      type="button"
      onClick={onChooseVariant}
      className="relative flex flex-col rounded-xl border border-gray-700 bg-gray-800/50 text-left transition hover:border-gray-600"
    >
      <div className="h-28 rounded-t-xl bg-gray-800/30 p-3">
        {preview ? (
          <IsoTopologyPreview snapshot={preview.snapshot} />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-500">
            Variations unavailable
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start gap-2">
          <span
            className="mt-0.5 shrink-0 text-gray-300"
            style={{ color: meta?.accent ?? 'var(--c9-accent)' }}
            aria-hidden
          >
            {meta?.icon ?? UsersIcon}
          </span>
          <h3 className="text-sm font-semibold text-white">{item.family.title}</h3>
        </div>
        <p className="mt-2 text-xs text-gray-400">{item.family.summary}</p>
        <div className="mt-4 flex items-center justify-end">
          <span className="text-lg font-medium text-[var(--c9-muted)]" aria-hidden>
            →
          </span>
          <span className="sr-only">Open variations</span>
        </div>
      </div>
    </button>
  )
}

function VariationCard({
  row,
  onSelect,
}: {
  row: VariationRow
  onSelect: (action: TemplateSelectAction) => boolean | void
}) {
  const snapshot = row.snapshot
  return (
    <div className="relative flex flex-col rounded-xl border border-gray-700 bg-gray-800/50 text-left transition hover:border-gray-600">
      <div className="h-28 rounded-t-xl bg-gray-800/30 p-3">
        <IsoTopologyPreview snapshot={snapshot} />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-sm font-semibold text-white">{row.variationLabel}</h3>
        <p className="mt-1.5 text-xs text-gray-400">{row.variationDescription}</p>
        <div className="mt-2">
          <TemplateOfferBadgeChip row={row} />
        </div>
        <div className="mt-4 space-y-2">
          {templateCanLoadInPicker(row) ? (
            <>
              <button
                type="button"
                onClick={() => {
                  onSelect({
                    kind: 'preset',
                    id: row.templateId,
                    variationId: row.variationId,
                    preset: () => snapshot,
                  })
                }}
                className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
              >
                Use this variation
              </button>
              {!row.available ? (
                <p className="text-[10px] leading-snug text-gray-500">
                  {TEMPLATE_LIVE_NOT_OFFERED_HINT}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-[10px] leading-snug text-gray-500">
              {TEMPLATE_COMING_SOON_HINT}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function RemoteTemplateCard({
  row,
  userRecord,
  canUsePremiumTemplates,
}: {
  row: ApiTemplateInfo
  userRecord: UserRecord | null
  canUsePremiumTemplates: boolean
}) {
  const premiumLocked = row.premium && !canUsePremiumTemplates
  const display = templateDisplayCopy(row, userRecord)

  return (
    <div
      className={`relative flex flex-col rounded-xl border border-gray-700 bg-gray-800/50 text-left transition hover:border-gray-600 ${premiumLocked ? 'opacity-60' : ''}`}
    >
      <div className="flex h-28 items-center justify-center rounded-t-xl bg-gray-800/30 p-3">
        {premiumLocked ? (
          LockIconLarge
        ) : (
          <p className="px-2 text-center text-xs leading-snug text-gray-400">
            No canvas preset yet for this template.
          </p>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h3
            className="min-w-0 text-sm font-semibold leading-snug text-white [overflow-wrap:anywhere] line-clamp-2"
            title={row.name}
          >
            {row.name}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {premiumLocked ? (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                Unavailable
              </span>
            ) : (
              <TemplateOfferBadgeChip row={row} />
            )}
          </div>
        </div>
        <p className="mt-1.5 line-clamp-3 text-xs text-gray-400">{display.description}</p>
        <p className="mt-2 text-[10px] text-gray-500">
          {display.components} components · {display.bottleneck}
        </p>

        <div className="mt-4 space-y-2">
          {premiumLocked ? (
            <p className="text-[10px] leading-snug text-gray-500">
              This template is not available on your plan.
            </p>
          ) : (
            <p className="text-[10px] leading-snug text-gray-500">
              {TEMPLATE_COMING_SOON_HINT}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function TemplateModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  /** Handle template action in design mode. Return `false` to keep modal open. */
  onSelect: (action: TemplateSelectAction) => boolean | void
}) {
  const userRecord = useAuthStore((s) => s.userRecord)
  const allTemplates = useAuthStore((s) => s.currentUser?.limits.allTemplates)
  const canUsePremiumTemplates = canAccessPremiumTemplates(
    userRecord,
    allTemplates === true,
  )
  const showExplorerLimitsNotice =
    !canUsePremiumTemplates && !hasPaidTier(userRecord)
  const [items, setItems] = useState<ModalTemplateItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeFamily, setActiveFamily] = useState<{
    id: TemplateFamilyId
    title: string
    variations: VariationRow[]
  } | null>(null)

  useEffect(() => {
    if (!open) return
    const { session, currentUser } = useAuthStore.getState()
    if (session?.user?.id && !currentUser) {
      void refreshCurrentUser()
    }
  }, [open])

  useEffect(() => {
    if (!open) setActiveFamily(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getTemplates()
      .then((list) => {
        if (cancelled) return
        useTemplateRegistryStore.getState().mergeTemplates(list)
        setItems(buildModalItems(list, canUsePremiumTemplates))
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load templates')
          setItems([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, userRecord, canUsePremiumTemplates])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const activeTitle = activeFamily
    ? `${activeFamily.title}: choose variation`
    : 'Choose a lab'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--c9-bg)]/65 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[var(--c9-border)] bg-[var(--c9-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-modal-title"
      >
        <div className="shrink-0 border-b border-[var(--c9-border)] px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="template-modal-title" className="text-xl font-semibold text-[var(--c9-text)]">
              {activeTitle}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded p-1 text-[var(--c9-muted)] transition-colors duration-200 hover:bg-[var(--c9-badge-bg)] hover:text-[var(--c9-text)]"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          {activeFamily ? (
            <button
              type="button"
              onClick={() => setActiveFamily(null)}
              className="mt-2 text-xs text-[var(--c9-muted)] hover:text-[var(--c9-text)]"
            >
              ← Back to families
            </button>
          ) : null}
          {showExplorerLimitsNotice ? (
            <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100/90">
              Pick a variation to start. You can tune instance sizes and replicas after load;
              deploy quota still applies.
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4">
          {loading ? (
            <p className="py-12 text-center text-sm text-[var(--c9-muted)]">Loading templates…</p>
          ) : error ? (
            <p className="py-8 text-center text-sm text-red-400">{error}</p>
          ) : activeFamily ? (
            activeFamily.variations.length === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--c9-muted)]">
                No templates available right now.
              </p>
            ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeFamily.variations.map((row) => (
                <VariationCard
                  key={`${row.templateId}:${row.variationId}`}
                  row={row}
                  onSelect={(action) => {
                    if (onSelect(action) !== false) onClose()
                  }}
                />
              ))}
            </div>
            )
          ) : items.length === 0 ? (
            <p className="py-12 text-center text-sm text-[var(--c9-muted)]">
              No templates available right now.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {items.map((item) =>
                item.kind === 'family' ? (
                  <FamilyCard
                    key={item.family.id}
                    item={item}
                    onChooseVariant={() => {
                      setActiveFamily({
                        id: item.family.id,
                        title: item.family.title,
                        variations: item.variations,
                      })
                    }}
                  />
                ) : (
                  <RemoteTemplateCard
                    key={item.row.id}
                    row={item.row}
                    userRecord={userRecord}
                    canUsePremiumTemplates={canUsePremiumTemplates}
                  />
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
