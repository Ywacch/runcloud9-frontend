import type { ReactNode } from 'react'

export function PricingPlanColumn({
  name,
  price,
  priceHint,
  blurb,
  featured,
  plain,
  children,
}: {
  name: string
  price: string
  priceHint: string
  blurb: string
  featured?: boolean
  plain?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={
        plain
          ? 'flex flex-col'
          : `flex flex-col rounded-xl border bg-[var(--c9-surface)]/60 p-6 ${
              featured
                ? 'border-[var(--c9-accent)]/50 shadow-[0_0_0_1px_color-mix(in_srgb,var(--c9-accent)_20%,transparent)]'
                : 'border-[var(--c9-border)]'
            }`
      }
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--c9-muted)]">
        {name}
      </p>
      <p
        className={`flex items-baseline gap-2 ${plain ? 'mt-2' : 'mt-3'}`}
      >
        <span className="text-3xl font-semibold tracking-tight text-[var(--c9-text)]">
          {price}
        </span>
        <span className="text-sm text-[var(--c9-muted)]">{priceHint}</span>
      </p>
      <p className="mt-3 text-sm leading-relaxed text-[var(--c9-muted)]">{blurb}</p>
      <div
        className={
          plain ? 'mt-5' : 'mt-6 flex flex-1 flex-col gap-2'
        }
      >
        {children}
      </div>
    </div>
  )
}
