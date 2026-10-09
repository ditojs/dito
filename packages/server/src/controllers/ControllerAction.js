import { clone } from '@ditojs/utils'
import { ParameterValidator } from '../app/ParameterValidator.js'
import { convertModelsToJson } from '../utils/model.js'

export default class ControllerAction {
  constructor(
    controller,
    actions,
    definition,
    type,
    name,
    method,
    path,
    _authorize
  ) {
    const {
      handler,
      core,
      scope,
      authorize,
      transacted,
      parameters,
      response,
      options,
      extra
    } = definition

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
    this.parameters = new ParameterValidator(this.app, parameters, {
      async: true,
      ...options.parameters,
      dataName: this.paramsName
    })
    this.responseName = response?.name ?? null
    // Validate the response as a single parameter, named by `response.name`.
    const responseParameters = response ? [response] : null
    this.response = new ParameterValidator(this.app, responseParameters, {
      async: true,
      // Use patch validation for response, as we often don't return the
      // full model with all properties, but only a subset of them.
      patch: true,
      ...options.response,
      dataName: 'response'
    })
    // Copy over the additional properties, e.g. `cached` so application
    // middleware can implement caching mechanisms:
    Object.assign(this, extra)
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
    // Expose the query parameters that aren't consumed by the action's
    // parameters, for the default actions to pass on to their queries.
    ctx.filteredQuery = this.getFilteredQuery(ctx, params, wrapped)
    const { args, member } = await this.collectArguments(ctx, params)
    await this.controller.handleAuthorization(this.authorization, ctx, member)
    const { identifier } = this
    await this.controller.emitHook(`before:${identifier}`, false, ctx, ...args)
    const response = await this.callHandler(ctx, ...args)
    const result =
      // Don't convert response to JSON if it isn't being validated, or if the
      // response validation schema contains model references.
      !this.response.validate || this.response.hasModelRefs
        ? response
        : convertModelsToJson(response)
    return this.validateResponse(
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
    const params = {}
    const { dataName } = this.parameters
    let unwrapRoot = false
    for (const {
      name, // String: Property name to fetch from data. Overridable by `root`
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
        params[paramName] = clone(wrapRoot ? source : source?.[paramName])
      } else if (wrapRoot) {
        // If root is to be used, set the root object to validate under
        // `parameters.paramName`
        params[paramName] = clone(data)
      } else {
        params[paramName] = clone(data[paramName])
      }
    }
    const errors = await this.parameters.validateParameters(params)
    const validated = unwrapRoot ? params[dataName] : params
    if (errors.length > 0) {
      throw this.createValidationError({
        type: 'ParameterValidation',
        message: 'The provided action parameters are not valid',
        errors,
        json: validated
      })
    }
    return { params: validated, wrapped: validated !== params }
  }

  async validateResponse(response) {
    if (this.response.validate) {
      const { responseName } = this
      const responseWrapped = !!responseName
      // Use dataName if no name is given, see:
      // Application.compileParametersValidator(response, { dataName })
      const dataName = responseName || this.response.dataName
      const wrapped = { [dataName]: response }
      // If a named result is defined, return the data wrapped,
      // otherwise return the original unwrapped result object.
      const getResult = () => (responseWrapped ? wrapped : response)
      try {
        await this.response.validate(wrapped)
        return getResult()
      } catch (error) {
        // If the error contains errors, add them to the validation error:
        const { errors } = error
        const regexp = new RegExp(`^/${dataName}`)
        throw this.createValidationError({
          type: 'ResultValidation',
          message: 'The returned action result is not valid',
          errors: responseWrapped
            ? errors
            : errors.map(error => ({
                ...error,
                instancePath: error.instancePath.replace(regexp, '')
              })),
          json: getResult()
        })
      }
    }
    return response
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

  getFilteredQuery(ctx, params, wrapped) {
    // `params` only holds the validated parameters, so filter the full query.
    return params && !wrapped && this.paramsName === 'query'
      ? this.filterParameters(ctx.query)
      : ctx.query
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

  async getMember(/* ctx, param */) {
    // This is only defined in `MemberAction`, where it resolves to the member
    // represented by the given route.
    return null
  }
}
