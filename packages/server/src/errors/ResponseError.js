import { isObject, isString } from '@ditojs/utils'

export class ResponseError extends Error {
  constructor(error, defaults = { Message: 'Response error', status: 400 }) {
    error = isObject(error)
      ? error
      : isString(error)
        ? { message: error }
        : {}
    const { status, ...data } = { ...defaults, ...error }
    super(JSON.stringify(data, null, 2))
    this.name = this.constructor.name
    this.status = status
    this.data = data
  }
}
