import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchIndexes,
  fetchRows,
  fetchSchema,
  fetchTables,
  type ColumnInfo,
  type IndexInfo,
  type RowsResult,
  type TableInfo,
} from '../lib/introspectApi'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { trackEvent } from '../lib/analytics'

const PAGE_LIMIT = 50
const CELL_MAX = 120

function truncateCell(v: unknown): { text: string; full: string } {
  const full =
    v === null || v === undefined
      ? ''
      : typeof v === 'object'
        ? JSON.stringify(v)
        : String(v)
  if (full.length <= CELL_MAX) return { text: full, full }
  return { text: `${full.slice(0, CELL_MAX)}…`, full }
}

function ErrorBanner({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="rounded border border-red-700/50 bg-red-950/65 px-2 py-2 text-xs text-red-100">
      <p className="font-medium">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 rounded bg-red-900/80 px-2 py-1 text-[11px] font-semibold text-red-100 hover:bg-red-800"
      >
        Retry
      </button>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-2 py-2">
      <div className="h-4 rounded bg-[var(--c9-surface)]" />
      <div className="h-4 w-3/4 rounded bg-[var(--c9-surface)]" />
      <div className="h-4 w-5/6 rounded bg-[var(--c9-surface)]" />
    </div>
  )
}

function SchemaSection({ columns }: { columns: ColumnInfo[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-t border-[var(--c9-border)] pt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1 text-left text-[11px] font-semibold text-[var(--c9-muted)]"
      >
        <span>{open ? '▾' : '▸'}</span>
        Schema
      </button>
      {open ? (
        <ul className="mt-2 space-y-1.5 text-[10px]">
          {columns.map((c) => (
            <li
              key={c.name}
              className="rounded border border-[var(--c9-border)]/60 bg-[var(--c9-bg)]/50 px-2 py-1 font-mono"
            >
              <span className="text-[var(--c9-text)]">{c.name}</span>{' '}
              <span className="text-[var(--c9-muted)]">{c.dataType}</span>
              {!c.nullable ? (
                <span className="text-amber-400/90"> NOT NULL</span>
              ) : null}
              {c.isPrimaryKey ? (
                <span className="ml-1 rounded bg-[var(--c9-accent)]/25 px-1 text-[9px] text-[var(--c9-accent)]">
                  PK
                </span>
              ) : null}
              {c.defaultValue != null && String(c.defaultValue) !== '' ? (
                <span className="block text-[var(--c9-muted)]">
                  default: {String(c.defaultValue)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function IndexesSection({
  indexes,
  tableName,
}: {
  indexes: IndexInfo[]
  tableName: string | null
}) {
  const [open, setOpen] = useState(false)
  const filtered = useMemo(
    () =>
      tableName
        ? indexes.filter((i) => i.table === tableName)
        : indexes,
    [indexes, tableName],
  )
  return (
    <div className="border-t border-[var(--c9-border)] pt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1 text-left text-[11px] font-semibold text-[var(--c9-muted)]"
      >
        <span>{open ? '▾' : '▸'}</span>
        Indexes
      </button>
      {open ? (
        <ul className="mt-2 space-y-2 text-[10px]">
          {filtered.length === 0 ? (
            <li className="text-[var(--c9-muted)]">No indexes for this table.</li>
          ) : (
            filtered.map((idx) => (
              <li
                key={`${idx.name}-${idx.table}`}
                className="rounded border border-[var(--c9-border)]/60 bg-[var(--c9-bg)]/50 px-2 py-1"
              >
                <div className="font-mono text-[var(--c9-text)]">{idx.name}</div>
                <div className="text-[var(--c9-muted)]">{idx.definition}</div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {idx.primary ? (
                    <span className="rounded bg-[var(--c9-accent)]/20 px-1 text-[9px] text-[var(--c9-accent)]">
                      primary
                    </span>
                  ) : null}
                  {idx.unique ? (
                    <span className="rounded bg-violet-500/20 px-1 text-[9px] text-violet-300">
                      unique
                    </span>
                  ) : null}
                  <span className="text-[var(--c9-muted)]">
                    [{(idx.columns ?? []).join(', ')}]
                  </span>
                </div>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}

interface DataBrowserProps {
  deploymentId: string
  component: string
}

export function DataBrowser({ deploymentId, component }: DataBrowserProps) {
  const [tables, setTables] = useState<TableInfo[]>([])
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [rows, setRows] = useState<RowsResult | null>(null)
  const [schema, setSchema] = useState<ColumnInfo[] | null>(null)
  const [indexes, setIndexes] = useState<IndexInfo[] | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadTablesAndIndexes = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const [tList, idxList] = await Promise.all([
        fetchTables(deploymentId, component),
        fetchIndexes(deploymentId, component),
      ])
      setTables(tList)
      setIndexes(idxList)
      setSelectedTable((prev) =>
        prev && tList.some((x) => x.name === prev)
          ? prev
          : tList[0]?.name ?? null,
      )
      const template = useCanvasStore.getState().snapshotTemplateId ?? 'unknown'
      trackEvent('data_inspector_used', { template, componentType: component, operationCategory: 'list_tables' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tables')
      setTables([])
      setIndexes([])
      setSelectedTable(null)
    } finally {
      setLoading(false)
    }
  }, [deploymentId, component])

  useEffect(() => {
    void loadTablesAndIndexes()
  }, [loadTablesAndIndexes])

  const loadTableData = useCallback(
    async (table: string, pageNum: number, opts?: { refreshOnly?: boolean }) => {
      if (!table) return
      setError(null)
      if (!opts?.refreshOnly) setLoading(true)
      try {
        const [r, s] = await Promise.all([
          fetchRows(deploymentId, component, table, {
            page: pageNum,
            limit: PAGE_LIMIT,
          }),
          fetchSchema(deploymentId, component, table),
        ])
        setRows(r)
        setSchema(s)
        const template = useCanvasStore.getState().snapshotTemplateId ?? 'unknown'
        trackEvent('data_inspector_used', { template, componentType: component, operationCategory: 'fetch_rows' })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load table data')
        setRows(null)
        setSchema(null)
      } finally {
        setLoading(false)
      }
    },
    [deploymentId, component],
  )

  useEffect(() => {
    if (!selectedTable) {
      setRows(null)
      setSchema(null)
      return
    }
    void loadTableData(selectedTable, page)
  }, [selectedTable, page, loadTableData])

  const totalPages = useMemo(() => {
    if (!rows) return 1
    return Math.max(1, Math.ceil(rows.total / (rows.limit || PAGE_LIMIT)))
  }, [rows])

  const currentTableMeta = useMemo(
    () => tables.find((t) => t.name === selectedTable),
    [tables, selectedTable],
  )

  const onRefresh = useCallback(() => {
    if (selectedTable) void loadTableData(selectedTable, page, { refreshOnly: true })
  }, [selectedTable, page, loadTableData])

  const goPrev = () => setPage((p) => Math.max(1, p - 1))
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1))

  if (error && tables.length === 0 && !loading) {
    return (
      <div className="space-y-2">
        <ErrorBanner message={error} onRetry={() => void loadTablesAndIndexes()} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {tables.map((t) => (
          <button
            key={t.name}
            type="button"
            onClick={() => {
              setPage(1)
              setSelectedTable(t.name)
            }}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
              selectedTable === t.name
                ? 'bg-[var(--c9-accent)] text-white'
                : 'bg-[var(--c9-surface)] text-[var(--c9-muted)] hover:text-[var(--c9-text)]'
            }`}
          >
            {t.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void loadTablesAndIndexes()}
          className="ml-auto text-[11px] text-[var(--c9-accent)] hover:underline"
          title="Refresh table list"
        >
          ↻ Refresh
        </button>
      </div>

      {error && tables.length > 0 ? (
        <ErrorBanner message={error} onRetry={onRefresh} />
      ) : null}

      {!selectedTable && !loading ? (
        <p className="py-4 text-center text-xs text-[var(--c9-muted)]">
          No tables available.
        </p>
      ) : null}

      {selectedTable ? (
        <>
          <div className="text-[10px] text-[var(--c9-muted)]">
            {selectedTable}
            {currentTableMeta != null ? (
              <span> (≈{currentTableMeta.rowCount.toLocaleString()} rows)</span>
            ) : null}
          </div>

          {loading && !rows ? <TableSkeleton /> : null}

          {rows && (
            <>
              <div
                className={`overflow-x-auto rounded border border-[var(--c9-border)] bg-[var(--c9-bg)]/70 ${loading ? 'animate-pulse opacity-70' : ''}`}
              >
                {rows.rows.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-[var(--c9-muted)]">
                    No rows found
                  </p>
                ) : (
                  <table className="w-full min-w-max border-collapse text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-[var(--c9-border)]">
                        {(rows.columns.length
                          ? rows.columns
                          : Object.keys(rows.rows[0] ?? {})
                        ).map((col) => (
                          <th
                            key={col}
                            className="whitespace-nowrap px-2 py-1.5 font-semibold text-[var(--c9-muted)]"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.rows.map((row, ri) => {
                        const cols =
                          rows.columns.length > 0
                            ? rows.columns
                            : Object.keys(row)
                        return (
                          <tr
                            key={ri}
                            className="border-b border-[var(--c9-border)] last:border-0"
                          >
                            {cols.map((col) => {
                              const { text, full } = truncateCell(row[col])
                              return (
                                <td
                                  key={col}
                                  className="max-w-[min(12rem,40vw)] truncate px-2 py-1 text-[var(--c9-text)]"
                                  title={full.length > CELL_MAX ? full : undefined}
                                >
                                  {text || '—'}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-[var(--c9-muted)]">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={goPrev}
                    className="rounded border border-[var(--c9-border)] px-1.5 py-0.5 disabled:opacity-40"
                  >
                    ◀
                  </button>
                  <span>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={goNext}
                    className="rounded border border-[var(--c9-border)] px-1.5 py-0.5 disabled:opacity-40"
                  >
                    ▶
                  </button>
                </div>
                <span>
                  {PAGE_LIMIT}/page · {rows.total.toLocaleString()} total
                </span>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={onRefresh}
            className="text-[11px] text-[var(--c9-accent)] hover:underline"
          >
            ↻ Refresh rows
          </button>

          {schema && schema.length > 0 ? (
            <SchemaSection columns={schema} />
          ) : null}
          {indexes != null ? (
            <IndexesSection indexes={indexes} tableName={selectedTable} />
          ) : null}
        </>
      ) : null}
    </div>
  )
}
