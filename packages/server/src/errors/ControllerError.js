import { ResponseError } from './ResponseError'
import { isFunction } from '@ditojs/utils'

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
