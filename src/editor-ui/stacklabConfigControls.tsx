import { useEffect, useId, useState, type ReactNode } from 'react'

/** dt-segmented track. `!` beats the unlayered StackLab rules on the same classes. */
const SEG =
  'seg inline-flex! items-center! gap-0.5! rounded-[7px]! border! border-solid! border-[var(--dt-color-divider-inset)]! bg-transparent! p-0.5!'
const SEG_BTN =
  'relative! h-6! min-w-0! flex-1! truncate! rounded-[5px]! border-0! border-r-0! bg-transparent! px-2! font-[family-name:var(--dt-font-family)]! text-[12px]! font-medium! tracking-normal! text-[var(--dt-color-text-muted)]! normal-case! shadow-none! hover:bg-white/5! hover:text-[var(--dt-color-text-strong)]! focus-visible:outline! focus-visible:outline-2! focus-visible:outline-offset-1! focus-visible:outline-[var(--dt-color-focus)]! disabled:cursor-not-allowed! disabled:opacity-45!'
const SEG_ON =
  'bg-[var(--dt-color-surface-raised)]! text-[var(--dt-color-text-strong)]! after:pointer-events-none after:absolute after:inset-x-2 after:bottom-0.5 after:h-0.5 after:rounded-sm after:bg-[var(--dt-color-primary)] after:content-[""]!'
const STEP_BTN =
  'grid! size-[22px]! place-items-center! rounded! border-0! bg-transparent! p-0! font-[family-name:var(--dt-font-family)]! text-[13px]! leading-none! text-[var(--dt-color-text-muted)]! hover:bg-white/5! hover:text-[var(--dt-color-text-strong)]! disabled:cursor-default! disabled:bg-transparent! disabled:opacity-30!'
const DD_TRIG =
  'dd-trig relative! flex! h-6! w-full! items-center! justify-between! gap-2! border-0! border-b! border-solid! border-[var(--dt-color-divider-inset)]! bg-transparent! px-0! pr-[18px]! font-[family-name:var(--dt-font-family)]! text-[12px]! font-medium! tracking-normal! text-[var(--dt-color-text-strong)]! normal-case! hover:border-[var(--dt-color-text-muted)]! hover:bg-transparent! disabled:opacity-45!'
const DD_MENU =
  'dd-menu absolute! top-full! right-auto! left-0! z-20! mt-1! min-w-full! rounded-[7px]! border! border-white/10! bg-[var(--dt-color-surface-raised)]! p-0.5! shadow-[0_8px_20px_rgba(0,0,0,0.45)]!'
const DD_OPT =
  'dd-opt flex! h-6! w-full! items-center! gap-1.5! px-2! py-0! text-left! font-[family-name:var(--dt-font-family)]! text-[12px]! font-medium! tracking-normal! text-[var(--dt-color-text)]! normal-case! hover:bg-white/5! hover:text-[var(--dt-color-text-strong)]!'
const CHEV =
  'car pointer-events-none! absolute! top-2! right-1! size-[5px]! shrink-0! rotate-45! border-r-[1.5px]! border-b-[1.5px]! border-solid! border-[var(--dt-color-text-muted)]! text-[0px]!'

export function PcfgField({
  label,
  htmlFor,
  sub,
  children,
}: {
  label: ReactNode
  htmlFor?: string
  sub?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="pcfg-field grid! min-h-6! grid-cols-[auto_minmax(0,1fr)]! items-center! gap-x-3! border-0! bg-transparent! p-0!">
      <label
        className="lab pcfg-lab mb-0! block! whitespace-nowrap! font-[family-name:var(--dt-font-family)]! text-[12px]! font-normal! tracking-normal! text-[var(--dt-color-text-muted)]! normal-case!"
        htmlFor={htmlFor}
      >
        {label}
      </label>
      <div className="pcfg-ctl mb-0! flex! min-w-0! items-center! justify-end!">{children}</div>
      {sub ? (
        <p className="pcfg-sub col-span-2! mt-[3px]! truncate! font-[family-name:var(--dt-font-family)]! text-[11px]! leading-[1.35]! tracking-normal! text-[var(--dt-color-text-muted)]! normal-case! opacity-85!">
          {sub}
        </p>
      ) : null}
    </div>
  )
}

export function PcfgNum({
  id,
  value,
  unit,
  min,
  max,
  disabled,
  placeholder,
  onChange,
}: {
  id: string
  value: string | number
  unit?: string
  min?: number
  max?: number
  disabled?: boolean
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <div className="numfld inline-flex! h-6! min-w-0! items-center! gap-1! border-0! border-b! border-solid! border-[var(--dt-color-divider-inset)]! bg-transparent! px-0!">
      <input
        className="w-10! min-w-0! border-0! bg-transparent! p-0! text-right! font-[family-name:var(--dt-font-family)]! text-[12px]! font-medium! tabular-nums! text-[var(--dt-color-text-strong)]! outline-none!"
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={id}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9]/g, '')
          if (!raw) {
            onChange('')
            return
          }
          let n = Number.parseInt(raw, 10)
          if (!Number.isFinite(n)) return
          if (min != null) n = Math.max(min, n)
          if (max != null) n = Math.min(max, n)
          onChange(String(n))
        }}
      />
      {unit ? (
        <span className="unit ml-0! font-[family-name:var(--dt-font-family)]! text-[11px]! tracking-normal! text-[var(--dt-color-text-muted)]! normal-case!">
          {unit}
        </span>
      ) : null}
    </div>
  )
}

export function PcfgStepper({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  disabled?: boolean
  onChange: (next: number) => void
}) {
  return (
    <div className="stepper inline-flex! h-6! items-center! gap-0.5! border-0! bg-transparent!">
      <button
        type="button"
        className={STEP_BTN}
        aria-label={`Decrease ${label}`}
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <span className="st-v inline-flex! h-[22px]! min-w-[30px]! items-center! justify-center! border-0! border-b! border-solid! border-[var(--dt-color-divider-inset)]! bg-transparent! px-[3px]! font-[family-name:var(--dt-font-family)]! text-[12px]! font-medium! tabular-nums! text-[var(--dt-color-text-strong)]!">
        {value}
      </span>
      <button
        type="button"
        className={STEP_BTN}
        aria-label={`Increase ${label}`}
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  )
}

export function PcfgDd({
  id,
  value,
  options,
  disabled,
  onChange,
}: {
  id: string
  value: string
  options: { value: string; label: string; disabled?: boolean }[]
  disabled?: boolean
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const current = options.find((o) => o.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target
      if (!(t instanceof Node)) return
      const root = document.getElementById(id)
      if (root && !root.contains(t)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, id])

  return (
    <div className="dd" id={id}>
      <button
        type="button"
        className={DD_TRIG}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((v) => !v)
        }}
      >
        <span className="min-w-0! truncate!">{current?.label ?? value}</span>
        <span className={CHEV} aria-hidden />
      </button>
      <div className={`${DD_MENU}${open ? ' is-open' : ''}`} id={menuId} role="listbox">
        {options.map((o) => (
          <button
            key={o.value || 'default'}
            type="button"
            role="option"
            aria-selected={o.value === value}
            className={`${DD_OPT}${o.value === value ? ' is-on bg-white/10! text-[var(--dt-color-text-strong)]!' : ''}`}
            disabled={o.disabled || disabled}
            onClick={() => {
              if (o.disabled || disabled) return
              onChange(o.value)
              setOpen(false)
            }}
          >
            <span className="chk w-2! text-[10px]! text-[var(--dt-color-primary)]!">
              {o.value === value ? '▸' : ''}
            </span>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function PcfgChk({
  id,
  label,
  sub,
  checked,
  disabled,
  onChange,
}: {
  id: string
  label: ReactNode
  sub?: ReactNode
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="chkrow" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        className="chk-native"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="chk-box" aria-hidden />
      <span className="chk-copy">
        <span className="chk-lab">{label}</span>
        {sub ? <span className="chk-sub">{sub}</span> : null}
      </span>
    </label>
  )
}

export type PcfgProfOption = {
  value: string
  label: string
  meta: string
}

export function PcfgProf({
  id,
  value,
  options,
  disabled,
  onChange,
}: {
  id: string
  value: string
  options: PcfgProfOption[]
  disabled?: boolean
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const current = options.find((o) => o.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target
      if (!(t instanceof Node)) return
      const root = document.getElementById(id)
      if (root && !root.contains(t)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, id])

  return (
    <div className="dd dd-prof" id={id}>
      <button
        type="button"
        className={DD_TRIG}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((v) => !v)
        }}
      >
        <span className="dd-prof-l min-w-0! truncate! font-[family-name:var(--dt-font-family)]! text-[12px]! text-[var(--dt-color-text-strong)]!">
          {current?.label ?? value}
        </span>
        <span className="dd-prof-meta ml-auto! mr-2! truncate! font-[family-name:var(--dt-font-family-mono)]! text-[11px]! text-[var(--dt-color-text-muted)]!">
          {current?.meta ?? ''}
        </span>
        <span className={CHEV} aria-hidden />
      </button>
      <div className={`${DD_MENU} min-w-[200px]!${open ? ' is-open' : ''}`} id={menuId} role="listbox">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="option"
            aria-selected={o.value === value}
            className={`${DD_OPT}${o.value === value ? ' is-on bg-white/10! text-[var(--dt-color-text-strong)]!' : ''}`}
            disabled={disabled}
            onClick={() => {
              if (disabled) return
              onChange(o.value)
              setOpen(false)
            }}
          >
            <span className="dd-prof-l">{o.label}</span>
            <span className="dd-prof-meta">{o.meta}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export type PcfgOption = {
  value: string
  label: string
  disabled?: boolean
}

export function PcfgSeg({
  label,
  value,
  options,
  disabled,
  wrap = false,
  tight = false,
  onChange,
}: {
  label: string
  value: string
  options: PcfgOption[]
  disabled?: boolean
  wrap?: boolean
  tight?: boolean
  onChange: (value: string) => void
}) {
  const segClass = [SEG, wrap ? 'wrap w-full! flex-wrap!' : '', tight ? 'tight' : '']
    .filter(Boolean)
    .join(' ')
  return (
    <div className={segClass} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={`${SEG_BTN}${o.value === value ? ` is-on ${SEG_ON}` : ''}`}
          disabled={disabled || o.disabled}
          onClick={() => {
            if (disabled || o.disabled) return
            onChange(o.value)
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Stacklab enum control: `seg` = side-by-side picker; `dd` = dropdown with ▸ marker. */
export function PcfgOptions({
  variant,
  id,
  label,
  value,
  options,
  disabled,
  segWrap,
  segTight,
  onChange,
}: {
  variant: 'seg' | 'dd'
  id?: string
  label: string
  value: string
  options: PcfgOption[]
  disabled?: boolean
  segWrap?: boolean
  segTight?: boolean
  onChange: (value: string) => void
}) {
  if (variant === 'seg') {
    return (
      <PcfgSeg
        label={label}
        value={value}
        options={options}
        disabled={disabled}
        wrap={segWrap}
        tight={segTight}
        onChange={onChange}
      />
    )
  }
  return (
    <PcfgDd
      id={id ?? label}
      value={value}
      options={options}
      disabled={disabled}
      onChange={onChange}
    />
  )
}
