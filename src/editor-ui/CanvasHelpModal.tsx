const STEPS = [
  {
    title: 'Place components',
    body: 'Drag from the sidebar or right-click the canvas to add load balancers, app servers, databases, caches, and queues.',
  },
  {
    title: 'Connect and select',
    body: 'Use the connect tool to wire nodes. Click a component to open the inspector and tune replicas, cache strategy, and resources.',
  },
  {
    title: 'Pick a template',
    body: 'Choose a template preset for a guided starting topology, or start from scratch on a blank canvas.',
  },
  {
    title: 'Deploy or simulate',
    body: 'Deploy spins up a live Kubernetes session (~9 minutes). If the design is not deployable yet, simulation lets you explore behavior without provisioning.',
  },
  {
    title: 'Watch live metrics',
    body: 'In live mode, open the inspector on any node for metrics, logs, and data introspection while load runs.',
  },
] as const

export function CanvasHelpModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--c9-bg)]/75 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-[var(--c9-border)] bg-[var(--c9-surface)]/95 p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="canvas-help-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="canvas-help-title"
          className="text-lg font-semibold tracking-tight text-[var(--c9-text)]"
        >
          How the canvas works
        </h2>
        <p className="mt-1 text-sm text-[var(--c9-muted)]">
          Quick guide to designing and running a session.
        </p>
        <ol className="mt-4 space-y-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--c9-accent)]/20 text-xs font-semibold text-[var(--c9-accent)]">
                {index + 1}
              </span>
              <div>
                <p className="font-medium text-[var(--c9-text)]">{step.title}</p>
                <p className="mt-0.5 leading-relaxed text-[var(--c9-muted)]">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-lg bg-[var(--c9-accent)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--c9-accent-hover)]"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
