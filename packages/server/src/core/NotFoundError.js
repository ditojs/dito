export default class NotFoundError extends Error {
  constructor(message, statusCode = 404) {
    super(JSON.stringify({
      error: message
    }, null, 2))
    this.name = 'NotFoundError'
    this.statusCode = statusCode
  }
}
