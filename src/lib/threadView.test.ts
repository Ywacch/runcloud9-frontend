import { describe, expect, it } from 'vitest'
import {
  buildThreadView,
  formatThreadAge,
  threadPoolOptionLabel,
  threadProxyArgs,
} from './threadView'

const T0 = Date.parse('2026-01-01T12:00:00.000Z')

function post(
  id: number,
  content: string,
  createdAt: string,
  replyTo?: number,
  userId = 1,
): {
  id: number
  user_id: number
  content: string
  created_at: string
  reply_to_id?: number
} {
  const p = {
    id,
    user_id: userId,
    content,
    created_at: createdAt,
  }
  if (replyTo != null) return { ...p, reply_to_id: replyTo }
  return p
}

describe('buildThreadView', () => {
  it('root and no replies', () => {
    const view = buildThreadView(
      {
        rootId: 10,
        parents: [post(10, 'hello', '2026-01-01T11:00:00.000Z')],
        replies: [],
      },
      T0,
    )
    expect(view.replyCount).toBe(0)
    expect(view.root.id).toBe(10)
    expect(view.root.content).toBe('hello')
    expect(view.root.children).toHaveLength(0)
  })

  it('missing root', () => {
    const view = buildThreadView({ rootId: 10, parents: [], replies: [] }, T0)
    expect(view.root.missing).toBe(true)
    expect(view.root.content).toBe('root not visible on this replica yet')
  })

  it('reply under a present root', () => {
    const view = buildThreadView(
      {
        rootId: 10,
        parents: [post(10, 'root', '2026-01-01T11:00:00.000Z')],
        replies: [post(11, 'child', '2026-01-01T11:01:00.000Z', 10)],
      },
      T0,
    )
    expect(view.replyCount).toBe(1)
    expect(view.root.children).toHaveLength(1)
    expect(view.root.children[0].id).toBe(11)
  })

  it('orphan reply with placeholder under the root', () => {
    const view = buildThreadView(
      {
        rootId: 10,
        parents: [post(10, 'root', '2026-01-01T11:00:00.000Z')],
        replies: [post(11, 'orphan', '2026-01-01T11:01:00.000Z', 99)],
      },
      T0,
    )
    expect(view.root.children).toHaveLength(1)
    const placeholder = view.root.children[0]
    expect(placeholder.missing).toBe(true)
    expect(placeholder.content).toBe('parent not visible on this replica yet')
    expect(placeholder.children).toHaveLength(1)
    expect(placeholder.children[0].id).toBe(11)
  })

  it('reply whose parent is another reply', () => {
    const view = buildThreadView(
      {
        rootId: 10,
        parents: [
          post(10, 'root', '2026-01-01T11:00:00.000Z'),
          post(11, 'mid', '2026-01-01T11:01:00.000Z', 10),
        ],
        replies: [
          post(11, 'mid', '2026-01-01T11:01:00.000Z', 10),
          post(12, 'leaf', '2026-01-01T11:02:00.000Z', 11),
        ],
      },
      T0,
    )
    const mid = view.root.children.find((n) => n.id === 11)
    expect(mid?.children.some((n) => n.id === 12)).toBe(true)
  })

  it('sorts replies by created_at ascending', () => {
    const view = buildThreadView(
      {
        rootId: 10,
        parents: [post(10, 'root', '2026-01-01T11:00:00.000Z')],
        replies: [
          post(12, 'later', '2026-01-01T11:03:00.000Z', 10),
          post(11, 'earlier', '2026-01-01T11:01:00.000Z', 10),
        ],
      },
      T0,
    )
    expect(view.root.children.map((n) => n.id)).toEqual([11, 12])
  })

  it('deduplicates reply ids', () => {
    const view = buildThreadView(
      {
        rootId: 10,
        parents: [post(10, 'root', '2026-01-01T11:00:00.000Z')],
        replies: [
          post(11, 'first', '2026-01-01T11:01:00.000Z', 10),
          post(11, 'ignored', '2026-01-01T11:02:00.000Z', 10),
        ],
      },
      T0,
    )
    expect(view.replyCount).toBe(1)
    expect(view.root.children).toHaveLength(1)
    expect(view.root.children[0].content).toBe('first')
  })

  it('flattens a chain deeper than depth 6', () => {
    const parents = [post(1, 'r', '2026-01-01T10:00:00.000Z')]
    const replies = []
    for (let id = 2; id <= 9; id++) {
      replies.push(
        post(id, `n${id}`, `2026-01-01T10:0${id - 1}:00.000Z`, id - 1),
      )
    }
    const view = buildThreadView({ rootId: 1, parents, replies }, T0)
    let node = view.root
    let depth = 0
    while (node.children.length === 1 && !node.children[0].flattened) {
      node = node.children[0]
      depth++
    }
    expect(depth).toBe(6)
    expect(node.children.some((c) => c.flattened)).toBe(true)
  })
})

describe('formatThreadAge', () => {
  const now = Date.parse('2026-01-01T12:00:00.000Z')

  it('returns empty for bad input', () => {
    expect(formatThreadAge('', now)).toBe('')
    expect(formatThreadAge('not-a-date', now)).toBe('')
  })

  it('formats short intervals', () => {
    expect(formatThreadAge('2026-01-01T11:59:30.000Z', now)).toBe('just now')
    expect(formatThreadAge('2026-01-01T11:58:00.000Z', now)).toBe('2m ago')
    expect(formatThreadAge('2026-01-01T07:00:00.000Z', now)).toBe('5h ago')
  })

  it('formats dates older than 24h', () => {
    expect(formatThreadAge('2025-12-30T12:00:00.000Z', now)).toBe('2025-12-30')
  })
})

describe('threadPoolOptionLabel', () => {
  it('uses singular reply for count 1', () => {
    expect(threadPoolOptionLabel(1234, 1)).toBe('#1234 · 1 reply')
  })

  it('uses plural replies otherwise', () => {
    expect(threadPoolOptionLabel(1234, 6)).toBe('#1234 · 6 replies')
  })
})

describe('threadProxyArgs', () => {
  it('omits act-as when empty', () => {
    expect(threadProxyArgs('thread-pool', '')).toEqual({ path: 'thread-pool' })
    expect(threadProxyArgs('thread-pool', '   ')).toEqual({ path: 'thread-pool' })
  })

  it('passes through act-as user id', () => {
    expect(threadProxyArgs('threads/42', '42')).toEqual({
      path: 'threads/42',
      actAsUserId: '42',
    })
  })
})
