import { isString, isObject, asArray, clone } from '@ditojs/utils'

export default class ControllerAction {
  constructor(controller, handler, type, name, verb, path, authorize) {
    this.controller = controller
    this.handler = handler
    this.type = type
    this.name = name
    this.identifier = `${type}:${name}`
    // Allow decorators on actions to override the predetermined defaults for
    // `verb`, `path` and `authorize`:
    this.verb = handler.verb || verb
    // Use ?? instead of || to allow '' to override the path.
    this.path = handler.path ?? path
    this.authorize = handler.authorize || authorize
    this.transacted = !!(
      handler.transacted ||
      controller.transacted ||
      // Core graph and assets operations are always transacted, unless the verb
      // is 'get':
      handler.core && verb !== 'get' && (controller.graph || controller.assets)
    )
    this.authorization = controller.processAuthorize(this.authorize)
    this.app = controller.app
    this.paramsName = ['post', 'put', 'patch'].includes(this.verb)
      ? 'body'
      : 'query'
    const { parameters, returns, options = {} } = this.handler
    this.parameters = this.app.compileParametersValidator(parameters, {
      async: true,
      ...options.parameters, // See @parameters() decorator
      dataName: this.paramsName
    })
    this.returns = this.app.compileParametersValidator(
      returns ? [returns] : [],
      {
        async: true,
        // Use instanceof checks instead of $ref to check returned values.
        // TODO: That doesn't guarantee the validity though...
        // This should always be $ref checks, I think?
        useInstanceOf: true,
        ...options.returns, // See @returns() decorator
        dataName: 'returns'
      }
    )
  }

  getParams(ctx, name = this.paramsName) {
    return name === 'path' ? ctx.params : ctx.request[name]
  }

  async callAction(ctx) {
    const params = await this.validateParameters(ctx)
    const { args, member } = await this.collectArguments(ctx, params)
    await this.controller.handleAuthorization(this.authorization, ctx, member)
    const { identifier } = this
    await this.controller.emitHook(`before:${identifier}`, false, ctx, ...args)
    const result = await this.callHandler(ctx, ...args)
    return this.validateResult(
      await this.controller.emitHook(`after:${identifier}`, true, ctx, result)
    )
  }

  async callHandler(ctx, ...args) {
    return this.handler.call(this.controller, ctx, ...args)
  }

  createValidationError(options) {
    return this.app.createValidationError(options)
  }

  async validateParameters(ctx) {
    if (!this.parameters.validate) {
      return null
    }
    // Since validation also performs coercion, create a clone of the params
    // so that this doesn't modify the data on `ctx`.
    // NOTE: The data can be either an object or an array.
    const data = clone(this.getParams(ctx))
    let params = data
    const { dataName } = this.parameters
    let wrappedRoot = false
    const errors = []
    for (const {
      name, // String: Property name to fetch from data. Overridable by `root`
      type, // String: What type should this validated against / coerced to.
      member, // Boolean: Fetch member instance insted of data from request.
      root, // Boolean: Use full root object, instead of data at given property.
      from // String: Allow parameters to be 'borrowed' from other objects.
    } of this.parameters.list) {
      // Don't validate member parameters as they get resolved separately after.
      if (member) continue
      // If no name is provided, wrap the full root object as value and unwrap
      // at the end, see `wrappedRoot`.
      let paramName = name
      const wrapRoot = !paramName
      if (root || wrapRoot) {
        // If root is to be used, replace `params` with a new object on which
        // to set the root object to validate under `parameters.dataName`
        if (wrapRoot) {
          paramName = dataName
          wrappedRoot = true
        }
        params = { [paramName]: data }
      }
      if (from) {
        // Allow parameters to be 'borrowed' from other objects.
        // Possible values are:
        // - 'path': Use `ctx.params` which is mapped to the route / path
        // - 'query': Use `ctx.request.query`, regardless of the verb.
        // - 'body': Use `ctx.request.body`, regardless of the verb.
        params[paramName] = this.getParams(ctx, from)?.[paramName]
      }
      try {
        const value = params[paramName]
        // `parameters.validate(params)` coerces data in the query to the
        // required formats, according to the rules specified here:
        // https://github.com/epoberezkin/ajv/blob/master/COERCION.md
        // Coercion isn't currently offered for 'object' and 'date' types,
        // so handle these cases prior to the call of `parameters.validate()`:
        const coerced = this.coerceValue(type, value, {
          // The model validation is handled separately through `$ref`.
          skipValidation: true
        })
        // If coercion happened, replace value in params with coerced one:
        if (coerced !== value) {
          params[paramName] = coerced
        }
      } catch (err) {
      // Convert error to Ajv validation error format:
        errors.push({
          dataPath: `.${paramName}`, // JavaScript property access notation
          keyword: 'type',
          message: err.message || err.toString(),
          params: { type }
        })
      }
    }

    const getData = () => wrappedRoot ? params[dataName] : params
    try {
      await this.parameters.validate(params)
      return getData()
    } catch (error) {
      if (error.errors) {
        errors.push(...error.errors)
      } else {
        throw error
      }
    }
    if (errors.length > 0) {
      throw this.createValidationError({
        type: 'ParameterValidation',
        message: `The provided data is not valid: ${JSON.stringify(getData())}`,
        errors
      })
    }
  }

  async validateResult(result) {
    if (this.returns.validate) {
      const returnsName = this.handler.returns.name
      // Use dataName if no name is given, see:
      // Application.compileParametersValidator(returns, { dataName })
      const data = {
        [returnsName || this.returns.dataName]: result
      }

      // If a named result is defined, return the data wrapped,
      // otherwise return the original unwrapped result object.
      const getResult = () => returnsName ? data : result
      try {
        await this.returns.validate(data)
        return getResult()
      } catch (error) {
        throw this.createValidationError({
          type: 'ResultValidation',
          message: `Invalid result of action: ${JSON.stringify(getResult())}`,
          errors: error.errors
        })
      }
    }
    return result
  }

  async collectArguments(ctx, params) {
    const { list, asObject } = this.parameters

    const args = asObject ? [{}] : []
    const addArgument = (name, value) => {
      if (asObject) {
        args[0][name] = value
      } else {
        args.push(value)
      }
    }

    let member = null
    // If we have parameters, add them to the arguments now,
    // while also keeping track of consumed parameters:
    for (const param of list) {
      const { name } = param
      // Handle `{ member: true }` parameters separately, by delegating to
      // `getMember()` to resolve to the given member.
      if (param.member) {
        member = await this.getMember(ctx, param)
        addArgument(name, member)
      } else {
        // If no name is provided, use the body object (params)
        addArgument(name, name ? params[name] : params)
      }
    }
    return { args, member }
  }

  coerceValue(type, value, modelOptions) {
    // See if param needs additional coercion:
    if (['date', 'datetime', 'timestamp'].includes(type)) {
      value = new Date(value)
    } else {
      // See if the defined type(s) require coercion to objects:
      const objectType = asArray(type).find(
        // Coerce to object if type is 'object' or a known model name.
        type => type === 'object' || type in this.app.models
      )
      if (objectType) {
        if (value && isString(value)) {
          value = JSON.parse(value)
        }
        if (objectType !== 'object' && isObject(value)) {
          // Convert the Pojo to the desired Dito model:
          const modelClass = this.app.models[objectType]
          if (modelClass && !(value instanceof modelClass)) {
            value = modelClass.fromJson(value, modelOptions)
          }
        }
      }
    }
    return value
  }

  async getMember(/* ctx, param */) {
    // This is only defined in `MemberAction`, where it resolves to the member
    // represented by the given route.
    return null
  }
}
