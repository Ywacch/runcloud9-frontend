export class ApiError extends Error {
  status: number
  rawMessage: string

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.rawMessage = message
  }
}
