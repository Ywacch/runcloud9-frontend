import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchIndexes,
  fetchRows,
  fetchSchema,
  fetchTables,
  type ColumnInfo,
  type IndexInfo,
  type IntrospectTarget,
  type RowsResult,
  type TableInfo,
} from '../lib/introspectApi'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import {
  introspectRoutingForInstance,
  type SelectedInstanceId,
} from '../lib/dbInstanceScope'
import { trackEvent } from '../lib/analytics'
import { SlSecHead } from './stacklabPanePrimitives'
import {
  formatRowCount,
  SlDataError,
  SlDataHead,
  SlDataPager,
  SlDbRows,
  SlIndexesTable,
  SlSchemaBlock,
} from './stacklabDataPanels'

const PAGE_LIMIT = 6
const DATA_POLL_MS = 8000

interface DataBrowserProps {
  deploymentId: string
  component: string
  readReplicaCount: number
  instanceId?: SelectedInstanceId | null
  hideTargetToggle?: boolean
}

export function DataBrowser({
  deploymentId,
  component,
  readReplicaCount,
  instanceId = null,
  hideTargetToggle = false,
}: DataBrowserProps) {
  const [legacyTarget, setLegacyTarget] = useState<IntrospectTarget>('primary')
  const introspectOpts = useMemo(
    () =>
      hideTargetToggle
        ? introspectRoutingForInstance(instanceId)
        : legacyTarget === 'replica'
          ? { target: 'replica' as const }
          : { target: 'primary' as const },
    [hideTargetToggle, instanceId, legacyTarget],
  )
  const [tables, setTables] = useState<TableInfo[]>([])
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [rows, setRows] = useState<RowsResult | null>(null)
  const [schema, setSchema] = useState<ColumnInfo[] | null>(null)
  const [indexes, setIndexes] = useState<IndexInfo[] | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const showReplicaToggle = !hideTargetToggle && readReplicaCount >= 1

  const loadTablesAndIndexes = useCallback(async (opts?: { soft?: boolean }) => {
    setError(null)
    if (opts?.soft) setRefreshing(true)
    else setLoading(true)
    try {
      const [tList, idxList] = await Promise.all([
        fetchTables(deploymentId, component, introspectOpts),
        fetchIndexes(deploymentId, component, introspectOpts),
      ])
      setTables(tList)
      setIndexes(idxList)
      setSelectedTable((prev) =>
        prev && tList.some((x) => x.name === prev) ? prev : (tList[0]?.name ?? null),
      )
      const template = useCanvasStore.getState().snapshotTemplateId ?? 'unknown'
      trackEvent('data_inspector_used', {
        template,
        componentType: component,
        operationCategory: 'list_tables',
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tables')
      setTables([])
      setIndexes([])
      setSelectedTable(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [deploymentId, component, introspectOpts])

  useEffect(() => {
    setPage(1)
  }, [instanceId, legacyTarget, hideTargetToggle])

  useEffect(() => {
    void loadTablesAndIndexes()
  }, [loadTablesAndIndexes])

  const loadTableData = useCallback(
    async (table: string, pageNum: number, opts?: { refreshOnly?: boolean }) => {
      if (!table) return
      setError(null)
      if (opts?.refreshOnly) setRefreshing(true)
      else setLoading(true)
      try {
        const [r, s] = await Promise.all([
          fetchRows(deploymentId, component, table, {
            page: pageNum,
            limit: PAGE_LIMIT,
            order: 'desc',
            target: introspectOpts.target,
            layerId: introspectOpts.layerId,
          }),
          fetchSchema(deploymentId, component, table, introspectOpts),
        ])
        setRows(r)
        setSchema(s)
        const template = useCanvasStore.getState().snapshotTemplateId ?? 'unknown'
        trackEvent('data_inspector_used', {
          template,
          componentType: component,
          operationCategory: 'fetch_rows',
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load table data')
        setRows(null)
        setSchema(null)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [deploymentId, component, introspectOpts],
  )

  const refreshAll = useCallback(() => {
    void loadTablesAndIndexes({ soft: true })
    if (selectedTable) void loadTableData(selectedTable, page, { refreshOnly: true })
  }, [loadTablesAndIndexes, loadTableData, selectedTable, page])

  useEffect(() => {
    const id = window.setInterval(() => {
      void loadTablesAndIndexes({ soft: true })
      if (selectedTable) void loadTableData(selectedTable, page, { refreshOnly: true })
    }, DATA_POLL_MS)
    return () => window.clearInterval(id)
  }, [loadTablesAndIndexes, loadTableData, selectedTable, page])

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

  const previewCols = useMemo(() => {
    if (!rows) return []
    const cols =
      rows.columns.length > 0 ? rows.columns : Object.keys(rows.rows[0] ?? {})
    return cols.slice(0, 3)
  }, [rows])

  const pageFrom = rows ? (page - 1) * (rows.limit || PAGE_LIMIT) + 1 : 0
  const pageTo = rows
    ? Math.min(rows.total, page * (rows.limit || PAGE_LIMIT))
    : 0

  if (error && tables.length === 0 && !loading) {
    return <SlDataError message={error} onRetry={() => void loadTablesAndIndexes()} />
  }

  return (
    <>
      <SlDataHead
        subtitle="Schema, indexes, and rows for the selected table."
        onRefresh={refreshAll}
        refreshing={refreshing}
      />

      {showReplicaToggle ? (
        <div className="pcfg-field" style={{ paddingTop: 0 }}>
          <span className="lab pcfg-lab">Target</span>
          <div className="pcfg-ctl">
            <div className="seg" role="group" aria-label="Database target">
              {(['primary', 'replica'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={legacyTarget === value ? 'is-on' : ''}
                  onClick={() => {
                    if (value === legacyTarget) return
                    setPage(1)
                    setLegacyTarget(value)
                  }}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          {legacyTarget === 'replica' ? (
            <p className="pcfg-sub">Replica data can lag under async replication.</p>
          ) : null}
        </div>
      ) : null}

      <div className="pt data h">
        <span>table</span>
        <span className="r">rows</span>
      </div>
      {tables.map((t) => {
        const on = selectedTable === t.name
        return (
          <button
            key={t.name}
            type="button"
            className={`pt data rowsel${on ? ' is-on' : ''}`}
            aria-current={on ? 'true' : undefined}
            onClick={() => {
              setPage(1)
              setSelectedTable(t.name)
            }}
          >
            <span>{t.name}</span>
            <span className="r">{formatRowCount(t.rowCount)}</span>
          </button>
        )
      })}

      {error && tables.length > 0 ? (
        <SlDataError
          message={error}
          onRetry={() => {
            if (selectedTable) void loadTableData(selectedTable, page, { refreshOnly: true })
          }}
        />
      ) : null}

      {!selectedTable && !loading ? (
        <p className="note">
          <b>i</b>No tables available.
        </p>
      ) : null}

      {selectedTable && schema && schema.length > 0 ? (
        <SlSchemaBlock
          table={selectedTable}
          columns={schema}
          indexes={(indexes ?? []).filter((idx) => idx.table === selectedTable)}
        />
      ) : null}

      {selectedTable && indexes != null ? (
        <SlIndexesTable indexes={indexes} tableName={selectedTable} />
      ) : null}

      {selectedTable && rows ? (
        <>
          <SlSecHead
            index="D4"
            title="Rows"
            subtitle={`${rows.total.toLocaleString()} rows · newest first. Click a row to inspect every column.`}
          />
          {loading && rows.rows.length === 0 ? (
            <p className="note">
              <b>i</b>Loading rows…
            </p>
          ) : rows.rows.length === 0 ? (
            <p className="note">
              <b>i</b>No rows found.
            </p>
          ) : (
            <SlDbRows columns={rows.columns} rows={rows.rows} previewCols={previewCols} />
          )}
          {rows.total > 0 ? (
            <SlDataPager
              from={pageFrom}
              to={pageTo}
              total={rows.total}
              canPrev={page > 1}
              canNext={page < totalPages}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
            />
          ) : null}
        </>
      ) : null}
    </>
  )
}
