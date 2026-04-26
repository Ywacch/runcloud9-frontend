import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

export function C9Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl border border-[var(--c9-border)] bg-[var(--c9-surface)]/90 shadow-xl shadow-black/20 ${className ?? ''}`}
      {...props}
    />
  )
}

export function C9SectionTitle({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-[var(--c9-text)]">
        {title}
      </h1>
      {description ? (
        <p className="mt-2 text-sm leading-relaxed text-[var(--c9-muted)]">
          {description}
        </p>
      ) : null}
    </div>
  )
}

export function C9PrimaryButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      className={`w-full rounded-lg bg-[var(--c9-accent)] px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-[var(--c9-accent-hover)] disabled:opacity-60 ${className ?? ''}`}
      {...props}
    >
      {children}
    </button>
  )
}
