import { describe, expect, it } from 'vitest'
import { formatSqlForDisplay } from './formatSqlDetail'

describe('formatSqlForDisplay', () => {
  it('breaks a single-line SELECT into clauses', () => {
    const sql =
      'SELECT p.id, p.user_id, u.username, p.content, p.created_at FROM posts p JOIN follows f ON f.following_id = p.user_id JOIN users u ON u.id = p.user_id WHERE f.follower_id = $1 ORDER BY p.created_at DESC LIMIT $2'
    const formatted = formatSqlForDisplay(sql)
    expect(formatted).toContain('SELECT p.id')
    expect(formatted).toContain('\nFROM posts p')
    expect(formatted).toContain('\nJOIN follows f')
    expect(formatted).toContain('\nWHERE f.follower_id')
    expect(formatted).toContain('\nORDER BY p.created_at DESC')
    expect(formatted).toContain('\nLIMIT $2')
  })

  it('leaves already multiline SQL unchanged', () => {
    const sql = 'SELECT 1\nFROM posts'
    expect(formatSqlForDisplay(sql)).toBe(sql)
  })
})
