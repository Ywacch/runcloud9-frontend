import { useEffect, useRef, useState } from 'react'

import type { LatencyQuantile } from '../lib/latencyQuantile'

import type { MetricsTimeframe } from '../lib/metricTimeframe'



const OPTIONS: LatencyQuantile[] = ['p50', 'p95', 'p99']



export function LatencyQuantileLabel({

  quantile,

  timeframe,

  sessionAvailable,

  onChange,

}: {

  quantile: LatencyQuantile

  timeframe: MetricsTimeframe

  sessionAvailable: (q: LatencyQuantile) => boolean

  onChange?: (q: LatencyQuantile) => void

}) {

  const [open, setOpen] = useState(false)

  const rootRef = useRef<HTMLSpanElement>(null)



  useEffect(() => {

    if (!open) return

    const onDoc = (event: MouseEvent) => {

      if (!rootRef.current?.contains(event.target as Node)) {

        setOpen(false)

      }

    }

    document.addEventListener('mousedown', onDoc)

    return () => document.removeEventListener('mousedown', onDoc)

  }, [open])



  if (timeframe === 'session' || !onChange) {

    return <span>Latency ({quantile})</span>

  }



  return (

    <span ref={rootRef} className="pctl-wrap">

      <button

        type="button"

        className="pctl-trig"

        aria-haspopup="menu"

        aria-expanded={open}

        onClick={() => setOpen((value) => !value)}

      >

        Latency (<span data-pctl>{quantile}</span>

        <span className="car">▾</span>)

      </button>

      <span className={`pctl-menu${open ? ' is-open' : ''}`} role="menu">

        {OPTIONS.map((option) => {

          const disabled = !sessionAvailable(option)

          return (

            <button

              key={option}

              type="button"

              role="menuitemradio"

              aria-checked={quantile === option}

              disabled={disabled}

              className={`pctl-opt${quantile === option ? ' is-on' : ''}`}

              onClick={() => {

                if (disabled) return

                onChange(option)

                setOpen(false)

              }}

            >

              {option}

            </button>

          )

        })}

      </span>

    </span>

  )

}


