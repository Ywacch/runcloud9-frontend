import { useCallback, useEffect, useRef, useState } from 'react'
import { connectChatWS } from '../../lib/api'
import {
  type ChatBudgetState,
  type InspectorChatMessage,
  parseChatServerFrame,
} from '../../lib/inspectorChatProtocol'

let nextId = 0
function msgId(): string {
  nextId += 1
  return `chat-${nextId}`
}

export function useInspectorChat(deploymentId: string | null, enabled: boolean) {
  const [messages, setMessages] = useState<InspectorChatMessage[]>([])
  const [budget, setBudget] = useState<ChatBudgetState | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const assistantIdRef = useRef<string | null>(null)

  const closeSocket = useCallback(() => {
    const ws = wsRef.current
    wsRef.current = null
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close()
    }
    setConnected(false)
  }, [])

  useEffect(() => {
    if (!enabled || !deploymentId) {
      closeSocket()
      return
    }
    const ws = connectChatWS(deploymentId)
    wsRef.current = ws
    setError(null)
    setMessages([])
    setBudget(null)

    ws.onopen = () => setConnected(true)
    ws.onclose = () => {
      setConnected(false)
      wsRef.current = null
    }
    ws.onerror = () => setError('Chat connection failed')
    ws.onmessage = (ev) => {
      let raw: unknown
      try {
        raw = JSON.parse(String(ev.data))
      } catch {
        return
      }
      const frame = parseChatServerFrame(raw)
      if (!frame) return

      if (frame.type === 'session') {
        setBudget({
          limit: frame.budgetLimit ?? 0,
          spent: frame.budgetSpent ?? 0,
          remaining: frame.budgetRemaining ?? 0,
          exhausted: frame.budgetExhausted === true,
        })
        return
      }
      if (frame.type === 'error') {
        setError(frame.message ?? frame.code ?? 'Chat error')
        setSending(false)
        assistantIdRef.current = null
        return
      }
      if (frame.type === 'assistant_start') {
        const id = msgId()
        assistantIdRef.current = id
        setMessages((prev) => [
          ...prev,
          { id, role: 'assistant', text: '', streaming: true, claims: [] },
        ])
        return
      }
      if (frame.type === 'assistant_delta' && frame.text) {
        const aid = assistantIdRef.current
        if (!aid) return
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aid && m.role === 'assistant'
              ? { ...m, text: m.text + frame.text }
              : m,
          ),
        )
        return
      }
      if (frame.type === 'assistant_claim' && frame.claim) {
        const aid = assistantIdRef.current
        if (!aid) return
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== aid || m.role !== 'assistant') return m
            const claims = [...(m.claims ?? []), frame.claim!]
            return { ...m, claims }
          }),
        )
        return
      }
      if (frame.type === 'assistant_end') {
        const aid = assistantIdRef.current
        assistantIdRef.current = null
        setSending(false)
        if (frame.budgetRemaining !== undefined) {
          setBudget((b) =>
            b
              ? {
                  ...b,
                  spent: frame.budgetSpent ?? b.spent,
                  remaining: frame.budgetRemaining ?? b.remaining,
                  exhausted: (frame.budgetRemaining ?? 0) <= 0,
                }
              : b,
          )
        }
        if (!aid) return
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aid && m.role === 'assistant'
              ? {
                  ...m,
                  text: frame.reply || m.text,
                  streaming: false,
                  claims: frame.claims ?? m.claims,
                }
              : m,
          ),
        )
      }
    }

    return () => {
      ws.close()
      wsRef.current = null
      setConnected(false)
    }
  }, [closeSocket, deploymentId, enabled])

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return
      }
      if (budget?.exhausted) {
        setError('Session inference budget exhausted')
        return
      }
      setSending(true)
      setError(null)
      setMessages((prev) => [...prev, { id: msgId(), role: 'user', text: trimmed }])
      wsRef.current.send(JSON.stringify({ type: 'user_message', text: trimmed }))
    },
    [budget?.exhausted],
  )

  return {
    messages,
    budget,
    connected,
    error,
    sending,
    sendMessage,
  }
}
