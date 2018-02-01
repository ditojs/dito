import compose from 'koa-compose'
import Router from 'koa-router'
import chalk from 'chalk'
import { Model } from 'objection'
import { isString, isFunction, asArray } from '@ditojs/utils'
import { ResponseError, WrappedError } from '@/errors'
import { convertSchema } from '@/schema'

export class Controller {
  constructor(app, namespace) {
    this.app = app
    this.namespace = this.namespace || namespace
    this.logging = this.app?.config.log.routes
    this.level = 0
  }

  initialize(isRoot = true) {
    this.name = this.name ||
      this.constructor.name.match(/^(.*?)(?:Controller|)$/)[1]
    this.path = this.path || this.app.normalizePath(this.name)
    const { path, namespace } = this
    if (isRoot) {
      this.url = namespace ? `/${namespace}/${path}` : `/${path}`
      this.log(
        `${namespace && chalk.green(`${namespace}/`)}${
          chalk.cyan(this.name)}${chalk.white(':')}`,
        this.level
      )
      this.router = new Router()
      this.controller = this.setupActions('controller')
    }
  }

  compose() {
    return compose([
      this.router.routes(),
      this.router.allowedMethods()
    ])
  }

  getPath(type, path) {
    return path
  }

  getUrl(type, path) {
    path = this.getPath(type, path)
    return path && path !== '/' ? `${this.url}/${path}` : this.url
  }

  get controller() {
    if (!this._controller) {
      this._controller = {}

      const collect = key => {
        const action = this[key]
        if (key !== 'constructor' &&
            isFunction(action) &&
            !(action.prototype instanceof Model)) {
          this._controller[key] = action
        }
      }

      const proto = Object.getPrototypeOf(this)
      if (!proto.hasOwnProperty('initialize')) {
        Object.getOwnPropertyNames(proto).forEach(collect)
      }
      Object.getOwnPropertyNames(this).forEach(collect)
    }
    return this._controller
  }

  set controller(controller) {
    this._controller = controller
  }

  static getParentValues(type) {
    const parentClass = Object.getPrototypeOf(this)
    if (!parentClass.hasOwnProperty(type)) {
      // If the values haven't been inherited and resolved yet, we need to
      // create one instance of each controller class up the chain in order to
      // get to their definitions of the inheritable values.
      // Once their inheritance is set up correctly, values will be exposed on
      // the class itself.
      const instance = parentClass.hasOwnProperty('instance')
        ? parentClass.instance
        // eslint-disable-next-line new-cap
        : (parentClass.instance = new parentClass())
      let values = instance[type]
      if (parentClass !== Controller) {
        // Recursively set up inheritance chains.
        const parentValues = parentClass.getParentValues(type)
        if (parentValues) {
          values = Object.setPrototypeOf(values || {}, parentValues)
        }
      }
      parentClass[type] = values
    }
    return parentClass[type]
  }

  inheritValues(type) {
    let values = this[type]
    const parentValues = this.constructor.getParentValues(type)
    if (parentValues) {
      // Inherit from the parent values so overrides can use super.<action>():
      values = Object.setPrototypeOf(values || {}, parentValues)
    }
    return this.filterValues(values)
  }

  filterValues(values) {
    // Respect `allow` settings and clear any default method to deactivate it:
    if (values?.allow) {
      const allow = asArray(values.allow)
      for (const key in values) {
        if (!allow.includes(key) && key !== 'allow') {
          values[key] = undefined
        }
      }
    }
    return values
  }

  setupActions(type) {
    const actions = this.inheritValues(type)
    for (const name in actions) {
      const action = actions[name]
      if (isFunction(action)) {
        this.setupAction(type, action, name)
      }
    }
    return actions
  }

  setupAction(type, action, name) {
    this.setupRoute(
      type,
      action.verb || 'get',
      action.path || this.app.normalizePath(name),
      ctx => this.callAction(action, ctx)
    )
  }

  setupRoute(type, verb, path, handler) {
    const url = this.getUrl(type, path)
    this.log(
      `${chalk.magenta(verb.toUpperCase())} ${chalk.white(url)}`,
      this.level + 1
    )
    this.router[verb](url, async ctx => {
      try {
        const res = await handler.call(this, ctx)
        if (res !== undefined) {
          ctx.body = res
        }
      } catch (err) {
        throw err instanceof ResponseError ? err : new WrappedError(err)
      }
    })
  }

  async callAction(action, ctx, getFirstArgument = null) {
    const { query } = ctx
    let { validators, parameters, returns } = action
    if (!validators && (parameters || returns)) {
      validators = action.validators = {
        parameters: this.createValidator(parameters),
        returns: this.createValidator(returns, {
          // Use instanceof checks instead of $ref to check returned values.
          instanceof: true
        })
      }
    }

    if (validators && !validators.parameters(query)) {
      throw this.modelClass.createValidationError({
        type: 'RestValidation',
        message: `The provided data is not valid: ${JSON.stringify(query)}`,
        errors: validators.parameters.errors
      })
    }
    // TODO: Instead of splitting by consumed parameters, split by parameters
    // expected by QueryBuilder and supported by this controller, and pass
    // everything else to the parameters validator.
    const args = await this.collectArguments(ctx, parameters, getFirstArgument)
    const value = await action.call(this, ...args)
    const returnName = returns?.name
    // Use 'root' if no name is given, see createValidator()
    const returnData = { [returnName || 'root']: value }
    // Use `call()` to pass `value` as context to Ajv, see passContext:
    if (validators && !validators.returns.call(value, returnData)) {
      throw this.modelClass.createValidationError({
        type: 'RestValidation',
        message: `Invalid result of custom action: ${value}`,
        errors: validators.returns.errors
      })
    }
    return returnName ? returnData : value
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

  async collectArguments(ctx, parameters, getFirstArgument) {
    const { query } = ctx
    const consumed = parameters && getFirstArgument && {}
    const args = parameters?.map(
      ({ name }) => {
        if (consumed) {
          consumed[name] = true
        }
        return name ? query[name] : query
      }) ||
      // If no parameters are provided, pass the full ctx object to the method
      [ctx]
    if (getFirstArgument) {
      if (consumed) {
        // Create a copy of ctx that inherits from the real one but overrides
        // query with a version that has all consumed query params removed so it
        // can be passed on to getFirstArgument() which calls actions.find(ctx):
        ctx = Object.setPrototypeOf({}, ctx)
        ctx.query = Object.entries(query).reduce((query, [key, value]) => {
          if (!consumed[key]) {
            query[key] = value
          }
        }, {})
      }
      // Resolve member and add as first argument to list.
      args.unshift(await getFirstArgument(ctx))
    }
    return args
  }

  log(str, indent = 0) {
    if (this.logging) {
      console.log(`${'  '.repeat(indent)}${str}`)
    }
  }
}
