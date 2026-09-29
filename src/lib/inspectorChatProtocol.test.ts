import { describe, expect, it } from 'vitest'
import { parseChatServerFrame } from './inspectorChatProtocol'

describe('parseChatServerFrame', () => {
  it('parses session budget', () => {
    const frame = parseChatServerFrame({
      type: 'session',
      budgetLimit: 50000,
      budgetRemaining: 1200,
      budgetExhausted: false,
    })
    expect(frame?.type).toBe('session')
    if (frame?.type === 'session') {
      expect(frame.budgetRemaining).toBe(1200)
    }
  })

  it('parses assistant end with claims', () => {
    const frame = parseChatServerFrame({
      type: 'assistant_end',
      reply: 'done',
      claims: [
        {
          scope: 'component',
          aspect: 'what',
          text: 'CPU rose',
          grounding: 'inferred',
        },
      ],
    })
    expect(frame?.type).toBe('assistant_end')
    if (frame?.type === 'assistant_end') {
      expect(frame.claims?.[0].grounding).toBe('inferred')
    }
  })
})
