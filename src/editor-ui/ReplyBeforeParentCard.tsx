import { useCallback, useState } from 'react'
import { FidelityBadge } from './FidelityBadge'
import type { ReplyBeforeParentCardModel } from '../lib/phenomena/replyBeforeParentCard'
import { PHENOMENON_REPLY_BEFORE_PARENT } from '../lib/phenomena/types'
import { trackEvent } from '../lib/analytics'
import { StacklabNote as Note } from './stacklabMetricsUi'
import { SlKv, SlKvList, SlSpacer } from './stacklabPanePrimitives'

export function ReplyBeforeParentCard({ model }: { model: ReplyBeforeParentCardModel }) {
  const [copied, setCopied] = useState(false)
  const copyRequestId = useCallback(async () => {
    const id = model.example?.requestId
    if (!id) return
    try {
      await navigator.clipboard.writeText(id)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }, [model.example?.requestId])

  const onViewTrace = useCallback(() => {
    trackEvent('lab_trace_clicked', { phenomenon: PHENOMENON_REPLY_BEFORE_PARENT })
  }, [])

  return (
    <div className="sl-phenomenon-card">
      <div className="sec-head" style={{ marginBottom: 8 }}>
        <span className="sec-idx">◇</span>
        <div>
          <h2 className="has-tip" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {model.title}
            <FidelityBadge fidelity={model.fidelity} />
          </h2>
          <p className="sec-sub">{model.denominatorNote}</p>
        </div>
      </div>
      {model.incompleteBanner ? <Note mark="!">{model.incompleteBanner}</Note> : null}
      {model.staleNote ? <Note mark="i">{model.staleNote}</Note> : null}
      <SlKvList>
        <SlKv keyLabel="Affected reads" value={model.countLabel} tone="amber" />
        <SlKv keyLabel="Observed rate" value={model.rateLabel} />
      </SlKvList>
      {model.example ? (
        <>
          <SlSpacer />
          <SlKvList>
            <SlKv keyLabel="Thread" value={String(model.example.threadId)} />
            <SlKv
              keyLabel="Reply / parent"
              value={`${model.example.replyId} / ${model.example.parentId}`}
            />
            <SlKv keyLabel="Replies served by" value={model.example.repliesHost} />
            <SlKv keyLabel="Parents served by" value={model.example.parentsHost} />
            <SlKv
              keyLabel="Request id"
              value={
                <button
                  type="button"
                  className="ident-line"
                  style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                  onClick={() => void copyRequestId()}
                  title="Copy request id"
                >
                  {model.example.requestId}
                  {copied ? ' · copied' : ''}
                </button>
              }
            />
          </SlKvList>
          <p className="sec-sub" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="ident-line"
              style={{ opacity: 0.85 }}
              onClick={onViewTrace}
              title="Trace viewer (TR-2)"
            >
              View trace
            </button>
          </p>
        </>
      ) : null}
    </div>
  )
}
