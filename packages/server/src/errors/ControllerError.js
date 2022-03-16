import { isFunction } from '@ditojs/utils'
import { ResponseError } from './ResponseError.js'

export class ControllerError extends ResponseError {
  constructor(controller, error) {
    const { name } = isFunction(controller) ? controller
      : controller.constructor
    super(`Controller ${name}: ${error}`, {
      message: `Controller ${name}: Controller error`,
      status: 400
    })
  }
}
