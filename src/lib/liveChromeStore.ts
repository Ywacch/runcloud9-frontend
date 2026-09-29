import { create } from 'zustand'
import { requestCanvasFit } from '../canvas/utils/canvasFitBridge'

/** Side drawer width; keep in sync with LiveMetricsDrawer + chip-strip offset. */
export const LIVE_METRICS_DRAWER_CLASS = 'w-[22rem]'

/** Inspector chat drawer width (sits left of the metrics drawer). */
export const INSPECTOR_CHAT_DRAWER_CLASS = 'w-[18rem]'

type LiveChromeState = {
  metricsDrawerOpen: boolean
  setMetricsDrawerOpen: (open: boolean) => void
  chatDrawerOpen: boolean
  setChatDrawerOpen: (open: boolean) => void
}

function scheduleCanvasFit() {
  if (typeof window === 'undefined') return
  window.setTimeout(() => requestCanvasFit(), 250)
}

export const useLiveChromeStore = create<LiveChromeState>((set) => ({
  metricsDrawerOpen: false,
  setMetricsDrawerOpen: (metricsDrawerOpen) => {
    set({ metricsDrawerOpen })
    scheduleCanvasFit()
  },
  chatDrawerOpen: false,
  setChatDrawerOpen: (chatDrawerOpen) => {
    set({ chatDrawerOpen })
    scheduleCanvasFit()
  },
}))
