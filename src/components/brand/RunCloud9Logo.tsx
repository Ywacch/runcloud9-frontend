type RunCloud9LogoProps = {
  showWordmark?: boolean
  className?: string
  iconClassName?: string
}

export function RunCloud9Logo({
  showWordmark = true,
  className,
  iconClassName,
}: RunCloud9LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <img
        src="/logo.png"
        alt=""
        aria-hidden
        width={28}
        height={28}
        decoding="async"
        className={iconClassName ?? 'h-7 w-7 shrink-0 object-contain'}
      />
      {showWordmark ? (
        <span className="font-sans text-base font-semibold tracking-[-0.02em] text-c9-text-heading">
          RunCloud9
        </span>
      ) : null}
    </div>
  )
}
