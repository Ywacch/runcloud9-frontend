import { useEffect, useState, type ReactNode } from 'react'
import { getTemplates, type TemplateInfo as ApiTemplateInfo } from '../lib/api'
import { selectTemplatePreset } from '../lib/selectTemplatePreset'
import { templateDisplayCopy } from '../lib/templateDisplayCopy'
import { templatePresetToCanvasSnapshot } from '../lib/templatePresetAdapter'
import { useAuthStore } from '../product/stores/authStore'
import {
  startEngineerCheckout,
  UPGRADE_TO_ENGINEER_LABEL,
} from '../lib/stripeCheckout'
import type { UserRecord } from '../lib/userTier'
import { useTemplateRegistryStore } from '../editor-core/stores/templateRegistryStore'
import type { CanvasSnapshot } from '../editor-core/stores/canvasStore'

/** Display names when the API has not been fetched yet (Sidebar label). */
const TEMPLATE_TITLE_FALLBACK: Record<string, string> = {
  'url-shortener': 'URL Shortener',
  ecommerce: 'E-Commerce',
  'social-feed': 'Social Feed',
  'social-feed-pull': 'Social Feed (Pull)',
}

const SOCIAL_FEED_VARIANT_IDS = new Set(['social-feed', 'social-feed-pull'])

const SOCIAL_FEED_VARIANT_COPY: Record<
  string,
  { label: string; description: string }
> = {
  'social-feed': {
    label: 'Push (async fan-out)',
    description:
      'App publishes to a queue. Workers write timeline updates to Redis.',
  },
  'social-feed-pull': {
    label: 'Pull (DB JOINs)',
    description: 'Feed reads assemble posts with JOINs. No async worker pipeline.',
  },
}

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
}

type PresetTemplateRow = ApiTemplateInfo &
  LocalTemplateMeta & {
    snapshot: CanvasSnapshot
  }

export type TemplateSelectAction =
  | {
      kind: 'preset'
      id: string
      preset: () => CanvasSnapshot
    }
  | {
      kind: 'scratch'
      id: string
    }

type ModalTemplateItem =
  | { kind: 'preset'; row: PresetTemplateRow }
  | { kind: 'remote'; row: ApiTemplateInfo }
  | { kind: 'social-feed-family'; rows: PresetTemplateRow[] }

const UPGRADE_TOOLTIP = 'Upgrade to RunCloud9 Engineer'

function PremiumUpgradeButton({ onDone }: { onDone?: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={busy}
        title={UPGRADE_TOOLTIP}
        onClick={() => {
          setError(null)
          setBusy(true)
          void startEngineerCheckout()
            .then(() => onDone?.())
            .catch((err: unknown) => {
              setError(
                err instanceof Error ? err.message : 'Could not start checkout.',
              )
            })
            .finally(() => setBusy(false))
        }}
        className="w-full rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Starting checkout…' : UPGRADE_TO_ENGINEER_LABEL}
      </button>
      {error ? (
        <p className="text-[10px] text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
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

function MiniTopologyPreview({
  nodes,
  edges,
}: {
  nodes: { id: string; type: string; position: [number, number, number] }[]
  edges: { sourceId: string; targetId: string }[]
}) {
  const positions = new Map(
    nodes.map((n) => [n.id, { x: n.position[0], z: n.position[2] }]),
  )

  const xs = nodes.map((n) => n.position[0])
  const zs = nodes.map((n) => n.position[2])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  const rangeX = maxX - minX || 1
  const rangeZ = maxZ - minZ || 1
  const padded = (v: number, min: number, range: number) =>
    15 + ((v - min) / range) * 70

  const NODE_COLORS: Record<string, string> = {
    load_balancer: 'var(--c9-info)',
    compute: 'var(--c9-text-muted)',
    database: 'var(--c9-text-disabled)',
    cache: 'var(--c9-error)',
    message_queue: 'var(--c9-accent)',
    worker: 'var(--c9-accent-hover)',
    client: 'var(--c9-warning)',
  }

  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      {edges.map((e) => {
        const s = positions.get(e.sourceId)
        const t = positions.get(e.targetId)
        if (!s || !t) return null
        return (
          <line
            key={`${e.sourceId}-${e.targetId}`}
            x1={padded(s.x, minX, rangeX)}
            y1={padded(s.z, minZ, rangeZ)}
            x2={padded(t.x, minX, rangeX)}
            y2={padded(t.z, minZ, rangeZ)}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="0.8"
          />
        )
      })}
      {nodes.map((n) => (
        <circle
          key={n.id}
          cx={padded(n.position[0], minX, rangeX)}
          cy={padded(n.position[2], minZ, rangeZ)}
          r="5"
          fill={NODE_COLORS[n.type] ?? 'var(--c9-text-disabled)'}
        />
      ))}
    </svg>
  )
}

function TemplatePickerCard({
  row,
  userRecord,
  isPremiumUser,
  onSelect,
  onClose,
}: {
  row: PresetTemplateRow
  userRecord: UserRecord | null
  isPremiumUser: boolean
  onSelect: (action: TemplateSelectAction) => boolean | void
  onClose: () => void
}) {
  const premiumLocked = row.premium && !isPremiumUser
  const snapshot = row.snapshot
  const display = templateDisplayCopy(row, userRecord)

  return (
    <div
      className={`relative flex flex-col rounded-xl border border-gray-700 bg-gray-800/50 text-left transition hover:border-gray-600 ${premiumLocked ? 'opacity-60' : ''}`}
    >
      <div className="h-28 rounded-t-xl bg-gray-800/30 p-3">
        <MiniTopologyPreview nodes={snapshot.nodes} edges={snapshot.edges} />
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-start gap-2">
            <span
              className="mt-0.5 shrink-0 text-gray-300"
              style={{ color: row.accent }}
              aria-hidden
            >
              {row.icon}
            </span>
            <h3
              className="min-w-0 flex-1 text-sm font-semibold leading-snug text-white [overflow-wrap:anywhere] line-clamp-2"
              title={row.name}
            >
              {row.name}
            </h3>
          </div>
          {/* Align with title text (past icon + gap: w-5 + gap-2). */}
          <div className="flex flex-wrap items-center gap-1.5 pl-7">
            {premiumLocked ? (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                Premium
              </span>
            ) : row.deployable ? (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                {row.available ? 'Ready' : 'Unavailable'}
              </span>
            ) : row.simulatable ? (
              <span className="rounded-full bg-purple-900/50 px-2 py-0.5 text-[10px] font-medium text-purple-300">
                Simulation only
              </span>
            ) : (
              <span className="rounded-full bg-gray-700 px-2 py-0.5 text-[10px] font-medium text-gray-400">
                Coming soon
              </span>
            )}
          </div>
        </div>
        <p className="mt-1.5 line-clamp-3 text-xs text-gray-400">{display.description}</p>
        <p className="mt-2 text-[10px] text-gray-500">
          {display.components} components · {display.bottleneck}
        </p>

        <div className="mt-4 space-y-2">
          {premiumLocked ? (
            <PremiumUpgradeButton onDone={onClose} />
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  onSelect({
                    kind: 'preset',
                    id: row.id,
                    preset: () => snapshot,
                  })
                }}
                className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
              >
                Use preset
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelect({ kind: 'scratch', id: row.id })
                }}
                className="w-full rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg)] px-3 py-2 text-sm font-medium text-[var(--c9-text)] transition-colors duration-200 hover:bg-[var(--c9-badge-bg)]"
              >
                Start from scratch
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function SocialFeedFamilyCard({
  rows,
  onChooseVariant,
}: {
  rows: PresetTemplateRow[]
  onChooseVariant: () => void
}) {
  const preview = rows.find((r) => r.id === 'social-feed') ?? rows[0]
  const meta = TEMPLATE_META_BY_ID['social-feed']
  return (
    <button
      type="button"
      onClick={onChooseVariant}
      className="relative flex flex-col rounded-xl border border-gray-700 bg-gray-800/50 text-left transition hover:border-gray-600"
    >
      <div className="h-28 rounded-t-xl bg-gray-800/30 p-3">
        <MiniTopologyPreview
          nodes={preview.snapshot.nodes}
          edges={preview.snapshot.edges}
        />
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
          <h3 className="text-sm font-semibold text-white">Social Feed</h3>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Push async fan-out with Redis timeline, or pull reads with database JOINs.
        </p>
        <div className="mt-4 flex items-center justify-end">
          <span className="text-lg font-medium text-[var(--c9-muted)]" aria-hidden>
            →
          </span>
          <span className="sr-only">Open variants</span>
        </div>
      </div>
    </button>
  )
}

function SocialFeedVariantCard({
  row,
  onSelect,
}: {
  row: PresetTemplateRow
  onSelect: (action: TemplateSelectAction) => boolean | void
}) {
  const copy = SOCIAL_FEED_VARIANT_COPY[row.id]
  const snapshot = row.snapshot
  return (
    <div className="relative flex flex-col rounded-xl border border-gray-700 bg-gray-800/50 text-left transition hover:border-gray-600">
      <div className="h-28 rounded-t-xl bg-gray-800/30 p-3">
        <MiniTopologyPreview nodes={snapshot.nodes} edges={snapshot.edges} />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-sm font-semibold text-white">
          {copy?.label ?? row.name}
        </h3>
        <p className="mt-1.5 text-xs text-gray-400">
          {copy?.description ?? row.description}
        </p>
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => {
              onSelect({
                kind: 'preset',
                id: row.id,
                preset: () => snapshot,
              })
            }}
            className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Use preset
          </button>
          <button
            type="button"
            onClick={() => {
              onSelect({ kind: 'scratch', id: row.id })
            }}
            className="w-full rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg)] px-3 py-2 text-sm font-medium text-[var(--c9-text)] transition-colors duration-200 hover:bg-[var(--c9-badge-bg)]"
          >
            Start from scratch
          </button>
        </div>
      </div>
    </div>
  )
}

function RemoteTemplateCard({
  row,
  userRecord,
  isPremiumUser,
}: {
  row: ApiTemplateInfo
  userRecord: UserRecord | null
  isPremiumUser: boolean
}) {
  const premiumLocked = row.premium && !isPremiumUser
  const display = templateDisplayCopy(row, userRecord)
  const remotePresetTitle = 'Canvas preset not available for this template yet'

  return (
    <div
      className={`relative flex flex-col rounded-xl border border-gray-700 bg-gray-800/50 text-left transition hover:border-gray-600 ${premiumLocked ? 'opacity-60' : ''}`}
    >
      <div className="flex h-28 items-center justify-center rounded-t-xl bg-gray-800/30 p-3">
        {LockIconLarge}
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
                Premium
              </span>
            ) : row.deployable ? (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                {row.available ? 'Ready' : 'Unavailable'}
              </span>
            ) : row.simulatable ? (
              <span className="rounded-full bg-purple-900/50 px-2 py-0.5 text-[10px] font-medium text-purple-300">
                Simulation only
              </span>
            ) : (
              <span className="rounded-full bg-gray-700 px-2 py-0.5 text-[10px] font-medium text-gray-400">
                Coming soon
              </span>
            )}
          </div>
        </div>
        <p className="mt-1.5 line-clamp-3 text-xs text-gray-400">{display.description}</p>
        <p className="mt-2 text-[10px] text-gray-500">
          {display.components} components · {display.bottleneck}
        </p>

        <div className="mt-4">
          {premiumLocked ? (
            <PremiumUpgradeButton />
          ) : row.deployable ? (
            <button
              type="button"
              disabled
              title={remotePresetTitle}
              className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Use template
            </button>
          ) : null}
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
  const isPremiumUser = useAuthStore((s) => s.isPremium)
  const userRecord = useAuthStore((s) => s.userRecord)
  const [items, setItems] = useState<ModalTemplateItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [socialFeedVariants, setSocialFeedVariants] = useState<
    PresetTemplateRow[] | null
  >(null)

  useEffect(() => {
    if (!open) setSocialFeedVariants(null)
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
        const next: ModalTemplateItem[] = []
        const socialFeedRows: PresetTemplateRow[] = []
        for (const t of list) {
          const meta = TEMPLATE_META_BY_ID[t.id] ?? TEMPLATE_META_BY_ID['social-feed']
          const preset = selectTemplatePreset(t, userRecord)
          if (SOCIAL_FEED_VARIANT_IDS.has(t.id)) {
            if (preset) {
              socialFeedRows.push({
                ...t,
                icon: meta?.icon ?? UsersIcon,
                accent: meta?.accent ?? 'var(--c9-accent)',
                snapshot: templatePresetToCanvasSnapshot(preset, t.id),
              })
            }
            continue
          }
          if (preset) {
            next.push({
              kind: 'preset',
              row: {
                ...t,
                icon: meta?.icon ?? LinkIcon,
                accent: meta?.accent ?? 'var(--c9-text-muted)',
                snapshot: templatePresetToCanvasSnapshot(preset, t.id),
              },
            })
          } else {
            next.push({ kind: 'remote', row: t })
          }
        }
        if (socialFeedRows.length > 0) {
          next.push({ kind: 'social-feed-family', rows: socialFeedRows })
        }
        setItems(next)
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
  }, [open, userRecord])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

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
              {socialFeedVariants ? 'Social Feed: choose variant' : 'Open or use a template'}
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
          {socialFeedVariants ? (
            <button
              type="button"
              onClick={() => setSocialFeedVariants(null)}
              className="mt-2 text-xs text-[var(--c9-muted)] hover:text-[var(--c9-text)]"
            >
              ← Back to templates
            </button>
          ) : null}
          {!isPremiumUser ? (
            <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100/90">
              Designs loaded for non subscribers are limited. Presets leave out load
              balancers, message queues, and workers.
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4">
          {loading ? (
            <p className="py-12 text-center text-sm text-[var(--c9-muted)]">Loading templates…</p>
          ) : error ? (
            <p className="py-8 text-center text-sm text-red-400">{error}</p>
          ) : socialFeedVariants ? (
            <div className="grid gap-4 md:grid-cols-2">
              {['social-feed', 'social-feed-pull'].map((variantId) => {
                const row = socialFeedVariants.find((r) => r.id === variantId)
                if (!row) return null
                return (
                  <SocialFeedVariantCard
                    key={row.id}
                    row={row}
                    onSelect={(action) => {
                      if (onSelect(action) !== false) onClose()
                    }}
                  />
                )
              })}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {items.map((item) =>
                item.kind === 'preset' ? (
                  <TemplatePickerCard
                    key={item.row.id}
                    row={item.row}
                    userRecord={userRecord}
                    isPremiumUser={isPremiumUser}
                    onClose={onClose}
                    onSelect={(action) => {
                      if (onSelect(action) !== false) onClose()
                    }}
                  />
                ) : item.kind === 'social-feed-family' ? (
                  <SocialFeedFamilyCard
                    key="social-feed-family"
                    rows={item.rows}
                    onChooseVariant={() => setSocialFeedVariants(item.rows)}
                  />
                ) : (
                  <RemoteTemplateCard
                    key={item.row.id}
                    row={item.row}
                    userRecord={userRecord}
                    isPremiumUser={isPremiumUser}
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
