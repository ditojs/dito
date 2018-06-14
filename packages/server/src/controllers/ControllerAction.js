import { isObject, asArray, isString } from '@ditojs/utils'

export default class ControllerAction {
  constructor(controller, handler, verb, path, authorize) {
    this.controller = controller
    this.handler = handler
    // Allow decorators on actions to override the predetermined defaults for
    // `verb`, `path` and `authorize`:
    this.verb = handler.verb || verb
    // Use ?? instead of || to allow '' to override the path.
    this.path = handler.path ?? path
    this.authorize = handler.authorize || authorize
    this.authorization = controller.processAuthorize(this.authorize)
    this.parameters = handler.parameters
    this.returns = handler.returns
    this.app = controller.app
    this.validators = null
    this.queryName = ['post', 'put'].includes(this.verb) ? 'body' : 'query'
  }

  getQuery(ctx) {
    return ctx.request[this.queryName]
  }

  setQuery(ctx, query) {
    ctx.request[this.queryName] = query
  }

  async callAction(ctx) {
    if (!this.validators && (this.parameters || this.returns)) {
      this.validators = {
        parameters: this.app.compileParametersValidator(this.parameters),
        returns: this.app.compileParametersValidator(this.returns, {
          // Use instanceof checks instead of $ref to check returned values.
          instanceof: true
        })
      }
    }

    if (this.validators) {
      const errors = this.validateParameters(ctx)
      if (errors) {
        throw this.createValidationError({
          message: `The provided data is not valid: ${
            JSON.stringify(this.getQuery(ctx))
          }`,
          errors
        })
      }
    }

    const args = await this.collectArguments(ctx, this.parameters)
    await this.controller.handleAuthorization(this.authorization, ...args)

    const result = await this.handler.call(this.controller, ...args)
    const resultName = this.returns?.name
    // Use 'root' if no name is given, see:
    // Application.compileParametersValidator()
    const resultData = {
      [resultName || 'root']: result
    }
    // Use `call()` to pass `result` as context to Ajv, see passContext:
    if (this.validators && !this.validators.returns.call(result, resultData)) {
      throw this.createValidationError({
        message: `Invalid result of action: ${JSON.stringify(result)}`,
        errors: this.validators.returns.errors
      })
    }
    return resultName ? resultData : result
  }

  createValidationError({ message, errors }) {
    return this.app.createValidationError({
      type: 'ControllerValidation',
      message,
      errors
    })
  }

  validateParameters(ctx) {
    const query = this.getQuery(ctx)
    // NOTE: `validators.parameters(query)` coerces data in the query to the
    // required formats, according to the rules specified here:
    // https://github.com/epoberezkin/ajv/blob/master/COERCION.md
    // Coercion isn't currently offered for `type: 'object'`, so handle this
    // case prior to the call of `validators.parameters()`:
    const errors = []
    for (const param of asArray(this.parameters)) {
      const { name, type } = isString(param) ? { type: param } : param
      if (type === 'object') {
        const value = name ? query[name] : query
        let converted = value
        if (value && !isObject(value)) {
          try {
            converted = JSON.parse(value)
          } catch (err) {
            errors.push({
              dataPath: `.${name}`, // JavaScript property access notation
              keyword: 'type',
              message: err.message || err.toString(),
              params: {
                type,
                json: true
              }
            })
          }
        }
        if (converted !== value) {
          if (name) {
            query[name] = converted
          } else {
            this.setQuery(ctx, converted)
          }
        }
      }
    }
    if (!this.validators.parameters(query)) {
      errors.push(...this.validators.parameters.errors)
    }
    return errors.length > 0 ? errors : null
  }

  collectConsumedArguments(ctx, parameters, consumed) {
    // `consumed` is used in MemberAction.collectArguments()
    const query = this.getQuery(ctx)
    return [
      // Always pass `ctx` as first argument.
      ctx,
      ...(parameters?.map(
        ({ name }) => {
          if (consumed) {
            consumed[name] = true
          }
          return name ? query[name] : query
        }
      ) || [])
    ]
  }

  async collectArguments(ctx, parameters) {
    return this.collectConsumedArguments(ctx, parameters, null)
  }
}
