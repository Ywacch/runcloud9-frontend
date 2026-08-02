import type { ReactNode } from 'react'

export function PricingPlanColumn({
  name,
  price,
  priceHint,
  blurb,
  featured,
  children,
}: {
  name: string
  price: string
  priceHint: string
  blurb: string
  featured?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={`flex flex-col rounded-xl border bg-[var(--c9-surface)]/60 p-6 ${
        featured
          ? 'border-[var(--c9-accent)]/50 shadow-[0_0_0_1px_color-mix(in_srgb,var(--c9-accent)_20%,transparent)]'
          : 'border-[var(--c9-border)]'
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--c9-muted)]">
        {name}
      </p>
      <p className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight text-[var(--c9-text)]">
          {price}
        </span>
        <span className="text-sm text-[var(--c9-muted)]">{priceHint}</span>
      </p>
      <p className="mt-3 text-sm leading-relaxed text-[var(--c9-muted)]">{blurb}</p>
      <div className="mt-6 flex flex-1 flex-col gap-2">{children}</div>
    </div>
  )
}
