import objection from 'objection'
import Router from 'koa-router'
import compose from 'koa-compose'
import { ResponseError, NotFoundError, WrappedError } from '@/errors'
import pluralize from 'pluralize'
import { isString, isFunction, asArray, camelize } from '@ditojs/utils'
import { convertSchema } from '@/schema'

export class Controller {
  constructor(app) {
    this.app = app
    const { name } = this.constructor
    this.name = this.name || name.match(/^(.*?)(?:Controller|)$/)[1]
    this.path = this.path || app.normalizePath(this.name)
    this.modelClass = this.modelClass ||
      this.app.models[camelize(pluralize.singular(this.name), true)]
    // Create an empty instance for validation of ids, see getId()
    // eslint-disable-next-line new-cap
    this.instance = new this.modelClass()
    this.router = new Router()
  }

  initialize() {
    this.collection = this.setupActions(this.collection, collection, false)
    this.member = this.setupActions(this.member, member, true)
  }

  compose() {
    return compose([
      this.router.routes(),
      this.router.allowedMethods()
    ])
  }

  getPath() {
    const { path, namespace } = this
    return namespace ? `/${namespace}/${path}` : `/${path}`
  }

  setupActions(actions = {}, proto, member) {
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
    const rootPath = this.getPath()
    for (const [key, action] of Object.entries(actions)) {
      if (isFunction(action)) {
        let verb = key
        let path = member ? `${rootPath}/:id` : rootPath
        let method = action
        if (!(key in proto)) {
          // A custom action:
          path = `${path}/${action.path || this.app.normalizePath(key)}`
          verb = action.verb || 'get'
          method = async ctx => this.callAction(action, ctx,
            member && (ctx => actions.get.call(this, ctx))
          )
        }
        console.log(verb, path)
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

  getId(ctx) {
    const { id } = ctx.params
    // Use a dummy instance to validate the format of the passed id
    // this.instance.$validate(
    //   this.modelClass.getIdProperties(id),
    //   { patch: true }
    // )
    return id
  }

  async callAction(action, ctx, arg) {
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

    // TODO: Instead of splitting by consumed parameters, split by parameters
    // expected by QueryBuilder and supported by this controller, and pass
    // everything else to the parameters validator.
    if (validators && !validators.parameters(query)) {
      throw this.modelClass.createValidationError({
        type: 'RestValidation',
        message: `The provided data is not valid: ${JSON.stringify(query)}`,
        errors: validators.parameters.errors
      })
    }
    const split = this.splitArguments(parameters, ctx, member)
    if (arg) {
      // Resolve first argument and add to argument list.
      split.args.unshift(await arg(split.ctx))
    }
    const value = await action.call(this, ...split.args)
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

  splitArguments(parameters, ctx, member) {
    const { query } = ctx
    const consumed = parameters && member && {}
    const args = parameters?.map(
      ({ name }) => {
        if (consumed) {
          consumed[name] = true
        }
        return name ? query[name] : query
      }) ||
      // If no parameters are provided, pass the full ctx object to the method
      [ctx]
    if (consumed) {
      // Create a copy of ctx that inherits from the real one but overrides
      // query with aversion that has all consumed query params removed, so it
      // can be passed on to the member.get(ctx) method.
      ctx = Object.setPrototypeOf({}, ctx)
      ctx.query = Object.entries(query).reduce((query, [key, value]) => {
        if (!consumed[key]) {
          query[key] = value
        }
      }, {})
    }
    return { ctx, args }
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
    const id = this.getId(ctx)
    return this.modelClass
      .findById(id, ctx.query)
      .modify(modify)
      .then(model => this.checkModel(model, id))
  },

  delete(ctx, modify) {
    return this.modelClass
      .deleteById(this.getId(ctx))
      .modify(modify)
      .then(count => ({ count }))
  },

  put(ctx, modify) {
    const id = this.getId(ctx)
    return objection.transaction(this.modelClass, modelClass => {
      return modelClass
        .updateGraphAndFetchById(id, ctx.request.body)
        .modify(modify)
        .then(model => this.checkModel(model, id))
    })
  },

  patch(ctx, modify) {
    const id = this.getId(ctx)
    return objection.transaction(this.modelClass, modelClass => {
      return modelClass
        .upsertGraphAndFetchById(id, ctx.request.body)
        .modify(modify)
        .then(model => this.checkModel(model, id))
    })
  }
}
