import { useStorytellingStore } from '../store/storytellingStore'
import { useWalkthroughStore } from '../store/walkthroughStore'

/** Stop walkthrough / journey UI and clear prediction state when the template or canvas context changes. */
export function resetDesignStorytellingUi(options?: {
  syncPredictions?: boolean
}): void {
  useWalkthroughStore.getState().stop()
  useStorytellingStore.getState().setPredictedRuleIds([])
  if (options?.syncPredictions) {
    useStorytellingStore.getState().syncPredictionsFromCanvas()
  }
}
