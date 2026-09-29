import { useState, type ReactNode } from 'react'
import type { ColumnInfo, IndexInfo } from '../lib/introspectApi'
import { SlSecHead } from './stacklabPanePrimitives'

export function SlDataHead({
  subtitle,
  onRefresh,
  refreshing,
}: {
  subtitle: string
  onRefresh?: () => void
  refreshing?: boolean
}) {
  return (
    <>
      <SlSecHead index="D" title="What is actually in there?" subtitle={subtitle} />
      {onRefresh ? (
        <div className="data-toolbar">
          <button
            type="button"
            className="btn ghost"
            onClick={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      ) : null}
    </>
  )
}

export function SlDataError({
  message,
  onRetry,
  showRetry = true,
}: {
  message: string
  onRetry?: () => void
  showRetry?: boolean
}) {
  const canRetry = showRetry && onRetry != null
  return (
    <p className="note amber">
      <b>!</b>
      {message}
      {canRetry ? (
        <>
          {' '}
          <button
            type="button"
            className="btn ghost"
            onClick={onRetry}
            style={{ marginLeft: 6 }}
          >
            Retry
          </button>
        </>
      ) : null}
    </p>
  )
}

export function SlDataPager({
  from,
  to,
  total,
  canPrev,
  canNext,
  onPrev,
  onNext,
}: {
  from: number
  to: number
  total: number
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div className="pager">
      <button type="button" className="btn ghost" disabled={!canPrev} onClick={onPrev}>
        ← Prev
      </button>
      <span className="pager-lab">
        {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
      </span>
      <button type="button" className="btn ghost" disabled={!canNext} onClick={onNext}>
        Next →
      </button>
    </div>
  )
}

export function formatRowCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0'
  return Math.round(n).toLocaleString()
}

export function fmtTtlHuman(ttl: number, complex = false): string {
  if (ttl < 0) return complex ? 'TTL none' : 'TTL —'
  if (ttl > 0 && ttl < 1) {
    const ms = Math.round(ttl * 1000)
    return complex ? `${ms}ms(TTL)` : `${ms}ms(TTL)`
  }
  const sec = Math.round(ttl)
  return complex ? `${sec}s(TTL)` : `${sec}s(TTL)`
}

export function fmtKeySize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}

export function highlightJson(src: string): ReactNode[] {
  const parts: ReactNode[] = []
  const re =
    /("(?:\\.|[^"\\])*")|(\b(?:true|false|null)\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],:])/g
  let last = 0
  let match: RegExpExecArray | null
  let i = 0
  while ((match = re.exec(src))) {
    if (match.index > last) parts.push(src.slice(last, match.index))
    const [full, str, bool, num, punct] = match
    if (str) parts.push(<span key={i} className="sql-j-s">{str}</span>)
    else if (bool) parts.push(<span key={i} className="sql-j-k">{bool}</span>)
    else if (num) parts.push(<span key={i} className="sql-j-n">{num}</span>)
    else if (punct) parts.push(<span key={i} className="sql-p">{punct}</span>)
    else parts.push(full)
    last = match.index + full.length
    i += 1
  }
  if (last < src.length) parts.push(src.slice(last))
  return parts
}

export function SlJsonBlock({
  title,
  dialect,
  body,
}: {
  title: string
  dialect: string
  body: string
}) {
  let display = body
  try {
    display = JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    /* keep raw body */
  }
  return (
    <div className="sqlblock">
      <div className="sqlbar">
        <span className="sqlbar-name">{title}</span>
        <span className="sqlbar-dialect">{dialect}</span>
      </div>
      <pre className="sqlcode">{highlightJson(display)}</pre>
    </div>
  )
}

function padRight(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length)
}

export function schemaToDdl(
  table: string,
  columns: ColumnInfo[],
  indexes: IndexInfo[] = [],
): string {
  const nameW = Math.max(8, ...columns.map((c) => c.name.length), 0)
  const typeW = Math.max(8, ...columns.map((c) => c.dataType.length), 0)
  const lines = columns.map((c) => {
    let flags = ''
    if (c.isPrimaryKey) flags += ' PRIMARY KEY'
    if (!c.nullable && !c.isPrimaryKey) flags += ' NOT NULL'
    if (c.defaultValue != null && String(c.defaultValue).trim() !== '') {
      flags += ` DEFAULT ${c.defaultValue}`
    }
    return `  ${padRight(c.name, nameW)}  ${padRight(c.dataType, typeW)}${flags}`
  })
  let ddl = `CREATE TABLE ${table} (\n${lines.join(',\n')}\n);`
  for (const idx of indexes) {
    const def = idx.definition?.trim()
    if (!def) continue
    ddl += `\n\n${def.endsWith(';') ? def : `${def};`}`
  }
  return ddl
}

const SQL_KEYWORDS = new Set([
  'CREATE',
  'TABLE',
  'INDEX',
  'UNIQUE',
  'ON',
  'PRIMARY',
  'KEY',
  'NOT',
  'NULL',
  'DEFAULT',
  'REFERENCES',
  'USING',
  'CONSTRAINT',
  'CHECK',
  'FOREIGN',
  'AS',
  'AND',
])

const SQL_TYPES =
  /^(bigint|integer|smallint|int|int2|int4|int8|text|timestamptz|timestamp|boolean|uuid|numeric|jsonb|json|varchar|character|serial|bigserial|date|real|double|float4|float8)$/i

export function highlightSql(src: string): ReactNode[] {
  const parts: ReactNode[] = []
  const re = /(--[^\n]*)|([A-Za-z_][A-Za-z0-9_]*)|([(),;])/g
  let last = 0
  let match: RegExpExecArray | null
  let i = 0
  while ((match = re.exec(src))) {
    if (match.index > last) parts.push(src.slice(last, match.index))
    const [full, comment, word, punct] = match
    if (comment) parts.push(<span key={i} className="sql-c">{comment}</span>)
    else if (word) {
      const cls = SQL_KEYWORDS.has(word.toUpperCase())
        ? 'sql-k'
        : SQL_TYPES.test(word)
          ? 'sql-t'
          : ''
      parts.push(cls ? <span key={i} className={cls}>{word}</span> : word)
    } else if (punct) parts.push(<span key={i} className="sql-p">{punct}</span>)
    else parts.push(full)
    last = match.index + full.length
    i += 1
  }
  if (last < src.length) parts.push(src.slice(last))
  return parts
}

function indexTypeLabel(idx: IndexInfo): string {
  const match = idx.definition?.match(/USING\s+(\w+)/i)
  const method = match ? match[1].toLowerCase() : 'unknown'
  if (idx.primary || idx.unique) return `${method} · unique`
  return method
}

export function SlSchemaBlock({
  table,
  columns,
  indexes = [],
}: {
  table: string
  columns: ColumnInfo[]
  indexes?: IndexInfo[]
}) {
  const ddl = schemaToDdl(table, columns, indexes)
  return (
    <>
      <SlSecHead index="D2" title="Schema" subtitle={`Definition for ${table} as deployed.`} />
      <div className="sqlblock">
        <div className="sqlbar">
          <span className="sqlbar-name">{table}.sql</span>
          <span className="sqlbar-dialect">postgres</span>
        </div>
        <pre className="sqlcode">{highlightSql(ddl)}</pre>
      </div>
    </>
  )
}

export function SlIndexesTable({
  indexes,
  tableName,
}: {
  indexes: IndexInfo[]
  tableName: string
}) {
  const filtered = indexes.filter((i) => i.table === tableName)
  return (
    <>
      <SlSecHead
        index="D3"
        title="Indexes"
        subtitle={
          filtered.length === 0
            ? 'No indexes on this table.'
            : `${filtered.length} index${filtered.length === 1 ? '' : 'es'} on this table.`
        }
      />
      <div className="pod-table" style={{ marginTop: 0 }}>
        <div className="pt idx h">
          <span>index</span>
          <span className="r">type</span>
          <span className="r">use</span>
        </div>
        {filtered.length === 0 ? (
          <div className="pt idx">
            <span className="nul">none</span>
            <span className="r nul">—</span>
            <span className="r nul">—</span>
          </div>
        ) : (
          filtered.map((idx) => (
            <div key={idx.name} className="pt idx">
              <span>{idx.name}</span>
              <span className="r">{indexTypeLabel(idx)}</span>
              <span className="r">
                {idx.primary ? (
                  <span className="flag green">PRIMARY</span>
                ) : idx.unique ? (
                  <span className="flag green">UNIQUE</span>
                ) : (
                  <span className="nul">—</span>
                )}
              </span>
            </div>
          ))
        )}
      </div>
    </>
  )
}

function cellNode(v: unknown): ReactNode {
  if (v === null || v === undefined) return <span className="nul">NULL</span>
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function isNumericColumn(rows: Record<string, unknown>[], col: string): boolean {
  const present = rows.map((row) => row[col]).filter((v) => v != null && v !== '')
  if (present.length === 0) return false
  return present.every((v) => typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)))
}

export function SlDbRows({
  columns,
  rows,
  previewCols,
}: {
  columns: string[]
  rows: Record<string, unknown>[]
  previewCols: string[]
}) {
  const [openRow, setOpenRow] = useState<number | null>(null)
  const gridCols = `12px ${previewCols.map(() => 'minmax(0,1fr)').join(' ')}`
  const alignRight = new Set(previewCols.filter((col) => isNumericColumn(rows, col)))

  return (
    <>
      <div className="dbr-head" style={{ gridTemplateColumns: gridCols }}>
        <span />
        {previewCols.map((col) => (
          <span key={col} className={alignRight.has(col) ? 'r' : undefined}>{col}</span>
        ))}
      </div>
      {rows.map((row, i) => {
        const open = openRow === i
        const allCols = columns.length > 0 ? columns : Object.keys(row)
        return (
          <div key={i} className={`dbr${open ? ' is-open' : ''}`}>
            <button
              type="button"
              className="dbrow"
              style={{ gridTemplateColumns: gridCols }}
              aria-expanded={open}
              onClick={() => setOpenRow(open ? null : i)}
            >
              <span className="car">{open ? '▾' : '▸'}</span>
              {previewCols.map((col) => (
                <span key={col} className={`c${alignRight.has(col) ? ' r' : ''}`}>
                  {cellNode(row[col])}
                </span>
              ))}
            </button>
            <div className="dbrow-full">
              {allCols.map((col) => (
                <div key={col} className="kv">
                  <span className="k">{col}</span>
                  <span className="v">{cellNode(row[col])}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </>
  )
}

const PREVIEW_MAX = 96

function oneLine(value: unknown, max = PREVIEW_MAX): string {
  const raw = typeof value === 'string' ? value : JSON.stringify(value)
  const flat = raw.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

function memberText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && value && 'member' in value) {
    return String((value as { member: unknown }).member)
  }
  return JSON.stringify(value)
}

function previewForValue(
  type: string,
  value: unknown,
): { summary: ReactNode; full: string; expandable: boolean } {
  const t = type.toLowerCase()
  if (t === 'string' || t === 'none') {
    const full = typeof value === 'string' ? value : JSON.stringify(value)
    return { summary: oneLine(full), full, expandable: full.length > PREVIEW_MAX }
  }
  if (t === 'hash' && value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    const fields = Object.keys(record)
    const full = JSON.stringify(value, null, 2)
    return {
      summary: (
        <>
          <b>{fields.length} fields</b> · {oneLine(value, 72)}
        </>
      ),
      full,
      expandable: true,
    }
  }
  if ((t === 'list' || t === 'set' || t === 'zset') && Array.isArray(value)) {
    const arr = value as unknown[]
    const full = JSON.stringify(value, null, 2)
    const shown = arr.slice(0, 6).map(memberText)
    const more = arr.length - shown.length
    return {
      summary: (
        <>
          <b>{arr.length.toLocaleString()} entries</b> · head {shown.join(' · ')}
          {more > 0 ? ` · +${more.toLocaleString()} more` : ''}
        </>
      ),
      full,
      expandable: true,
    }
  }
  const full = JSON.stringify(value, null, 2)
  return { summary: oneLine(full), full, expandable: full.length > PREVIEW_MAX }
}

export function SlKeyCard({
  name,
  type,
  sizeBytes,
  ttl,
  value,
  loading,
  selected,
  onSelect,
}: {
  name: string
  type: string
  sizeBytes: number
  ttl: number
  value: unknown
  loading?: boolean
  selected?: boolean
  onSelect?: () => void
}) {
  const [open, setOpen] = useState(false)
  const complex = type.toLowerCase() !== 'string' && type.toLowerCase() !== 'none'
  const preview = value != null ? previewForValue(type, value) : null
  const expandable = preview?.expandable ?? false

  return (
    <div className={`kc${open ? ' is-open' : ''}${selected ? ' is-selected' : ''}`}>
      <button
        type="button"
        className="kc-top"
        onClick={onSelect}
        disabled={!onSelect}
      >
        <span className="kc-name">{name}</span>
        <span className="kc-type">{type}</span>
        <span className="kc-size">{fmtKeySize(sizeBytes)}</span>
        <span className="kc-ttl">{fmtTtlHuman(ttl, complex)}</span>
      </button>
      {loading ? (
        <div className="kc-prev nul">loading…</div>
      ) : preview ? (
        <>
          <div className="kc-prev">{preview.summary}</div>
          {expandable ? (
            <div className="kc-acts">
              <button
                type="button"
                className="kc-exp"
                onClick={() => setOpen((v) => !v)}
              >
                {open ? '▾ collapse preview' : '▸ expand preview'}
              </button>
            </div>
          ) : null}
          {expandable && open ? <pre className="kc-full">{preview.full}</pre> : null}
        </>
      ) : (
        <div className="kc-prev nul">no value</div>
      )}
    </div>
  )
}
