import { useState } from 'react'
import { useInspectorChat } from '../editor-core/hooks/useInspectorChat'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useAuthStore } from '../product/stores/authStore'
import { useDevLiveStripVisible } from '../lib/devCanvasTools'
import { devInstanceScopePreviewEnabled } from '../lib/devInstanceScopePreview'
import {
  INSPECTOR_CHAT_DRAWER_CLASS,
  useLiveChromeStore,
} from '../lib/liveChromeStore'
import { ModelInferenceBadge } from './ModelInferenceBadge'

export function InspectorChatDrawer() {
  const open = useLiveChromeStore((s) => s.chatDrawerOpen)
  const setOpen = useLiveChromeStore((s) => s.setChatDrawerOpen)
  const assistantEnabled = useAuthStore((s) => s.currentUser?.isInternal === true)
  const stripVisible = useDevLiveStripVisible()
  const mode = useCanvasStore((s) => s.mode)
  const deploymentId = useCanvasStore((s) => s.deploymentId)
  const devPreview = devInstanceScopePreviewEnabled(mode)
  const visible =
    assistantEnabled &&
    open &&
    stripVisible &&
    (mode === 'live' || mode === 'simulate' || devPreview)

  const { messages, budget, connected, error, sending, sendMessage } =
    useInspectorChat(deploymentId, visible && !devPreview)
  const [draft, setDraft] = useState('')

  if (!visible) return null

  const budgetLabel =
    budget != null
      ? budget.exhausted
        ? 'Inference budget exhausted'
        : `${budget.remaining.toLocaleString()} tokens left`
      : connected
        ? 'Connecting…'
        : 'Offline'

  return (
    <aside
      className={`sl-inspector flex h-full shrink-0 flex-col border-r border-[var(--c9-border)] ${INSPECTOR_CHAT_DRAWER_CLASS}`}
      aria-label="Session assistant"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--dt-color-divider-inset)] bg-[#1b1b33] px-4 py-2 text-[12px]">
        <span className="text-xs font-semibold text-[var(--c9-text)]">Assistant</span>
        <button
          type="button"
          className="rounded-[7px] border-0 bg-transparent px-1.5 text-[12px] text-[var(--dt-color-text-muted)] hover:bg-white/5 hover:text-white"
          aria-label="Close assistant"
          onClick={() => setOpen(false)}
        >
          Close
        </button>
      </div>
      <p className="border-b border-[var(--c9-border)] px-3 py-1.5 text-[10px] text-[var(--c9-muted)]">
        {budgetLabel}
      </p>
      {devPreview ? (
        <p className="p-3 text-xs text-[var(--c9-muted)]">
          Start a live session to chat with the assistant.
        </p>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-2">
            {messages.length === 0 ? (
              <p className="text-xs text-[var(--c9-muted)]">
                Ask about metrics, chaos events, or design choices in this session.
              </p>
            ) : null}
            {messages.map((m) =>
              m.role === 'user' ? (
                <div
                  key={m.id}
                  className="rounded-lg bg-[var(--c9-surface-elevated)] px-2.5 py-2 text-xs text-[var(--c9-text)]"
                >
                  {m.text}
                </div>
              ) : (
                <div
                  key={m.id}
                  className="rounded-lg border border-[var(--c9-border)] bg-[var(--c9-surface)] px-2.5 py-2 text-xs text-[var(--c9-text)]"
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.streaming ? (
                    <span className="mt-1 inline-block h-3 w-1 animate-pulse bg-violet-400" />
                  ) : null}
                  {(m.claims ?? []).some((c) => c.grounding === 'inferred') ? (
                    <div className="mt-2">
                      <ModelInferenceBadge />
                    </div>
                  ) : null}
                </div>
              ),
            )}
          </div>
          {error ? (
            <p className="px-3 text-[10px] text-amber-300" role="alert">{error}</p>
          ) : null}
          <form
            className="border-t border-[var(--c9-border)] p-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (sending || budget?.exhausted) return
              sendMessage(draft)
              setDraft('')
            }}
          >
            <textarea
              className="mb-2 w-full resize-none rounded-md border border-[var(--c9-border)] bg-[var(--c9-surface)] px-2 py-1.5 text-xs text-[var(--c9-text)]"
              rows={3}
              placeholder="Ask about this session…"
              value={draft}
              disabled={!connected || sending || budget?.exhausted === true}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button
              type="submit"
              className="flex h-[30px] w-full items-center justify-center rounded-[7px] border-0 bg-[var(--dt-color-primary)] text-[12px] font-bold text-white hover:bg-[var(--dt-color-primary-hover)] disabled:opacity-45"
              disabled={!connected || sending || !draft.trim() || budget?.exhausted === true}
            >
              {sending ? 'Thinking…' : 'Send'}
            </button>
          </form>
        </>
      )}
    </aside>
  )
}
