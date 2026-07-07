import { useEffect, useMemo, useState } from 'react'
import {
  createDeployment,
  deleteDeployment,
  getDeployment,
  getTemplates,
  listActiveDeployments,
  startLoadGen,
  stopLoadGen,
  type ActiveDeploymentSummary,
  type DeploymentDesign,
  type TemplateInfo,
} from '../lib/api'
import {
  deployConfigForNode,
  deploymentDesignToSnapshot,
} from '../lib/deployPayload'
import { persistLiveSession } from '../lib/liveSessionStorage'
import { selectTemplatePreset } from '../lib/selectTemplatePreset'
import { templatePresetToCanvasSnapshot } from '../lib/templatePresetAdapter'
import { useAuthStore } from '../product/stores/authStore'
import { useTemplateRegistryStore } from '../editor-core/stores/templateRegistryStore'
import { canvasToBackend } from '../lib/typeMapping'
import type { UserRecord } from '../lib/userTier'

type LaunchResult = {
  index: number
  deploymentId?: string
  namespace?: string
  status?: string
  error?: string
}

function buildDesignForTemplate(
  template: TemplateInfo,
  userRecord: UserRecord | null,
): DeploymentDesign {
  const preset = selectTemplatePreset(template, userRecord)
  const snapshot = preset
    ? templatePresetToCanvasSnapshot(preset, template.id)
    : {
        version: '1.0' as const,
        templateId: template.id,
        nodes: [],
        edges: [],
        exportedAt: new Date().toISOString(),
      }
  const nodes = snapshot.nodes
    .filter((n) => n.type !== 'client')
    .map((n) => ({
      id: n.id,
      type: canvasToBackend[n.type],
      name: n.label,
      config: deployConfigForNode(n),
    }))
  const clientIds = new Set(
    snapshot.nodes.filter((n) => n.type === 'client').map((n) => n.id),
  )
  const connections = snapshot.edges
    .filter(
      (e) => !clientIds.has(e.sourceId) && !clientIds.has(e.targetId),
    )
    .map((e) => ({
      sourceId: e.sourceId,
      targetId: e.targetId,
      protocol: e.protocol,
    }))
  return {
    version: snapshot.version,
    template: template.id,
    archetype: 'standard',
    nodes,
    connections,
  }
}

async function runWithConcurrency(
  total: number,
  concurrency: number,
  runOne: (index: number) => Promise<void>,
): Promise<void> {
  const workerCount = Math.max(1, Math.min(concurrency, total))
  let next = 0
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = next
      next += 1
      if (index >= total) return
      await runOne(index)
    }
  })
  await Promise.all(workers)
}

export default function LoadtestPage() {
  const userRecord = useAuthStore((s) => s.userRecord)
  const [templates, setTemplates] = useState<TemplateInfo[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [count, setCount] = useState(5)
  const [concurrency, setConcurrency] = useState(3)
  const [globalRps, setGlobalRps] = useState(50)
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [launchResults, setLaunchResults] = useState<LaunchResult[]>([])
  const [deployments, setDeployments] = useState<ActiveDeploymentSummary[]>([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [busyLoadgenIds, setBusyLoadgenIds] = useState<Record<string, boolean>>({})
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [terminatingAll, setTerminatingAll] = useState(false)
  const [startingLoadgenAll, setStartingLoadgenAll] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoadingTemplates(true)
    getTemplates()
      .then((rows) => {
        if (cancelled) return
        useTemplateRegistryStore.getState().mergeTemplates(rows)
        setTemplates(rows)
        if (!selectedTemplateId && rows.length > 0) {
          setSelectedTemplateId(rows[0].id)
        }
      })
      .catch(() => {
        if (!cancelled) setTemplates([])
      })
      .finally(() => {
        if (!cancelled) setLoadingTemplates(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      try {
        const rows = await listActiveDeployments()
        if (cancelled) return
        setDeployments(rows)
      } catch {
        if (!cancelled) setDeployments([])
      }
    }
    void refresh()
    const id = window.setInterval(() => {
      void refresh()
    }, 4000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  )

  const visibleDeployments = useMemo(() => {
    const sorted = [...deployments].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    if (statusFilter === 'all') return sorted
    return sorted.filter((d) => d.status === statusFilter)
  }, [deployments, statusFilter])

  const statusByDeploymentId = useMemo(() => {
    const m = new Map<string, string>()
    for (const d of deployments) {
      m.set(d.namespace || d.id, d.status)
    }
    return m
  }, [deployments])

  const statusOptions = useMemo(() => {
    const set = new Set<string>()
    deployments.forEach((d) => set.add(d.status))
    return ['all', ...Array.from(set)]
  }, [deployments])

  const onLaunch = async () => {
    if (!selectedTemplate) return
    const safeCount = Math.max(1, Math.min(200, count))
    const safeConcurrency = Math.max(1, Math.min(20, concurrency))
    setLaunching(true)
    setLaunchResults([])
    const design = buildDesignForTemplate(selectedTemplate, userRecord)
    await runWithConcurrency(safeCount, safeConcurrency, async (index) => {
      try {
        const result = await createDeployment(design)
        setLaunchResults((prev) => [
          ...prev,
          {
            index: index + 1,
            deploymentId: result.deploymentId,
            namespace: result.namespace,
            status: result.status,
          },
        ])
      } catch (e) {
        setLaunchResults((prev) => [
          ...prev,
          {
            index: index + 1,
            error: e instanceof Error ? e.message : 'Launch failed',
          },
        ])
      }
    })
    try {
      const rows = await listActiveDeployments()
      setDeployments(rows)
    } catch {
      /* ignore */
    }
    setLaunching(false)
  }

  const setRowBusy = (id: string, busy: boolean) =>
    setBusyLoadgenIds((prev) => ({ ...prev, [id]: busy }))

  const onStartLoadgen = async (row: ActiveDeploymentSummary) => {
    const id = row.namespace || row.id
    setRowBusy(id, true)
    setRowErrors((prev) => ({ ...prev, [id]: '' }))
    try {
      await startLoadGen(id, {
        rps: Math.max(1, globalRps),
        durationSeconds: 0,
        template: row.template,
      })
    } catch (e) {
      setRowErrors((prev) => ({
        ...prev,
        [id]: e instanceof Error ? e.message : 'Failed to start loadgen',
      }))
    } finally {
      setRowBusy(id, false)
    }
  }

  const onStopLoadgen = async (row: ActiveDeploymentSummary) => {
    const id = row.namespace || row.id
    setRowBusy(id, true)
    setRowErrors((prev) => ({ ...prev, [id]: '' }))
    try {
      await stopLoadGen(id)
    } catch (e) {
      setRowErrors((prev) => ({
        ...prev,
        [id]: e instanceof Error ? e.message : 'Failed to stop loadgen',
      }))
    } finally {
      setRowBusy(id, false)
    }
  }

  const openInCanvas = async (row: ActiveDeploymentSummary) => {
    const id = row.namespace || row.id
    setOpeningId(id)
    setRowErrors((prev) => ({ ...prev, [id]: '' }))
    try {
      const dep = (await getDeployment(id)) as {
        template?: string
        design?: DeploymentDesign
      }
      if (!dep.design) throw new Error('Deployment design not found')
      const snapshot = deploymentDesignToSnapshot(
        dep.design,
        dep.template || row.template,
      )
      persistLiveSession(id, snapshot)
      window.open('/canvas', '_blank', 'noopener')
    } catch (e) {
      setRowErrors((prev) => ({
        ...prev,
        [id]: e instanceof Error ? e.message : 'Could not open deployment',
      }))
    } finally {
      setOpeningId(null)
    }
  }

  const onTerminateAll = async () => {
    if (deployments.length === 0) return
    if (
      !window.confirm(
        `Terminate all ${deployments.length} active deployments? This cannot be undone.`,
      )
    ) {
      return
    }
    setTerminatingAll(true)
    const errors: string[] = []
    await runWithConcurrency(deployments.length, 6, async (index) => {
      const row = deployments[index]
      const id = row.namespace || row.id
      try {
        await deleteDeployment(id)
      } catch (e) {
        errors.push(
          `${id}: ${e instanceof Error ? e.message : 'Termination failed'}`,
        )
      }
    })
    if (errors.length > 0) {
      window.alert(
        `Some deployments failed to terminate:\n\n${errors.slice(0, 10).join('\n')}`,
      )
    }
    try {
      const rows = await listActiveDeployments()
      setDeployments(rows)
    } catch {
      /* ignore */
    }
    setTerminatingAll(false)
  }

  const onStartLoadgenAll = async () => {
    if (visibleDeployments.length === 0) return
    setStartingLoadgenAll(true)
    const errors: string[] = []
    await runWithConcurrency(visibleDeployments.length, 8, async (index) => {
      const row = visibleDeployments[index]
      const id = row.namespace || row.id
      try {
        await startLoadGen(id, {
          rps: Math.max(1, globalRps),
          durationSeconds: 0,
          template: row.template,
        })
        setRowErrors((prev) => ({ ...prev, [id]: '' }))
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Failed to start loadgen'
        setRowErrors((prev) => ({ ...prev, [id]: message }))
        errors.push(`${id}: ${message}`)
      }
    })
    if (errors.length > 0) {
      window.alert(
        `Loadgen failed on some deployments:\n\n${errors.slice(0, 10).join('\n')}`,
      )
    }
    setStartingLoadgenAll(false)
  }

  return (
    <main className="min-h-screen bg-[var(--c9-bg)] px-6 pb-8 pt-24 text-[var(--c9-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-xl border border-[var(--c9-border)] bg-[var(--c9-surface)]/70 p-5">
          <h1 className="text-2xl font-semibold">Concurrent deployment loadtest</h1>
          <p className="mt-1 text-sm text-[var(--c9-muted)]">
            Temporary internal page for spinning up many deployments and operating loadgen before opening canvas.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <label className="space-y-1 text-xs text-[var(--c9-muted)]">
              Template
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-2 py-2 text-sm text-[var(--c9-text)]"
                disabled={loadingTemplates || launching}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.id})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-[var(--c9-muted)]">
              Deployment count
              <input
                type="number"
                min={1}
                max={200}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-2 py-2 text-sm text-[var(--c9-text)]"
                disabled={launching}
              />
            </label>
            <label className="space-y-1 text-xs text-[var(--c9-muted)]">
              Concurrency
              <input
                type="number"
                min={1}
                max={20}
                value={concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value))}
                className="w-full rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-2 py-2 text-sm text-[var(--c9-text)]"
                disabled={launching}
              />
            </label>
            <label className="space-y-1 text-xs text-[var(--c9-muted)]">
              Global RPS
              <input
                type="number"
                min={1}
                max={2000}
                value={globalRps}
                onChange={(e) => setGlobalRps(Number(e.target.value))}
                className="w-full rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-2 py-2 text-sm text-[var(--c9-text)]"
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => void onLaunch()}
                disabled={launching || !selectedTemplate}
                className="w-full rounded bg-[var(--c9-accent)] px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-[var(--c9-accent-hover)] disabled:opacity-50"
              >
                {launching ? 'Launching...' : 'Launch deployments'}
              </button>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void onStartLoadgenAll()}
                disabled={startingLoadgenAll || visibleDeployments.length === 0}
                className="rounded border border-emerald-700 bg-emerald-950/40 px-4 py-2 text-sm font-medium text-emerald-200 transition-colors duration-200 hover:bg-emerald-900/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {startingLoadgenAll
                  ? 'Starting loadgen for all...'
                  : `Start loadgen for all (${visibleDeployments.length})`}
              </button>
              <button
                type="button"
                onClick={() => void onTerminateAll()}
                disabled={terminatingAll || deployments.length === 0}
                className="rounded border border-red-700 bg-red-950/40 px-4 py-2 text-sm font-medium text-red-200 transition-colors duration-200 hover:bg-red-900/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {terminatingAll
                  ? 'Terminating deployments...'
                  : `Terminate all (${deployments.length})`}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--c9-border)] bg-[var(--c9-surface)]/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Launch results</h2>
            <span className="text-xs text-[var(--c9-muted)]">
              {launchResults.length} completed attempts
            </span>
          </div>
          <div className="mt-3 max-h-48 overflow-y-auto rounded border border-[var(--c9-border)] bg-[var(--c9-bg)]/60 p-2">
            {launchResults.length === 0 ? (
              <p className="text-xs text-[var(--c9-muted)]">No launch attempts yet.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {launchResults
                  .slice()
                  .sort((a, b) => a.index - b.index)
                  .map((r) => (
                    <li key={r.index} className="rounded border border-[var(--c9-border)] px-2 py-1">
                      #{r.index}{' '}
                      {r.error
                        ? `error: ${r.error}`
                        : `${r.namespace || r.deploymentId} (${
                            statusByDeploymentId.get(r.namespace || r.deploymentId || '') ||
                            r.status ||
                            'created'
                          })`}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-[var(--c9-border)] bg-[var(--c9-surface)]/70 p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Active deployments</h2>
            <div className="flex items-center gap-2 text-xs text-[var(--c9-muted)]">
              <span>Status filter</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-2 py-1.5 text-xs text-[var(--c9-text)]"
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="text-[var(--c9-muted)]">
                <tr>
                  <th className="border-b border-[var(--c9-border)] px-2 py-2">#</th>
                  <th className="border-b border-[var(--c9-border)] px-2 py-2">Deployment</th>
                  <th className="border-b border-[var(--c9-border)] px-2 py-2">Template</th>
                  <th className="border-b border-[var(--c9-border)] px-2 py-2">Status</th>
                  <th className="border-b border-[var(--c9-border)] px-2 py-2">Created</th>
                  <th className="border-b border-[var(--c9-border)] px-2 py-2">Expires</th>
                  <th className="border-b border-[var(--c9-border)] px-2 py-2">Loadgen</th>
                  <th className="border-b border-[var(--c9-border)] px-2 py-2">Canvas</th>
                </tr>
              </thead>
              <tbody>
                {visibleDeployments.map((d, i) => {
                  const id = d.namespace || d.id
                  const busy = Boolean(busyLoadgenIds[id])
                  return (
                    <tr
                      key={id}
                      className="border-b border-[var(--c9-border)]/60 hover:bg-[var(--c9-bg)]/40"
                    >
                      <td className="px-2 py-2 text-[var(--c9-muted)]">{i + 1}</td>
                      <td className="px-2 py-2 font-mono text-[11px]">{id}</td>
                      <td className="px-2 py-2">{d.template}</td>
                      <td className="px-2 py-2">{d.status}</td>
                      <td className="px-2 py-2">{new Date(d.createdAt).toLocaleString()}</td>
                      <td className="px-2 py-2">{new Date(d.expiresAt).toLocaleString()}</td>
                      <td className="px-2 py-2">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void onStartLoadgen(d)}
                            className="rounded bg-emerald-700 px-2 py-1 text-[11px] text-white disabled:opacity-50"
                          >
                            Start
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void onStopLoadgen(d)}
                            className="rounded bg-amber-700 px-2 py-1 text-[11px] text-white disabled:opacity-50"
                          >
                            Stop
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          disabled={openingId === id}
                          onClick={() => void openInCanvas(d)}
                          className="rounded bg-[var(--c9-accent)] px-2 py-1 text-[11px] text-white disabled:opacity-50"
                        >
                          Open in canvas
                        </button>
                        {rowErrors[id] ? (
                          <p className="mt-1 max-w-[220px] text-[10px] text-red-300">
                            {rowErrors[id]}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}
