import {
  isString,
  isObject,
  asArray,
  clone,
  convertToJson
} from '@ditojs/utils'

export default class ControllerAction {
  constructor(
    controller,
    actions,
    handler,
    type,
    name,
    method,
    path,
    _authorize
  ) {
    const {
      core = false,
      scope,
      authorize,
      transacted,
      parameters,
      returns,
      options = {},
      ...additional
    } = handler

    this.app = controller.app
    this.controller = controller
    this.actions = actions
    this.handler = handler
    this.type = type
    this.name = name
    this.identifier = `${type}:${name}`
    this.method = method
    this.path = path
    this.scope = scope
    // Allow action handlers to override the predetermined defaults for
    // `authorize`:
    this.authorize = authorize || _authorize
    this.transacted = !!(
      transacted ??
      controller.transacted ??
      // Core graph and assets operations are always transacted, unless the
      // method is 'get':
      (
        core &&
        method !== 'get' && (
          controller.graph ||
          controller.assets
        )
      )
    )
    this.authorization = controller.processAuthorize(this.authorize)
    this.paramsName = ['post', 'put', 'patch'].includes(this.method)
      ? 'body'
      : 'query'
    this.parameters = this.app.compileParametersValidator(parameters, {
      async: true,
      ...options.parameters,
      dataName: this.paramsName
    })
    this.returns = this.app.compileParametersValidator(asArray(returns), {
      async: true,
      ...options.returns,
      dataName: 'returns'
    })
    // Copy over the additional properties, e.g. `cached` so application
    // middleware can implement caching mechanisms:
    Object.assign(this, additional)
  }

  // Possible values for `from` are:
  // - 'path': Use `ctx.params` which is mapped to the route / path
  // - 'query': Use `ctx.request.query`, regardless of the action's method.
  // - 'body': Use `ctx.request.body`, regardless of the action's method.
  getParams(ctx, from = this.paramsName) {
    const params = from === 'path' ? ctx.params : ctx.request[from]
    // koa-bodyparser always sets an object, even when there is no body.
    // Detect this here and return null instead.
    const isNull = (
      from === 'body' &&
      ctx.request.headers['content-length'] === '0' &&
      Object.keys(params).length === 0
    )
    return isNull ? null : params
  }

  async callAction(ctx) {
    const { params, wrapped } = await this.validateParameters(ctx)
    const { args, member } = await this.collectArguments(ctx, params)
    let filteredQuery = null
    Object.defineProperty(ctx, 'filteredQuery', {
      get: () => {
        filteredQuery ??=
          params && !wrapped && this.paramsName === 'query'
            ? this.filterParameters(params)
            : ctx.query
        return filteredQuery
      },
      enumerable: false,
      configurable: true
    })
    await this.controller.handleAuthorization(this.authorization, ctx, member)
    const { identifier } = this
    await this.controller.emitHook(`before:${identifier}`, false, ctx, ...args)
    const result = await this.callHandler(ctx, ...args)
    return this.validateResult(
      await this.controller.emitHook(`after:${identifier}`, true, ctx, result)
    )
  }

  async callHandler(ctx, ...args) {
    return this.handler.call(this.actions, ctx, ...args)
  }

  createValidationError(options) {
    return this.app.createValidationError(options)
  }

  async validateParameters(ctx) {
    if (!this.parameters.validate) {
      return { params: null, wrapped: false }
    }
    // NOTE: The data can be either an object or an array.
    const data = this.getParams(ctx)
    let params = {}
    const { dataName } = this.parameters
    let unwrapRoot = false
    const errors = []
    for (const {
      name, // String: Property name to fetch from data. Overridable by `root`
      type, // String: What type should this validated against / coerced to.
      from // String: Allow parameters to be 'borrowed' from other objects.
    } of this.parameters.list) {
      // Don't validate member parameters as they get resolved separately after.
      if (from === 'member') continue
      const root = from === 'root'
      let wrapRoot = root
      let paramName = name
      // If no name is provided, wrap the full root object as value and unwrap
      // at the end, see `unwrapRoot`.
      if (!paramName) {
        paramName = dataName
        wrapRoot = true
        unwrapRoot = true
      }
      // Since validation also performs coercion, always create clones of the
      // params so that this doesn't modify the data on `ctx`.
      if (from && !root) {
        // Allow parameters to be 'borrowed' from other objects.
        const source = this.getParams(ctx, from)
        // See above for an explanation of `clone()`:
        params[paramName] = clone(wrapRoot ? source : source?.[paramName])
      } else if (wrapRoot) {
        // If root is to be used, replace `params` with a new object on which
        // to set the root object to validate under `parameters.paramName`
        if (params === data) {
          params = {}
        }
        params[paramName] = clone(data)
      } else {
        params[paramName] = clone(data[paramName])
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

    const getData = () => (unwrapRoot ? params[dataName] : params)
    try {
      await this.parameters.validate(params)
      const data = getData()
      return { params: data, wrapped: data !== params }
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
        message: 'The provided action parameters are not valid',
        errors,
        json: getData()
      })
    }
  }

  async validateResult(result) {
    if (this.returns.validate) {
      const json = convertToJson(result)
      const returnsName = this.handler.returns.name
      const returnsWrapped = !!returnsName
      // Use dataName if no name is given, see:
      // Application.compileParametersValidator(returns, { dataName })
      const dataName = returnsName || this.returns.dataName
      const wrapped = { [dataName]: json }
      // If a named result is defined, return the data wrapped,
      // otherwise return the original unwrapped result object.
      const getResult = () => (returnsWrapped ? wrapped : json)
      try {
        await this.returns.validate(wrapped)
        return getResult()
      } catch (error) {
        // If the error contains errors, add them to the validation error:
        const { errors } = error
        const regexp = new RegExp(`^/${dataName}`)
        throw this.createValidationError({
          type: 'ResultValidation',
          message: 'The returned action result is not valid',
          errors: returnsWrapped
            ? errors
            : errors.map(error => ({
                ...error,
                instancePath: error.instancePath.replace(regexp, '')
              })),
          json: getResult()
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
      const { name, from } = param
      // Handle `{ from: 'member' }` parameters separately, by delegating to
      // `getMember()` to resolve to the given member.
      if (from === 'member') {
        member = await this.getMember(ctx, param)
        addArgument(name, member)
      } else {
        // If no name is provided, use the body object (params)
        addArgument(name, name ? params[name] : params)
      }
    }
    return { args, member }
  }

  filterParameters(params) {
    const filtered = {}
    const consumedNames = Object.fromEntries(
      this.parameters.list
        .filter(param => !!param.name)
        .map(param => [param.name, true])
    )
    for (const [key, value] of Object.entries(params)) {
      if (!consumedNames[key]) {
        filtered[key] = value
      }
    }
    return filtered
  }

  coerceValue(type, value, modelOptions) {
    // See if param needs additional coercion:
    if (value && ['date', 'datetime', 'timestamp'].includes(type)) {
      value = new Date(value)
    } else {
      // See if the defined type(s) require coercion to objects:
      const objectType = asArray(type).find(
        // Coerce to object if type is 'object' or a known model name.
        type => type === 'object' || type in this.app.models
      )
      if (objectType) {
        if (value && isString(value)) {
          if (!/^\{.*\}$/.test(value)) {
            // Convert simplified Dito.js object notation to JSON, supporting:
            // - `"key1":X, "key2":Y` (curly braces are added and parsed through
            //   `JSON.parse()`)
            // - `key1:X,key2:Y` (a simple parser is applied, splitting into
            //   entries and key/value pairs, values are parsed with
            //   `JSON.parse()`, falling back to string.
            if (/"/.test(value)) {
              // Just add the curly braces and parse as JSON
              value = JSON.parse(`{${value}}`)
            } else {
              // A simple version of named key/value pairs, values can be
              // strings or numbers.
              value = Object.fromEntries(
                value.split(/\s*,\s*/g).map(entry => {
                  let [key, val] = entry.split(/\s*:\s*/)
                  try {
                    // Try parsing basic types, but fall back to unquoted
                    // string.
                    val = JSON.parse(val)
                  } catch {}
                  return [key, val]
                })
              )
            }
          } else {
            value = JSON.parse(value)
          }
        }
        if (objectType !== 'object' && isObject(value)) {
          // Convert the Pojo to the desired Dito.js model:
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
