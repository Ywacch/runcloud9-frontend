/** Break single-line SQL into readable lines for walkthrough detail blocks. */
const CLAUSE_BREAKS = [
  'ORDER BY',
  'GROUP BY',
  'LEFT JOIN',
  'RIGHT JOIN',
  'INNER JOIN',
  'OUTER JOIN',
  'JOIN',
  'WHERE',
  'FROM',
  'LIMIT',
  'OFFSET',
] as const

export function formatSqlForDisplay(sql: string): string {
  const trimmed = sql.trim()
  if (!trimmed) return trimmed
  if (trimmed.includes('\n')) return trimmed

  let out = trimmed
  for (const clause of CLAUSE_BREAKS) {
    const re = new RegExp(`\\s+(${clause})\\b`, 'gi')
    out = out.replace(re, `\n$1`)
  }

  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
}
