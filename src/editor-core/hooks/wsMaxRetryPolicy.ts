export const WS_MAX_RETRY_ATTEMPTS = 5

export function shouldVerifyDeploymentAfterWsRetries(
  retryCount: number,
): boolean {
  return retryCount >= WS_MAX_RETRY_ATTEMPTS
}
