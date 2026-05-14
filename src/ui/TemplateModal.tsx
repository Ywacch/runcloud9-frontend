import { useEffect, useState, type ReactNode } from 'react'
import { getTemplates, type TemplateInfo as ApiTemplateInfo } from '../lib/api'
import { templatePresetToCanvasSnapshot } from '../lib/templatePresetAdapter'
import { useAuthStore } from '../store/authStore'
import { useTemplateRegistryStore } from '../store/templateRegistryStore'
import type { CanvasSnapshot } from '../store/canvasStore'

/** Display names when the API has not been fetched yet (Sidebar label). */
const TEMPLATE_TITLE_FALLBACK: Record<string, string> = {
  'url-shortener': 'URL Shortener',
  ecommerce: 'E-Commerce',
  'social-feed': 'Social Feed',
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
    accent: '#4A90D9',
    icon: LinkIcon,
  },
  ecommerce: {
    accent: '#27AE60',
    icon: CartIcon,
  },
  'social-feed': {
    accent: '#9B59B6',
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

const UPGRADE_TOOLTIP = 'Upgrade to RunCloud9 Premium'

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
    load_balancer: '#4A90D9',
    compute: '#8A9BB0',
    database: '#5C6B7A',
    cache: '#C0392B',
    message_queue: '#E05E8A',
    worker: '#A78BFA',
    client: '#F39C12',
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
          fill={NODE_COLORS[n.type] ?? '#666'}
        />
      ))}
    </svg>
  )
}

function TemplatePickerCard({
  row,
  isPremiumUser,
  onSelect,
}: {
  row: PresetTemplateRow
  isPremiumUser: boolean
  onSelect: (action: TemplateSelectAction) => boolean | void
}) {
  const premiumLocked = row.premium && !isPremiumUser
  const snapshot = row.snapshot

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
        <p className="mt-1.5 line-clamp-3 text-xs text-gray-400">{row.description}</p>
        <p className="mt-2 text-[10px] text-gray-500">
          {row.components} components · {row.bottleneck}
        </p>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            disabled={premiumLocked}
            title={premiumLocked ? UPGRADE_TOOLTIP : undefined}
            onClick={() => {
              if (premiumLocked) return
              onSelect({
                kind: 'preset',
                id: row.id,
                preset: () => snapshot,
              })
            }}
            className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Use preset
          </button>
          <button
            type="button"
            disabled={premiumLocked}
            title={premiumLocked ? UPGRADE_TOOLTIP : undefined}
            onClick={() => {
              if (premiumLocked) return
              onSelect({ kind: 'scratch', id: row.id })
            }}
            className="w-full rounded-lg border border-[var(--c9-border)] bg-[var(--c9-bg)] px-3 py-2 text-sm font-medium text-[var(--c9-text)] transition-colors duration-200 hover:bg-[var(--c9-badge-bg)] disabled:cursor-not-allowed disabled:opacity-50"
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
  isPremiumUser,
}: {
  row: ApiTemplateInfo
  isPremiumUser: boolean
}) {
  const premiumLocked = row.premium && !isPremiumUser
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
        <p className="mt-1.5 line-clamp-3 text-xs text-gray-400">{row.description}</p>
        <p className="mt-2 text-[10px] text-gray-500">
          {row.components} components · {row.bottleneck}
        </p>

        <div className="mt-4">
          {row.deployable ? (
            <button
              type="button"
              disabled
              title={premiumLocked ? UPGRADE_TOOLTIP : remotePresetTitle}
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
  const [items, setItems] = useState<ModalTemplateItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        for (const t of list) {
          const meta = TEMPLATE_META_BY_ID[t.id]
          if (t.preset) {
            next.push({
              kind: 'preset',
              row: {
                ...t,
                icon: meta?.icon ?? LinkIcon,
                accent: meta?.accent ?? '#8A9BB0',
                snapshot: templatePresetToCanvasSnapshot(t.preset, t.id),
              },
            })
          } else {
            next.push({ kind: 'remote', row: t })
          }
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
  }, [open])

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
              Open or use a template
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
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4">
          {loading ? (
            <p className="py-12 text-center text-sm text-[var(--c9-muted)]">Loading templates…</p>
          ) : error ? (
            <p className="py-8 text-center text-sm text-red-400">{error}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {items.map((item) =>
                item.kind === 'preset' ? (
                  <TemplatePickerCard
                    key={item.row.id}
                    row={item.row}
                    isPremiumUser={isPremiumUser}
                    onSelect={(action) => {
                      if (onSelect(action) !== false) onClose()
                    }}
                  />
                ) : (
                  <RemoteTemplateCard
                    key={item.row.id}
                    row={item.row}
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
