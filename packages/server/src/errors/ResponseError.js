import { isObject } from '@/utils'

export default class ResponseError extends Error {
  constructor(data, statusCode = 400) {
    super(JSON.stringify(isObject(data) ? data : {
      data
    }, null, 2))
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.data = data
  }
}
