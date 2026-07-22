import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../product/stores/authStore'
import {
  listDeploymentHistory,
  getDeployment,
} from '../lib/api'
import type { DeploymentHistoryItem } from '../lib/api'
import { sessionSummaryFromApiMetrics } from '../lib/sessionCapture'
import type { SessionSummary } from '../editor-core/stores/canvasStore'
import { SessionSummaryView } from '../editor-ui/SessionSummary'
import { fmtInt, fmtMs } from '../lib/format'
import { C9Card } from '../editor-ui/c9Primitives'
import {
  displayPlanTierLabel,
  startEngineerCheckout,
  UPGRADE_TO_ENGINEER_LABEL,
} from '../lib/stripeCheckout'

type DetailState =
  | { kind: 'summary'; summary: SessionSummary; title: string; statusLabel: string }
  | { kind: 'no-metrics'; title: string; statusLabel: string }

function fmtDuration(secs: number | undefined): string {
  if (secs == null || !Number.isFinite(secs)) return 'Unavailable'
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

function fmtOptional(
  val: number | undefined,
  fmt: (n: number) => string,
): string {
  return val === undefined ? 'Unavailable' : fmt(val)
}

function capLabel(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function LimitRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[var(--c9-border)] last:border-0">
      <span className="text-sm text-[var(--c9-muted)]">{label}</span>
      <span className="text-sm font-medium text-[var(--c9-text)]">{value}</span>
    </div>
  )
}

function BoolLimit({ label, allowed }: { label: string; allowed: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[var(--c9-border)] last:border-0">
      <span className="text-sm text-[var(--c9-muted)]">{label}</span>
      <span
        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          allowed
            ? 'bg-emerald-500/20 text-emerald-300'
            : 'bg-zinc-700/50 text-[var(--c9-muted)]'
        }`}
      >
        {allowed ? 'Enabled' : 'Not included'}
      </span>
    </div>
  )
}

export default function ProfilePage() {
  const session = useAuthStore((s) => s.session)
  const currentUser = useAuthStore((s) => s.currentUser)

  const [history, setHistory] = useState<DeploymentHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  const [detail, setDetail] = useState<DetailState | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    setHistoryLoading(true)
    setHistoryError(null)
    listDeploymentHistory(20)
      .then((items) => {
        setHistory(items)
        setHistoryLoading(false)
      })
      .catch((err: unknown) => {
        setHistoryError(
          err instanceof Error ? err.message : 'Failed to load history.',
        )
        setHistoryLoading(false)
      })
  }, [session, retryKey])

  const handleCardClick = async (item: DeploymentHistoryItem) => {
    if (detailLoading) return
    setDetailLoading(true)
    try {
      const dep = await getDeployment(item.namespace)
      const metrics = dep.metricsSummary as Record<string, unknown> | undefined
      const title = `Past run · ${item.template}`
      const statusLabel = capLabel(item.status)
      if (!metrics) {
        setDetail({ kind: 'no-metrics', title, statusLabel })
      } else {
        const summary = sessionSummaryFromApiMetrics(item.template, metrics)
        setDetail({ kind: 'summary', summary, title, statusLabel })
      }
    } catch {
      setDetail({
        kind: 'no-metrics',
        title: `Past run · ${item.template}`,
        statusLabel: capLabel(item.status),
      })
    } finally {
      setDetailLoading(false)
    }
  }

  if (!session) {
    return (
      <main className="dot-grid flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--c9-bg)] px-6 pt-20">
        <C9Card className="w-full max-w-md p-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--c9-text)]">
            Sign in to view your profile
          </h1>
          <p className="mt-2 text-sm text-[var(--c9-muted)]">
            Your plan, limits, and past runs are available after signing in.
          </p>
          <Link
            to="/login"
            className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-[var(--c9-accent)] px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-[var(--c9-accent-hover)] active:scale-[0.98]"
          >
            Sign in
          </Link>
        </C9Card>
      </main>
    )
  }

  const limits = currentUser?.limits
  const isFree = currentUser?.effectiveTier === 'free'
  const planLabel = displayPlanTierLabel(currentUser?.effectiveTier)

  const handleUpgrade = () => {
    setCheckoutError(null)
    setCheckoutBusy(true)
    void startEngineerCheckout()
      .catch((err: unknown) => {
        setCheckoutError(
          err instanceof Error ? err.message : 'Could not start checkout.',
        )
      })
      .finally(() => setCheckoutBusy(false))
  }

  return (
    <main className="min-h-[100dvh] bg-[var(--c9-bg)] px-6 pt-24 pb-16">
      <div className="mx-auto max-w-2xl space-y-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--c9-text)]">
          Profile
        </h1>

        {/* Plan and limits */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--c9-muted)]">
            Plan and limits
          </h2>
          <C9Card className="p-4">
            {!currentUser ? (
              <p className="text-sm text-[var(--c9-muted)]">Loading plan info…</p>
            ) : (
              <div>
                <LimitRow label="Plan tier" value={planLabel} />
                {!isFree ? (
                  <p className="py-2 text-sm text-[var(--c9-muted)]">
                    You&apos;re on Engineer.
                  </p>
                ) : (
                  <div className="space-y-2 py-3">
                    <button
                      type="button"
                      disabled={checkoutBusy}
                      onClick={handleUpgrade}
                      className="w-full rounded-lg bg-[var(--c9-accent)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--c9-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {checkoutBusy ? 'Starting checkout…' : UPGRADE_TO_ENGINEER_LABEL}
                    </button>
                    {checkoutError ? (
                      <p className="text-xs text-red-400" role="alert">
                        {checkoutError}
                      </p>
                    ) : null}
                  </div>
                )}
                <LimitRow
                  label="Session default"
                  value={`${limits?.sessionDefaultMins ?? '—'} min`}
                />
                <LimitRow
                  label="Session cap"
                  value={`${limits?.sessionCapMins ?? '—'} min`}
                />
                <LimitRow
                  label="Max concurrent deployments"
                  value={String(limits?.maxConcurrent ?? '—')}
                />
                <LimitRow
                  label="Max app-server replicas"
                  value={String(limits?.maxAppServerReplicas ?? '—')}
                />
                <BoolLimit
                  label="Load balancer"
                  allowed={limits?.allowLoadBalancer ?? false}
                />
                <BoolLimit
                  label="MQ worker"
                  allowed={limits?.allowMQWorker ?? false}
                />
                <BoolLimit
                  label="Proxy cache"
                  allowed={limits?.allowProxyCache ?? false}
                />
                <BoolLimit
                  label="All templates"
                  allowed={limits?.allTemplates ?? false}
                />
              </div>
            )}
          </C9Card>
        </section>

        {/* Past runs */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--c9-muted)]">
            Past runs
          </h2>

          {historyLoading ? (
            <div className="flex items-center gap-3 text-sm text-[var(--c9-muted)]">
              <div
                className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--c9-accent)] border-t-transparent"
                aria-hidden
              />
              Loading…
            </div>
          ) : historyError ? (
            <C9Card className="p-5 text-center">
              <p className="text-sm text-[var(--c9-muted)]">{historyError}</p>
              <button
                type="button"
                onClick={() => setRetryKey((k) => k + 1)}
                className="mt-3 rounded-lg border border-[var(--c9-border)] bg-[var(--c9-surface)] px-4 py-1.5 text-xs text-[var(--c9-muted)] transition-colors hover:text-[var(--c9-text)]"
              >
                Retry
              </button>
            </C9Card>
          ) : history.length === 0 ? (
            <C9Card className="p-5 text-center">
              <p className="text-sm text-[var(--c9-muted)]">No completed runs yet.</p>
            </C9Card>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={detailLoading}
                  onClick={() => void handleCardClick(item)}
                  className="w-full text-left rounded-xl border border-[var(--c9-border)] bg-[var(--c9-surface)]/90 shadow-xl shadow-black/20 px-4 py-3 transition-colors hover:border-[var(--c9-accent)]/60 hover:bg-[var(--c9-surface)] disabled:opacity-60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--c9-text)]">
                        {item.template}
                      </p>
                      <p className="text-xs text-[var(--c9-muted)]">
                        {item.archetype} ·{' '}
                        {new Date(item.createdAt).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        item.status === 'terminated'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {capLabel(item.status)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    <RunStat
                      label="Duration"
                      value={fmtDuration(item.durationSeconds)}
                    />
                    <RunStat
                      label="Peak RPS"
                      value={fmtOptional(item.peakRps, fmtInt)}
                    />
                    <RunStat
                      label="Peak p99"
                      value={fmtOptional(item.peakP99Ms, fmtMs)}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Detail overlay */}
      {detail?.kind === 'summary' && (
        <SessionSummaryView
          summary={detail.summary}
          onDismiss={() => setDetail(null)}
          title={detail.title}
          statusLabel={detail.statusLabel}
          actionLabel="Close"
          modal={true}
        />
      )}

      {detail?.kind === 'no-metrics' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--c9-bg)]/70 p-4 backdrop-blur-sm">
          <C9Card className="w-full max-w-sm p-6 text-center">
            <h2 className="text-base font-semibold text-[var(--c9-text)]">
              {detail.title}
            </h2>
            <p className="mt-1 text-xs text-[var(--c9-muted)]">
              Status: {detail.statusLabel}
            </p>
            <p className="mt-4 text-sm text-[var(--c9-muted)]">
              No metrics summary for this run.
            </p>
            <button
              type="button"
              onClick={() => setDetail(null)}
              className="mt-5 w-full rounded-lg bg-[var(--c9-accent)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--c9-accent-hover)]"
            >
              Close
            </button>
          </C9Card>
        </div>
      )}
    </main>
  )
}

function RunStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-xs text-[var(--c9-muted)]">
      <span className="uppercase tracking-wider">{label}: </span>
      <span className="font-mono text-[var(--c9-text)]">{value}</span>
    </span>
  )
}
