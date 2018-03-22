import { convertSchema } from '@/schema'
import { ValidationError, ControllerError, AuthorizationError } from '@/errors'
import {
  isString, isArray, isBoolean, isFunction, asArray, pick
} from '@ditojs/utils'

export default class ControllerAction {
  constructor(controller, handler, authorize) {
    this.controller = controller
    this.handler = handler
    this.authorize = authorize || handler.authorize
    this.parameters = handler.parameters
    this.returns = handler.returns
    this.app = controller.app
    this.validators = null
    this.callAuthorize = this.getAuthorize(this.authorize)
  }

  async callAction(ctx) {
    const { query } = ctx
    let { validators, parameters, returns } = this
    if (!validators && (parameters || returns)) {
      validators = this.validators = {
        parameters: this.createValidator(parameters),
        returns: this.createValidator(returns, {
          // Use instanceof checks instead of $ref to check returned values.
          instanceof: true
        })
      }
    }

    if (validators && !validators.parameters(query)) {
      throw this.createValidationError(
        `The provided data is not valid: ${JSON.stringify(query)}`,
        validators.parameters.errors
      )
    }

    const args = await this.collectArguments(ctx, parameters)
    const ok = await this.callAuthorize(ctx, ...args)
    if (ok !== true) {
      throw new AuthorizationError()
    }
    const result = await this.handler.call(this.controller, ...args)
    const resultName = returns?.name
    // Use 'root' if no name is given, see createValidator()
    const resultData = {
      [resultName || 'root']: result
    }
    // Use `call()` to pass `result` as context to Ajv, see passContext:
    if (validators && !validators.returns.call(result, resultData)) {
      throw this.createValidationError(
        `Invalid result of action: ${JSON.stringify(result)}`,
        validators.returns.errors
      )
    }
    return resultName ? resultData : result
  }

  getAuthorize(authorize) {
    if (isFunction(authorize)) {
      return async (ctx, ...args) => {
        const res = await authorize(ctx, ...args)
        // Pass res through `getAuthorize()` again to support strings & arrays.
        return this.getAuthorize(res)(ctx, ...args)
      }
    } else if (isString(authorize) || isArray(authorize)) {
      return ctx => {
        return !!ctx.state.user?.hasRole(...asArray(authorize))
      }
    } else if (isBoolean(authorize)) {
      return () => authorize
    } else if (authorize == null) {
      return () => true
    } else {
      throw new ControllerError(this.controller,
        `Unsupported authorize setting: '${authorize}'`
      )
    }
  }

  describeAuthorize() {
    if (isFunction(this.authorize)) {
      const match = this.authorize.toString().match(
        /^\s*(?:function[^(]*\(([^)]*)\)|\(([^)]*)\)\s*=>|(\S*)\s*=>)\s*(.)/
      )
      if (match) {
        const body = match[4] === '{' ? '{ ... }' : '...'
        return match[1] !== undefined ? `function (${match[1]}) ${body}`
          : match[2] !== undefined ? `(${match[2]}) => ${body}`
          : match[3] !== undefined ? `${match[3]} => ${body}`
          : ''
      }
    }
    return pick(this.authorize, '')
  }

  createValidationError(message, errors) {
    return new ValidationError({
      type: 'ControllerValidation',
      message,
      errors: this.app.validator.parseErrors(errors)
    })
  }

  createValidator(parameters = [], options = {}) {
    parameters = asArray(parameters)
    if (parameters.length > 0) {
      let properties = null
      for (const param of parameters) {
        if (param) {
          const property = isString(param) ? { type: param } : param
          const { name, type, ...rest } = property
          properties = properties || {}
          properties[name || 'root'] = type ? { type, ...rest } : rest
        }
      }
      if (properties) {
        const schema = convertSchema(properties, options)
        return this.app.compileValidator(schema)
      }
    }
    return () => true
  }

  collectConsumedArguments(ctx, parameters, consumed) {
    // `consumed` is used in MemberAction.collectArguments()
    const { query } = ctx
    return parameters
      ? parameters.map(
        ({ name }) => {
          if (consumed) {
            consumed[name] = true
          }
          return name ? query[name] : query
        })
      // If no parameters are provided, pass the full ctx object to the method
      : [ctx]
  }

  async collectArguments(ctx, parameters) {
    return this.collectConsumedArguments(ctx, parameters, null)
  }
}
