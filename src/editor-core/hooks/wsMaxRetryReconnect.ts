import { getDeployment } from '../../lib/api'
import {
  exitLiveSessionDueToRemoteEnd,
  isTerminalDeploymentStatus,
} from '../../lib/sessionCapture'
import { useMetricsStore } from '../stores/metricsStore'

export const WS_MAX_RETRY_ATTEMPTS = 5

export function shouldVerifyDeploymentAfterWsRetries(
  retryCount: number,
): boolean {
  return retryCount >= WS_MAX_RETRY_ATTEMPTS
}

type TimerRef = { current: ReturnType<typeof setTimeout> | null }
type RetryRef = { current: number }

export function scheduleWsReconnectAfterMaxRetries(args: {
  deploymentId: string
  warningMessage: string
  retryRef: RetryRef
  timerRef: TimerRef
  connect: () => void
}): void {
  useMetricsStore.getState().setStreamWarning(args.warningMessage)
  void getDeployment(args.deploymentId)
    .then((dep) => {
      if (isTerminalDeploymentStatus(dep.status)) {
        exitLiveSessionDueToRemoteEnd()
        return
      }
      args.retryRef.current = 0
      args.timerRef.current = setTimeout(args.connect, 2000)
    })
    .catch(() => {
      args.retryRef.current = 0
      args.timerRef.current = setTimeout(args.connect, 2000)
    })
}
