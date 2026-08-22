import { useEffect, useMemo } from 'react'
import { getTopologyFlags } from '../lib/componentRole'
import {
  collectPredictions,
  consistencyInvariantPredictions,
  type PredictionCard,
} from '../lib/storytellingPredictions'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useStorytellingStore } from '../editor-core/stores/storytellingStore'
import { useTemplateRegistryStore } from '../editor-core/stores/templateRegistryStore'
import { useWalkthroughStore } from '../editor-core/stores/walkthroughStore'

function PredictionCardItem({
  card,
  onWalkJourney,
}: {
  card: PredictionCard
  onWalkJourney?: (journeyId: string) => void
}) {
  const journeyId =
    card.kind === 'journey' && card.id.startsWith('journey:')
      ? card.id.slice('journey:'.length)
      : null

  return (
    <li className="rounded-lg border border-[var(--c9-border)] bg-[var(--c9-surface)]/70 p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold text-violet-300">{card.title}</span>
        <span className="shrink-0 rounded bg-[var(--c9-badge-bg)] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[var(--c9-muted)]">
          {card.kind === 'journey' ? 'Journey' : 'Signal'}
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[var(--c9-text)]">{card.body}</p>
      {card.suggestion ? (
        <p className="mt-2 text-xs leading-relaxed text-amber-200/90">
          Watch for: {card.suggestion}
        </p>
      ) : null}
      {journeyId && onWalkJourney ? (
        <button
          type="button"
          className="mt-3 w-full rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20"
          onClick={() => onWalkJourney(journeyId)}
        >
          ▶ Architecture walkthrough
        </button>
      ) : null}
    </li>
  )
}

export function PredictionCards() {
  const mode = useCanvasStore((s) => s.mode)
  const templateId = useCanvasStore((s) => s.snapshotTemplateId)
  const nodes = useCanvasStore((s) => s.nodes)
  const storytelling = useTemplateRegistryStore((s) =>
    templateId ? s.byId[templateId]?.storytelling : undefined,
  )
  const syncPredictions = useStorytellingStore((s) => s.syncPredictionsFromCanvas)
  const startWalkthrough = useWalkthroughStore((s) => s.startWalkthrough)

  const topology = useMemo(() => getTopologyFlags(nodes), [nodes])
  const cards = useMemo(
    () => [
      ...collectPredictions(storytelling, topology),
      ...consistencyInvariantPredictions(topology),
    ],
    [storytelling, topology],
  )

  useEffect(() => {
    if (mode !== 'design' || !templateId) return
    syncPredictions()
  }, [mode, templateId, cards, syncPredictions])

  if (mode !== 'design' || !templateId || cards.length === 0) return null

  return (
    <div className="space-y-2 border-t border-[var(--c9-border)] pt-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--c9-muted)]">
        Before you deploy
      </h3>
      <p className="text-[10px] leading-snug text-[var(--c9-muted)]">
        Based on your canvas topology and cache strategy. Matching live events will be
        tagged during the session.
      </p>
      <ul className="max-h-64 space-y-2 overflow-y-auto">
        {cards.map((card) => (
          <PredictionCardItem
            key={card.id}
            card={card}
            onWalkJourney={startWalkthrough}
          />
        ))}
      </ul>
    </div>
  )
}
