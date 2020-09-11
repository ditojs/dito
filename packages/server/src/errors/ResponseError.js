import { isPlainObject, isString } from '@ditojs/utils'

export class ResponseError extends Error {
  constructor(error, defaults = { message: 'Response error', status: 400 }) {
    const object = isPlainObject(error)
      ? error
      : error instanceof Error
        ? { // Copy error into object so they can be merged with defaults after.
          // First copy everything that is enumerable:
          ...error,
          // Also explicitly copy message and status.
          message: error.message,
          status: error.status
        }
        : isString(error)
          ? { message: error }
          : error || {}
    const { status, ...data } = { ...defaults, ...object }
    let { message } = data
    if (process.env.NODE_ENV === 'test' && error === object) {
      // Include full JSON error in message during tests, for better reporting.
      const { message: _, ...rest } = data
      if (Object.keys(rest).length > 0) {
        message = `${message}\nError Data:\n${JSON.stringify(rest, null, 2)}`
      }
    }
    super(message)
    this.name = this.constructor.name
    this.status = status
    this.data = data
  }

  toJSON() {
    return this.data
  }
}
