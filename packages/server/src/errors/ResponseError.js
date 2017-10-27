import { isObject, isString } from '@/utils'

export class ResponseError extends Error {
  constructor(error, status = 400) {
    const data = isObject(error)
      ? error
      : isString(error)
        ? { message: error }
        : { error }
    super(JSON.stringify(data, null, 2))
    this.name = this.constructor.name
    this.status = status
    this.data = data
  }
}
