import objection from 'objection'
import Koa from 'koa'
import Router from 'koa-router'
import { ResponseError, NotFoundError, WrappedError } from '@/errors'
import pluralize from 'pluralize'
import { isString, isFunction, asArray, camelize } from '@ditojs/utils'
import { convertSchema } from '@/schema'

export class Controller extends Koa {
  constructor(app) {
    super()
    this.app = app
    const { name } = this.constructor
    this.name = this.name || name.match(/^(.*?)(?:Controller|)$/)[1]
    this.path = this.path || app.normalizePath(this.name)
    this.modelClass = this.modelClass ||
      this.app.models[camelize(pluralize.singular(this.name), true)]
    this.router = new Router()
  }

  initialize() {
    this.collection = this.setupActions(this.collection || {}, collection, true)
    this.member = this.setupActions(this.member || {}, member, false)
    this.use(this.router.routes())
    this.use(this.router.allowedMethods())
  }

  getUrl() {
    const { path, namespace } = this
    return namespace ? `/${namespace}/${path}` : `/${path}`
  }

  setupActions(actions, proto, collection) {
    // Inherit from the default methods so overrides can use super.<action>():
    Object.setPrototypeOf(actions, proto)
    const { only } = actions
    // Respect `only` settings and clear any default method to deactivate it:
    if (only) {
      for (const key in actions) {
        if (key in proto && !only.includes(key)) {
          actions[key] = undefined
        }
      }
    }

    // Now install the routes.
    for (const [key, action] of Object.entries(actions)) {
      if (isFunction(action)) {
        let verb = key
        let path = collection ? '/' : '/:id'
        let method = action
        if (!(key in proto)) {
          // A custom action:
          path = `${path}/${action.path || this.app.normalizePath(key)}`
          verb = action.verb
          method = async ctx => this.callAction(action, ctx,
            ctx => collection
              ? this.modelClass
              : actions.get.call(this, ctx)
          )
        }
        console.log(verb, `${this.getUrl()}${path}`)
        this.router[verb](path, async ctx => {
          try {
            const res = await method.call(this, ctx)
            if (res !== undefined) {
              ctx.body = res
            }
          } catch (err) {
            throw err instanceof ResponseError ? err : new WrappedError(err)
          }
        })
      }
    }
    return actions
  }

  checkModel(model, id) {
    if (!model) {
      throw new NotFoundError(
        `Cannot find '${this.modelClass.name}' model with id ${id}`)
    }
    return model
  }

  async callAction(action, ctx, bind) {
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
    let consumed = null
    const args = parameters?.map(
      ({ name }) => {
        consumed = consumed || {}
        consumed[name] = true
        return name ? query[name] : query
      }) ||
      // If no parameters are provided, pass the full ctx object to the method
      [ctx]
    if (consumed) {
      // Create a copy of ctx that inherits from the real one but overrides
      // query with aversion that has all consumed query params removed.
      ctx = Object.setPrototypeOf({}, ctx)
      ctx.query = Object.entries(ctx.query).reduce((query, [key, value]) => {
        if (!consumed[key]) {
          query[key] = value
        }
      }, {})
    }
    const value = await action.call(bind && await bind(ctx), ...args)
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
}

const collection = {
  get(ctx, modify) {
    return this.modelClass
      .find(ctx.query)
      .modify(modify)
  },

  delete(ctx, modify) {
    // TODO: Decide if we should set status? status = 204
    return this.modelClass
      .find(ctx.query)
      .delete()
      .modify(modify)
      .then(count => ({ count }))
  },

  post(ctx, modify) {
    // TODO: Decide if we should set status? status = 201
    // TODO: Add Controller#graph and only use graphs here for controllers that
    // require it.
    return objection.transaction(this.modelClass, modelClass => {
      return modelClass
        .insertGraphAndFetch(ctx.request.body)
        .modify(modify)
    })
  },

  put(ctx, modify) {
    return objection.transaction(this.modelClass, modelClass => {
      return modelClass
        .updateGraphAndFetch(ctx.request.body)
        .modify(modify)
    })
  },

  patch(ctx, modify) {
    return objection.transaction(this.modelClass, modelClass => {
      return modelClass
        .upsertGraphAndFetch(ctx.request.body)
        .modify(modify)
    })
  }
}

const member = {
  get(ctx, modify) {
    const { id } = ctx.params
    return this.modelClass
      .findById(id, ctx.query)
      .modify(modify)
      .then(model => this.checkModel(model, id))
  },

  delete(ctx, modify) {
    const { id } = ctx.params
    return this.modelClass
      .deleteById(id)
      .modify(modify)
      .then(count => ({ count }))
  },

  put(ctx, modify) {
    const { id } = ctx.params
    return objection.transaction(this.modelClass, modelClass => {
      return modelClass
        .updateGraphAndFetchById(id, ctx.request.body)
        .modify(modify)
        .then(model => this.checkModel(model, id))
    })
  },

  patch(ctx, modify) {
    const { id } = ctx.params
    return objection.transaction(this.modelClass, modelClass => {
      return modelClass
        .upsertGraphAndFetchById(id, ctx.request.body)
        .modify(modify)
        .then(model => this.checkModel(model, id))
    })
  }
}
