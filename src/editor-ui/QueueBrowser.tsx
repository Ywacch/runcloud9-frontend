import { useCallback, useEffect, useState } from 'react'
import {
  fetchPeek,
  fetchQueues,
  type PeekResult,
  type QueueInfo,
} from '../lib/introspectApi'

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded border border-red-700/50 bg-red-950/65 px-2 py-2 text-xs text-red-100">
      <p>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 rounded bg-red-900/80 px-2 py-1 text-[11px] font-semibold hover:bg-red-800"
      >
        Retry
      </button>
    </div>
  )
}

export function QueueBrowser({
  deploymentId,
  component,
}: {
  deploymentId: string
  component: string
}) {
  const [queues, setQueues] = useState<QueueInfo[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [peek, setPeek] = useState<PeekResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [peeking, setPeeking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await fetchQueues(deploymentId, component)
      setQueues(list)
      setSelected((prev) => {
        if (prev && list.some((q) => q.name === prev)) return prev
        return list[0]?.name ?? null
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [deploymentId, component])

  useEffect(() => {
    void load()
  }, [load])

  const onPeek = async () => {
    if (!selected) return
    setPeeking(true)
    setError(null)
    try {
      setPeek(await fetchPeek(deploymentId, component, selected))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setPeeking(false)
    }
  }

  if (loading) {
    return <p className="text-xs text-[var(--c9-muted)]">Loading queues…</p>
  }
  if (error && queues.length === 0) {
    return <ErrorBox message={error} onRetry={() => void load()} />
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wider text-[var(--c9-muted)]">
          Queues
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-[var(--c9-border)] px-2 py-0.5 text-[10px] text-[var(--c9-muted)] hover:text-[var(--c9-text)]"
        >
          Refresh
        </button>
      </div>
      {error ? <ErrorBox message={error} onRetry={() => void load()} /> : null}
      <ul className="space-y-1">
        {queues.map((q) => {
          const active = q.name === selected
          return (
            <li key={q.name}>
              <button
                type="button"
                onClick={() => {
                  setSelected(q.name)
                  setPeek(null)
                }}
                className={`flex w-full items-center justify-between rounded border px-2 py-1.5 text-left text-xs ${
                  active
                    ? 'border-[var(--c9-accent)] bg-[var(--c9-surface)]'
                    : 'border-[var(--c9-border)] hover:bg-[var(--c9-surface)]'
                }`}
              >
                <span className="font-mono text-[var(--c9-text)]">{q.name}</span>
                <span className="font-mono text-[10px] text-[var(--c9-muted)]">
                  {q.available
                    ? `${q.messages} msg · ${q.consumers} cons`
                    : 'unavailable'}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {selected ? (
        <div className="space-y-2 rounded border border-[var(--c9-border)] p-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] text-[var(--c9-muted)]">
              Peek head (requeues — does not steal from workers)
            </p>
            <button
              type="button"
              disabled={peeking}
              onClick={() => void onPeek()}
              className="rounded bg-[var(--c9-accent)]/20 px-2 py-0.5 text-[10px] font-semibold text-[var(--c9-text)] disabled:opacity-50"
            >
              {peeking ? 'Peeking…' : 'Peek'}
            </button>
          </div>
          {peek ? (
            peek.empty ? (
              <p className="text-xs text-[var(--c9-muted)]">Queue empty</p>
            ) : (
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] text-[var(--c9-text)]">
                {peek.body ?? ''}
              </pre>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
