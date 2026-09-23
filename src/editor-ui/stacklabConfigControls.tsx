import { useEffect, useId, useState, type ReactNode } from 'react'

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
    <div className="pcfg-field">
      <label className="lab pcfg-lab" htmlFor={htmlFor}>
        {label}
      </label>
      <div className="pcfg-ctl">{children}</div>
      {sub ? <p className="pcfg-sub">{sub}</p> : null}
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
    <div className="numfld">
      <input
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
      {unit ? <span className="unit">{unit}</span> : null}
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
    <div className="stepper">
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <span className="st-v">{value}</span>
      <button
        type="button"
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
        className="dd-trig"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((v) => !v)
        }}
      >
        <span>{current?.label ?? value}</span>
        <span className="car">▾</span>
      </button>
      <div className={`dd-menu${open ? ' is-open' : ''}`} id={menuId} role="listbox">
        {options.map((o) => (
          <button
            key={o.value || 'default'}
            type="button"
            role="option"
            aria-selected={o.value === value}
            className={`dd-opt${o.value === value ? ' is-on' : ''}`}
            disabled={o.disabled || disabled}
            onClick={() => {
              if (o.disabled || disabled) return
              onChange(o.value)
              setOpen(false)
            }}
          >
            <span className="chk">{o.value === value ? '▸' : ''}</span>
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
        className="dd-trig"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((v) => !v)
        }}
      >
        <span className="dd-prof-l">{current?.label ?? value}</span>
        <span className="dd-prof-meta">{current?.meta ?? ''}</span>
        <span className="car">▾</span>
      </button>
      <div className={`dd-menu${open ? ' is-open' : ''}`} id={menuId} role="listbox">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="option"
            aria-selected={o.value === value}
            className={`dd-opt${o.value === value ? ' is-on' : ''}`}
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
  const segClass = ['seg', wrap ? 'wrap' : '', tight ? 'tight' : '']
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
          className={o.value === value ? 'is-on' : ''}
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
