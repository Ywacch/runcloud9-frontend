/** sessionStorage key for timeline events (per deployment). */
export function wsEventsStorageKey(deploymentId: string): string {
  return `runcloud9-ws-events-${deploymentId}`
}

export function discardWsEventsStorage(deploymentId: string): void {
  try {
    sessionStorage.removeItem(wsEventsStorageKey(deploymentId))
  } catch {
    /* ignore */
  }
}

export function loadWsEventsJson(deploymentId: string): string | null {
  try {
    return sessionStorage.getItem(wsEventsStorageKey(deploymentId))
  } catch {
    return null
  }
}

export function saveWsEventsJson(deploymentId: string, json: string): void {
  try {
    sessionStorage.setItem(wsEventsStorageKey(deploymentId), json)
  } catch {
    /* quota / private mode */
  }
}
