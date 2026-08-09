import { create } from 'zustand'
import { requestCanvasFit } from '../canvas/utils/canvasFitBridge'

/** Side drawer width; keep in sync with LiveMetricsDrawer + chip-strip offset. */
export const LIVE_METRICS_DRAWER_CLASS = 'w-[22rem]'

type LiveChromeState = {
  metricsDrawerOpen: boolean
  setMetricsDrawerOpen: (open: boolean) => void
}

export const useLiveChromeStore = create<LiveChromeState>((set) => ({
  metricsDrawerOpen: false,
  setMetricsDrawerOpen: (metricsDrawerOpen) => {
    set({ metricsDrawerOpen })
    if (typeof window === 'undefined') return
    window.setTimeout(() => requestCanvasFit(), 250)
  },
}))
