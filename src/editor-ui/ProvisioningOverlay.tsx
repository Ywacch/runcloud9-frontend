import { memo, useMemo, useState, type ReactNode } from 'react'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import {
  DOOR_WAIT_TITLE,
  ROOM_QUEUE_TITLE,
  formatQueueWaitingDetail,
  formatRoomWaitingDetail,
  hasQueueWaitFields,
} from '../lib/deployQueue'
import {
  DEMO_DATA_ROW_TITLE,
  LOADGEN_ROW_TITLE,
  VALIDATE_STEP_SUBTITLE,
  buildSeedWaitContext,
  componentStatusToUserLine,
  instanceLabelForNode,
  loadgenStatusToUserLine,
  provisionDetailCodeToSubtitle,
  seedingStatusToUserLine,
  shouldDefaultExpanded,
  waitCodeToUserLine,
} from '../lib/provisionCopy'
import {
  buildOrderedComponentRows,
  canvasInstanceCount,
  isWaitingForProvisionSlot,
  padReplicaWaitRows,
  parseProvisionMetrics,
  shouldShowReplicaChildren,
  shouldUseLegacyProvisioningPulse,
  type NormalizedLoadgenState,
  type NormalizedSeedingState,
  type ParsedProvisionMetrics,
  type ReplicaWaitRow,
} from '../lib/provisionMetrics'

function IconCheckSm({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
    </svg>
  )
}

function IconCheckCircle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  )
}

function IconSync({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
    </svg>
  )
}

function IconRadioEmpty({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
    </svg>
  )
}

function IconSchedule({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
    </svg>
  )
}

function IconError({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
    </svg>
  )
}

function IconWarning({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
    </svg>
  )
}

function formatElapsedHMS(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return [h, m, s].map((n) => n.toString().padStart(2, '0')).join(':')
}

type CheckRowTone = 'active' | 'ready' | 'neutral' | 'dim' | 'warn' | 'error'

function InfrastructureChecklistRow({
  name,
  statusLabel,
  tone,
  leftIcon,
  detail,
  onToggle,
  expanded,
}: {
  name: string
  statusLabel: string
  tone: CheckRowTone
  leftIcon: ReactNode
  detail?: string
  onToggle?: () => void
  expanded?: boolean
}) {
  const isActive = tone === 'active'
  const isDim = tone === 'dim'
  const isError = tone === 'error'

  return (
    <div
      className={[
        'flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-xs',
        isActive
          ? 'border-[var(--c9-border)] bg-[var(--c9-surface)]/90 shadow-[inset_3px_0_0_0_var(--c9-accent)]'
          : 'border-[var(--c9-border)]/80 bg-[var(--c9-surface)]/50',
        isDim ? 'opacity-65' : '',
      ].join(' ')}
    >
      <div className="flex min-w-0 items-center gap-2">
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex shrink-0 rounded p-0.5 text-[var(--c9-muted)] transition-colors hover:text-[var(--c9-text)]"
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse instances' : 'Expand instances'}
          >
            <svg
              className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`}
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z" />
            </svg>
          </button>
        ) : null}
        <span className="inline-flex shrink-0">{leftIcon}</span>
        <div className="min-w-0">
          <span
            className={`block truncate font-medium ${
              isActive
                ? 'text-[var(--c9-accent)]'
                : isDim
                  ? 'text-[var(--c9-muted)]'
                  : isError
                    ? 'text-red-400'
                    : tone === 'warn'
                      ? 'text-amber-400'
                      : 'text-[var(--c9-text)]'
            }`}
            title={name}
          >
            {name}
          </span>
          {detail ? (
            <span className="mt-0.5 block truncate text-[10px] leading-snug text-[var(--c9-muted)]">
              {detail}
            </span>
          ) : null}
        </div>
      </div>
      <span
        className={[
          'shrink-0 [font-family:JetBrains_Mono,ui-monospace,monospace] text-[11px]',
          isActive
            ? 'font-medium text-[var(--c9-accent)]'
            : tone === 'ready'
              ? 'font-medium text-emerald-400'
              : isDim
                ? 'text-[var(--c9-muted)]'
                : tone === 'warn'
                  ? 'font-medium text-amber-400'
                  : tone === 'error'
                    ? 'font-medium text-red-400'
                    : 'text-[var(--c9-text)]',
        ].join(' ')}
      >
        {statusLabel}
      </span>
    </div>
  )
}

const ComponentProvisionRow = memo(function ComponentProvisionRow({
  row,
  replicaRows,
  expectedCount,
}: {
  row: ReturnType<typeof buildOrderedComponentRows>[number]
  replicaRows: ReplicaWaitRow[] | undefined
  expectedCount: number
}) {
  const showChildren = shouldShowReplicaChildren(
    replicaRows,
    expectedCount,
    row.state,
  )
  const childRows = padReplicaWaitRows(replicaRows, expectedCount)
  const [expanded, setExpanded] = useState(() =>
    shouldDefaultExpanded(childRows),
  )
  const userLine = componentStatusToUserLine(row.state, childRows)
  const visuallyReady = userLine.status === 'Ready'
  let tone: CheckRowTone = 'neutral'
  if (visuallyReady) tone = 'ready'
  else if (row.state === 'deploying') tone = 'active'
  else if (row.state === 'pending' || row.state === 'unknown') tone = 'dim'

  const leftIcon = visuallyReady ? (
    <IconCheckCircle className="h-4 w-4 text-emerald-400" />
  ) : row.state === 'deploying' ? (
      <IconSync className="h-4 w-4 animate-spin text-[var(--c9-accent)]" />
    ) : row.state === 'failed' ? (
      <IconError className="h-4 w-4 text-red-400" />
    ) : (
      <IconRadioEmpty className="h-4 w-4 text-[var(--c9-muted)]" />
    )

  return (
    <div className="space-y-1">
      <InfrastructureChecklistRow
        name={row.label}
        statusLabel={userLine.status}
        detail={userLine.detail}
        tone={row.state === 'failed' ? 'error' : tone}
        leftIcon={leftIcon}
        onToggle={showChildren ? () => setExpanded((open) => !open) : undefined}
        expanded={expanded}
      />
      {showChildren && expanded
        ? childRows.map((child) => {
            const childLine = waitCodeToUserLine(child.waitCode)
            const childTone: CheckRowTone = child.ready
              ? 'ready'
              : child.waitCode === 'pending'
                ? 'dim'
                : 'active'
            const childIcon = child.ready ? (
              <IconCheckCircle className="h-4 w-4 text-emerald-400" />
            ) : child.waitCode === 'pending' ? (
              <IconRadioEmpty className="h-4 w-4 text-[var(--c9-muted)]" />
            ) : (
              <IconSync className="h-4 w-4 animate-spin text-[var(--c9-accent)]" />
            )
            return (
              <div key={`${row.id}-${child.ordinal}`} className="pl-5">
                <InfrastructureChecklistRow
                  name={instanceLabelForNode(row.backendKind, child.ordinal)}
                  statusLabel={childLine.status}
                  detail={childLine.detail}
                  tone={childTone}
                  leftIcon={childIcon}
                />
              </div>
            )
          })
        : null}
    </div>
  )
})

const ProvisionInfrastructureList = memo(function ProvisionInfrastructureList({
  parsed,
  nodes,
}: {
  parsed: ParsedProvisionMetrics
  nodes: Record<string, CanvasNode>
}) {
  const rows = useMemo(
    () => buildOrderedComponentRows(parsed.componentStatus, nodes),
    [parsed.componentStatus, nodes],
  )
  const seeding: NormalizedSeedingState = parsed.seedingStatus ?? 'pending'
  const loadgen: NormalizedLoadgenState = parsed.loadgenStatus ?? 'pending'
  const seedCtx = useMemo(
    () => buildSeedWaitContext(nodes, parsed.replicaStatus),
    [nodes, parsed.replicaStatus],
  )
  const seedingLine = seedingStatusToUserLine(seeding, seedCtx)
  const loadgenLine = loadgenStatusToUserLine(loadgen)

  const seedingRow = (() => {
    let tone: CheckRowTone =
      seeding === 'seeding' ? 'active' : seeding === 'done' ? 'ready' : 'dim'
    if (seeding === 'failed') tone = 'warn'

    const leftIcon =
      seeding === 'done' ? (
        <IconCheckCircle className="h-4 w-4 text-emerald-400" />
      ) : seeding === 'seeding' ? (
        <IconSync className="h-4 w-4 animate-spin text-[var(--c9-accent)]" />
      ) : seeding === 'failed' ? (
        <IconWarning className="h-4 w-4 text-amber-400" />
      ) : seeding === 'skipped' ? (
        <span className="flex h-4 w-4 items-center justify-center text-[var(--c9-muted)]">
          –
        </span>
      ) : (
        <IconSchedule className="h-4 w-4 text-[var(--c9-muted)]" />
      )

    return (
      <InfrastructureChecklistRow
        name={DEMO_DATA_ROW_TITLE}
        statusLabel={seedingLine.status}
        detail={seedingLine.detail}
        tone={seeding === 'failed' ? 'warn' : tone}
        leftIcon={leftIcon}
      />
    )
  })()

  const loadgenRow = (() => {
    let tone: CheckRowTone =
      loadgen === 'pending' ? 'dim' : loadgen === 'ready' ? 'ready' : 'dim'
    if (loadgen === 'failed') tone = 'warn'

    const leftIcon =
      loadgen === 'ready' ? (
        <IconCheckCircle className="h-4 w-4 text-emerald-400" />
      ) : loadgen === 'failed' ? (
        <IconWarning className="h-4 w-4 text-amber-400" />
      ) : loadgen === 'skipped' ? (
        <span className="flex h-4 w-4 items-center justify-center text-[var(--c9-muted)]">
          –
        </span>
      ) : loadgen === 'pending' ? (
        <IconSchedule className="h-4 w-4 text-[var(--c9-muted)]" />
      ) : (
        <IconRadioEmpty className="h-4 w-4 text-[var(--c9-muted)]" />
      )

    return (
      <InfrastructureChecklistRow
        name={LOADGEN_ROW_TITLE}
        statusLabel={loadgenLine.status}
        detail={loadgenLine.detail}
        tone={loadgen === 'failed' ? 'warn' : tone}
        leftIcon={leftIcon}
      />
    )
  })()

  return (
    <div className="max-h-[min(17rem,calc(100vh-10rem))] space-y-1 overflow-y-auto pr-0.5">
      {rows.map((row) => {
        const node = nodes[row.id]
        const expectedCount = node
          ? canvasInstanceCount(node, row.backendKind)
          : (parsed.replicaStatus[row.id]?.length ?? 1)
        return (
          <ComponentProvisionRow
            key={row.id}
            row={row}
            replicaRows={parsed.replicaStatus[row.id]}
            expectedCount={expectedCount}
          />
        )
      })}
      {seedingRow}
      {loadgenRow}
    </div>
  )
})

function VerticalProvisionerStepper({
  provisionSubtitle,
}: {
  provisionSubtitle: string
}) {
  return (
    <div className="relative">
      <div className="absolute bottom-6 left-2.5 top-3 w-px bg-[var(--c9-border)]" aria-hidden />
      <div className="relative mb-3.5 flex items-start gap-2.5">
        <div className="relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-500/45 bg-emerald-500/12">
          <IconCheckSm className="h-3 w-3 text-emerald-400" />
        </div>
        <div className="min-w-0 leading-snug">
          <h3 className="text-sm font-semibold text-[var(--c9-text)]">Validate</h3>
          <p className="text-[11px] text-[var(--c9-muted)]">{VALIDATE_STEP_SUBTITLE}</p>
        </div>
      </div>
      <div className="relative mb-3.5 flex items-start gap-2.5">
        <div className="relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--c9-accent)]/50 bg-[color-mix(in_srgb,var(--c9-accent)_14%,transparent)]">
          <IconSync className="h-3 w-3 animate-spin text-[var(--c9-accent)]" />
        </div>
        <div className="min-w-0 leading-snug">
          <h3 className="text-sm font-semibold text-[var(--c9-accent)]">Provision</h3>
          <p className="line-clamp-2 text-[11px] text-[var(--c9-muted)]">{provisionSubtitle}</p>
        </div>
      </div>
      <div className="relative flex items-start gap-2.5">
        <div className="relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--c9-border)] bg-[var(--c9-bg)]" />
        <div className="min-w-0 leading-snug">
          <h3 className="text-sm font-semibold text-[var(--c9-muted)]">Live Session</h3>
          <p className="text-[11px] text-[var(--c9-muted)]/85">Waiting for cluster readiness</p>
        </div>
      </div>
    </div>
  )
}

export const ProvisioningOverlay = memo(function ProvisioningOverlay({
  elapsedSeconds,
  metricsSummary,
  nodes,
  isTerminating = false,
  isQueued = false,
  queuePosition = null,
  estimatedWaitSeconds = null,
  minimized = false,
  onMinimize,
  onExpand,
  onCancel,
}: {
  elapsedSeconds: number
  metricsSummary: Record<string, unknown> | null
  nodes: Record<string, CanvasNode>
  isTerminating?: boolean
  isQueued?: boolean
  queuePosition?: number | null
  estimatedWaitSeconds?: number | null
  minimized?: boolean
  onMinimize?: () => void
  onExpand?: () => void
  onCancel?: () => void
}) {
  const parsed = useMemo(
    () => parseProvisionMetrics(metricsSummary),
    [metricsSummary],
  )
  const seedCtx = useMemo(
    () =>
      parsed
        ? buildSeedWaitContext(nodes, parsed.replicaStatus)
        : undefined,
    [nodes, parsed],
  )
  const legacyPulse = shouldUseLegacyProvisioningPulse(metricsSummary)
  const isDoorwayWait =
    !isQueued && isWaitingForProvisionSlot(parsed?.provisionPhase)

  const queueFields = { queuePosition, estimatedWaitSeconds }
  const doorDetail = formatQueueWaitingDetail(queueFields)
  const roomDetail = formatRoomWaitingDetail({
    estimatedWaitSeconds,
  })
  const doorwayDetail = hasQueueWaitFields(queueFields)
    ? doorDetail
    : 'A few deploys are starting ahead of you.'

  const panelTitle = isTerminating
    ? 'Terminating'
    : isQueued
      ? ROOM_QUEUE_TITLE
      : isDoorwayWait
        ? DOOR_WAIT_TITLE
        : 'Provisioning'

  const provisionSubtitle = isTerminating
    ? 'Terminating deployment...'
    : isQueued
      ? roomDetail
      : isDoorwayWait
        ? doorwayDetail
        : parsed?.provisionDetailCode || parsed?.seedingStatus
          ? provisionDetailCodeToSubtitle(
              parsed.provisionDetailCode,
              parsed.seedingStatus,
              seedCtx,
            )
          : parsed?.provisionPhase !== undefined && parsed.provisionPhase !== ''
            ? parsed.provisionPhase.replace(/-/g, ' ')
            : 'Starting your system…'

  const showChecklist =
    !isQueued && !isDoorwayWait && parsed !== null && !legacyPulse
  const cancelLabel = isTerminating
    ? 'Terminating…'
    : isQueued || isDoorwayWait
      ? 'Cancel'
      : 'Cancel provisioning'

  const rightPanelHeading =
    isQueued || isDoorwayWait ? 'Queue status' : 'Infrastructure checklist'

  const waitingDetail = isQueued
    ? roomDetail
    : isDoorwayWait
      ? doorwayDetail
      : null

  if (minimized) {
    return (
      <div className="pointer-events-none absolute bottom-3 right-3 z-40 flex max-w-[min(100%,20rem)] justify-end p-0">
        <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-[var(--c9-border)] bg-[color-mix(in_srgb,var(--c9-surface)_92%,transparent)] px-3 py-2 shadow-lg backdrop-blur-md">
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-[var(--c9-accent)]">
              {panelTitle}
            </div>
            <div
              className="[font-family:JetBrains_Mono,ui-monospace,monospace] text-[10px] tabular-nums text-[var(--c9-muted)]"
              aria-live="polite"
            >
              {formatElapsedHMS(elapsedSeconds)}
            </div>
          </div>
          {onExpand ? (
            <button
              type="button"
              onClick={onExpand}
              className="rounded-md border border-[var(--c9-border)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--c9-text)] transition-colors hover:border-[var(--c9-accent)]/45 hover:text-[var(--c9-accent)]"
            >
              Expand
            </button>
          ) : null}
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={isTerminating}
              className="rounded-md border border-[var(--c9-border)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--c9-muted)] transition-colors hover:border-red-400/45 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isTerminating ? '…' : 'Cancel'}
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[var(--c9-bg)]/75 p-2 backdrop-blur-sm sm:p-3">
      <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-[var(--c9-border)] bg-[color-mix(in_srgb,var(--c9-surface)_78%,transparent)] shadow-lg backdrop-blur-md md:flex-row">
        {/* Left: stepper + timer */}
        <div className="flex w-full flex-col justify-between border-b border-[var(--c9-border)] bg-[color-mix(in_srgb,var(--c9-surface)_50%,transparent)] px-4 py-3.5 md:w-[38%] md:border-b-0 md:border-r md:px-4 md:py-4">
          <div>
            {onMinimize ? (
              <div className="mb-2 flex justify-start">
                <button
                  type="button"
                  onClick={onMinimize}
                  className="rounded-md border border-[var(--c9-border)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--c9-muted)] transition-colors hover:border-[var(--c9-accent)]/45 hover:text-[var(--c9-accent)]"
                >
                  Minimize
                </button>
              </div>
            ) : null}
            <h2 className="mb-3 text-base font-semibold tracking-tight text-[var(--c9-accent)]">
              {panelTitle}
            </h2>
            <VerticalProvisionerStepper provisionSubtitle={provisionSubtitle} />
          </div>
          <div className="mt-4 border-t border-[var(--c9-border)] pt-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--c9-accent)]">
              Elapsed time
            </div>
            <div
              className="mt-1 [font-family:JetBrains_Mono,ui-monospace,monospace] text-xs font-medium tabular-nums text-[var(--c9-text)]"
              aria-live="polite"
            >
              {formatElapsedHMS(elapsedSeconds)}
            </div>
          </div>
        </div>

        {/* Right: checklist */}
        <div className="flex w-full flex-col bg-[color-mix(in_srgb,var(--c9-bg)_40%,var(--c9-surface))] px-4 py-3.5 md:w-[62%] md:px-4 md:py-4">
          <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--c9-muted)]">
            {rightPanelHeading}
          </h3>

          {showChecklist ? (
            <ProvisionInfrastructureList parsed={parsed} nodes={nodes} />
          ) : (
            <div className="rounded-md border border-[var(--c9-border)] bg-[var(--c9-surface)]/50 p-3">
              <div className="h-1 overflow-hidden rounded-full bg-[var(--c9-bg)]">
                <div className="h-full w-[32%] animate-pulse rounded-full bg-[var(--c9-accent)]/80" />
              </div>
              <p className="mt-2 text-[11px] leading-snug text-[var(--c9-muted)]">
                {waitingDetail != null ? (
                  waitingDetail
                ) : (
                  <>
                    Component detail appears when the API returns provisioning metrics (
                    <code className="text-[10px] text-[var(--c9-text)]">metricsSummary</code>
                    ).
                  </>
                )}
              </p>
            </div>
          )}
          {onCancel ? (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={onCancel}
                disabled={isTerminating}
                className="rounded-md border border-[var(--c9-border)] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--c9-muted)] transition-colors hover:border-red-400/45 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cancelLabel}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
})
