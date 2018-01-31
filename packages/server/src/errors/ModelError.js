import { ResponseError } from './ResponseError'
import { isFunction } from '@ditojs/utils'

export class ModelError extends ResponseError {
  constructor(model, error) {
    const { name } = isFunction(model) ? model : model.constructor
    super(`Model ${name}: ${error}`, {
      message: `Model ${name}: Model error`,
      status: 400
    })
  }
}
