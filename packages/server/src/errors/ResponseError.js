import { isObject } from '@/utils'

export default class ResponseError extends Error {
  constructor(error, statusCode = 400) {
    super(JSON.stringify(isObject(error) ? error : {
      error
    }, null, 2))
    this.name = this.constructor.name
    this.statusCode = statusCode
  }
}
