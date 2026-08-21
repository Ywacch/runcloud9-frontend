import { describe, expect, it, vi } from 'vitest'
import { withIntrospectTarget } from './introspectApi'

vi.mock('./auth', () => ({
  getAccessToken: vi.fn(),
}))

describe('withIntrospectTarget', () => {
  it('leaves path unchanged for primary or omitted target', () => {
    expect(withIntrospectTarget('tables')).toBe('tables')
    expect(withIntrospectTarget('tables', 'primary')).toBe('tables')
    expect(withIntrospectTarget('rows/foo?page=1', 'primary')).toBe(
      'rows/foo?page=1',
    )
  })

  it('appends ?target=replica when path has no query', () => {
    expect(withIntrospectTarget('tables', 'replica')).toBe(
      'tables?target=replica',
    )
    expect(withIntrospectTarget('schema/users', 'replica')).toBe(
      'schema/users?target=replica',
    )
  })

  it('appends &target=replica when path already has query', () => {
    expect(withIntrospectTarget('rows/foo?page=1', 'replica')).toBe(
      'rows/foo?page=1&target=replica',
    )
  })
})
