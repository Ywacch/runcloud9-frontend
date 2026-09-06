/** Dispatched on `window` to trigger the Sidebar deploy path (same as Deploy button). */
export const REQUEST_DEPLOY_EVENT = 'runcloud9:request-deploy'

export function dispatchRequestDeploy(): void {
  window.dispatchEvent(new CustomEvent(REQUEST_DEPLOY_EVENT))
}
