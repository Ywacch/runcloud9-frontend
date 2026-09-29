import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { exitLiveSessionDueToRemoteEnd } from './sessionCapture'
import { isLiveSessionPastEnd } from './liveSessionEnding'

/** When the session clock has passed or we are wrapping up, 410 means exit live. */
export function notifyDeploymentInactiveIfEnding(): void {
  const st = useCanvasStore.getState()
  if (st.mode !== 'live') return
  if (!st.liveSessionEnding && !isLiveSessionPastEnd(st.liveSessionEndsAt)) return
  exitLiveSessionDueToRemoteEnd()
}
