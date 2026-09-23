import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchPeek,
  fetchQueues,
  type PeekResult,
  type QueueInfo,
} from '../lib/introspectApi'
import { SlKv, SlKvList } from './stacklabPanePrimitives'
import {
  fmtKeySize,
  SlDataError,
  SlDataHead,
  SlJsonBlock,
} from './stacklabDataPanels'

function headMessageLabel(body: string): string {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>
    const orderId = parsed.orderId ?? parsed.order_id ?? parsed.post_id ?? parsed.id
    const event = parsed.event ?? parsed.type ?? parsed.content
    if (orderId != null && event != null) return `${String(event)} · id ${String(orderId)}`
    if (orderId != null) return `id ${String(orderId)}`
    if (event != null) return String(event)
  } catch {
    /* keep fallback */
  }
  return 'head message'
}

export function QueueBrowser({
  deploymentId,
  component,
  queueName = 'orders',
}: {
  deploymentId: string
  component: string
  queueName?: string
}) {
  const [queues, setQueues] = useState<QueueInfo[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [peek, setPeek] = useState<PeekResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [peeking, setPeeking] = useState(false)

  const primaryQueue = useMemo(() => {
    const preferred = queues.find((q) => q.name === queueName)
    return preferred ?? queues[0] ?? null
  }, [queues, queueName])

  const selectedQueue = useMemo(
    () => queues.find((q) => q.name === selected) ?? primaryQueue,
    [queues, selected, primaryQueue],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await fetchQueues(deploymentId, component)
      setQueues(list)
      setSelected((prev) => {
        if (prev && list.some((q) => q.name === prev)) return prev
        const preferred = list.find((q) => q.name === queueName)
        return preferred?.name ?? list[0]?.name ?? null
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [deploymentId, component, queueName])

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

  const activeName = selectedQueue?.name ?? queueName
  const subtitle = `${activeName} queue — head of the line.`
  const body = peek?.empty ? undefined : peek?.body

  if (loading) {
    return (
      <>
        <SlDataHead subtitle={subtitle} />
        <p className="note">
          <b>i</b>Loading queues…
        </p>
      </>
    )
  }

  if (error && queues.length === 0) {
    return (
      <>
        <SlDataHead subtitle={subtitle} />
        <SlDataError message={error} onRetry={() => void load()} />
      </>
    )
  }

  return (
    <>
      <SlDataHead subtitle={subtitle} />

      {queues.length > 1 ? (
        <div className="seg" role="group" aria-label="Queue" style={{ marginBottom: 12 }}>
          {queues.map((q) => (
            <button
              key={q.name}
              type="button"
              className={q.name === activeName ? 'is-on' : ''}
              onClick={() => {
                setSelected(q.name)
                setPeek(null)
              }}
            >
              {q.name}
            </button>
          ))}
        </div>
      ) : null}

      {error ? <SlDataError message={error} onRetry={() => void load()} /> : null}

      {selectedQueue ? (
        <SlKvList flush>
          <SlKv
            keyLabel="depth"
            value={
              selectedQueue.available
                ? `${selectedQueue.messages.toLocaleString()} msgs`
                : 'unavailable'
            }
          />
          <SlKv keyLabel="consumers" value={String(selectedQueue.consumers)} />
        </SlKvList>
      ) : null}

      {body ? (
        <>
          <SlKvList flush>
            <SlKv keyLabel="head message" value={headMessageLabel(body)} />
            <SlKv keyLabel="body size" value={fmtKeySize(body.length)} />
          </SlKvList>
          <SlJsonBlock
            title={`${activeName} / head`}
            dialect={peek?.contentType ?? 'application/json'}
            body={body}
          />
        </>
      ) : selectedQueue && !selectedQueue.available ? (
        <p className="note">
          <b>i</b>Queue metadata is unavailable from the broker.
        </p>
      ) : selectedQueue && selectedQueue.messages === 0 ? (
        <p className="note">
          <b>i</b>Queue is empty — nothing to peek.
        </p>
      ) : null}

      {selected ? (
        <>
          <div className="row">
            <div className="row-key">
              <div className="t">Peek head message</div>
              <div className="s">Requeues the head message — it is delivered again afterwards.</div>
            </div>
            <button type="button" className="btn" disabled={peeking} onClick={() => void onPeek()}>
              {peeking ? 'Peeking…' : 'Peek'}
            </button>
          </div>
          {peek?.empty ? (
            <p className="note">
              <b>i</b>Queue empty.
            </p>
          ) : null}
          {peek?.requeued ? (
            <p className="note amber">
              <b>!</b>Message requeued — it will be delivered again.
            </p>
          ) : null}
        </>
      ) : null}
    </>
  )
}
