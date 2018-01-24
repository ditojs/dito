import { isPlainObject, isString } from '@ditojs/utils'

export class ResponseError extends Error {
  constructor(error, defaults = { Message: 'Response error', status: 400 }) {
    error = isPlainObject(error)
      ? error
      : error instanceof Error
        ? Object.setPrototypeOf({
          message: error.message,
          status: error.status
        }, error)
        : isString(error)
          ? { message: error }
          : error || {}
    const { status, ...data } = { ...defaults, ...error }
    super(data.message)
    this.name = this.constructor.name
    this.status = status
    this.data = data
  }

  toJSON() {
    return this.data
  }
}
