/** True when /login should show the email/password form (?password=1). */
export function isLoginPasswordMode(passwordParam: string | null | undefined): boolean {
  return passwordParam === '1'
}
