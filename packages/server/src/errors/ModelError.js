import { isFunction } from '@ditojs/utils'
import { ResponseError } from './ResponseError.js'

export class ModelError extends ResponseError {
  constructor(model, error) {
    const { name } = isFunction(model) ? model : model.constructor
    super(`Model '${name}': ${error}`, {
      message: `Model '${name}': Model error`,
      status: 400
    })
  }
}
