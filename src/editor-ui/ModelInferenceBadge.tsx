/** Shown when highlight copy came from a verified model-inferred claim (not library-authored). */
export function ModelInferenceBadge() {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full border border-violet-500/40 bg-violet-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-200"
      title="This explanation was inferred from session data, not matched to a library mechanism."
    >
      Model inference
    </span>
  )
}
