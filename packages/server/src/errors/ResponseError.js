import { isPlainObject, isString } from '@ditojs/utils'

export class ResponseError extends Error {
  constructor(error, defaults = { message: 'Response error', status: 400 }) {
    const object = isPlainObject(error)
      ? error
      : error instanceof Error
        ? {
          // Copy error into object so they can be merged with defaults after.
          // First copy everything that is enumerable, unless the error is from
          // axios, in which case we don't want to leak config information.
          // TODO: Use `instanceof AxiosException` instead once axios is v1.0.0:
          // https://github.com/axios/axios/pull/2014
          ...(error.isAxiosError ? null : error),
          // Also explicitly copy message, status and code.
          message: error.message,
          status: error.status,
          code: error.code
        }
        : isString(error)
          ? { message: error }
          : error || {}
    const { status, ...data } = { ...defaults, ...object }
    let { message, code } = data
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
    this.code = code
    this.data = data
  }

  toJSON() {
    return this.data
  }
}
