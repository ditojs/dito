import objection from 'objection'
import Router from 'koa-router'
import compose from 'koa-compose'
import { ResponseError, NotFoundError, WrappedError } from '@/errors'
import pluralize from 'pluralize'
import { isString, isFunction, asArray, camelize } from '@ditojs/utils'
import { convertSchema } from '@/schema'

export class Controller {
  constructor(app, namespace) {
    this.app = app
    this.namespace = this.namespace || namespace
    this.name = this.name ||
      this.constructor.name.match(/^(.*?)(?:Controller|)$/)[1]
    this.path = this.path || app?.normalizePath(this.name)
    this.graph = !!this.graph
    this.scope = this.scope || null
    this.modelClass = this.modelClass ||
      app?.models[camelize(pluralize.singular(this.name), true)]
    if (this.modelClass) {
      // Create an empty instance for validation of ids, see getId()
      // eslint-disable-next-line new-cap
      this.instance = new this.modelClass()
      this.router = new Router()
    }
  }

  initialize() {
    const { path, namespace } = this
    this.url = namespace ? `/${namespace}/${path}` : `/${path}`
    this.applyScope = this.scope
      ? query => query.applyScope(this.scope)
      : null
    const parent = this.constructor.getParentActions()
    this.collection = this.setupActions('collection', parent)
    this.member = this.setupActions('member', parent)
  }

  static getParentActions() {
    const parentClass = Object.getPrototypeOf(this)
    if (!parentClass.hasOwnProperty('collection') &&
      !parentClass.hasOwnProperty('member')) {
      // If `collection` and `member` hasn't been inherited and resolved yet,
      // we need to create one instance of each controller class up the chain,
      // in order to get to its definitions of `collection` and `member`.
      // Once their inheritance is set up correctly, they will be exposed on the
      // class itself.
      // eslint-disable-next-line new-cap
      const { collection, member } = new parentClass()
      if (parentClass !== Controller) {
        // Recursively set up inheritance chains.
        const parent = parentClass.getParentActions()
        Object.setPrototypeOf(collection, parent.collection)
        Object.setPrototypeOf(member, parent.member)
      }
      parentClass.collection = collection
      parentClass.member = member
    }
    const { collection, member } = parentClass
    return { collection, member }
  }

  getOwnProperty(name) {
    return this.hasOwnProperty(name) && this[name]
  }

  compose() {
    return compose([
      this.router.routes(),
      this.router.allowedMethods()
    ])
  }

  setupActions(name, parent) {
    const actions = this[name] || {}
    // Inherit from the parent actions so overrides can use super.<action>():
    Object.setPrototypeOf(actions, parent[name])
    const { only } = actions
    // NOTE: setupActions() is called after the first call of getParentActions()
    // so we can be sure that Controller.collection / Controller.member is
    // defined and resolved. For more information see getParentActions():
    const defaults = Controller[name]
    // Respect `only` settings and clear any default method to deactivate it:
    if (only) {
      for (const key in actions) {
        if (key in defaults && !only.includes(key)) {
          actions[key] = undefined
        }
      }
    }

    // Now install the routes.
    const member = name === 'member'
    // NOTE: We can't use Object.entries() loops here, since we want the keys
    // inherited from the parents as well, see getParentActions()
    for (const key in actions) {
      const action = actions[key]
      if (isFunction(action)) {
        let verb = key
        let path = member ? `${this.url}/:id` : this.url
        let method = action
        if (!(key in defaults)) {
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
    this.instance.$validate(
      this.modelClass.getIdProperties(id),
      { patch: true }
    )
    return id
  }

  async callAction(action, ctx, getMember = null) {
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
    const args = await this.collectArguments(ctx, parameters, getMember)
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

  async collectArguments(ctx, parameters, getMember) {
    const { query } = ctx
    const consumed = parameters && getMember && {}
    const args = parameters?.map(
      ({ name }) => {
        if (consumed) {
          consumed[name] = true
        }
        return name ? query[name] : query
      }) ||
      // If no parameters are provided, pass the full ctx object to the method
      [ctx]
    if (getMember) {
      if (consumed) {
        // Create a copy of ctx that inherits from the real one but overrides
        // query with aversion that has all consumed query params removed, so it
        // can be passed on to the getMember() which calls `member.get(ctx)`:
        ctx = Object.setPrototypeOf({}, ctx)
        ctx.query = Object.entries(query).reduce((query, [key, value]) => {
          if (!consumed[key]) {
            query[key] = value
          }
        }, {})
      }
      // Resolve member and add as first argument to list.
      args.unshift(await getMember(ctx))
    }
    return args
  }

  execute(method) {
    return this.graph
      ? objection.transaction(this.modelClass, method)
      : method(this.modelClass)
  }

  executeAndFetch(action, ctx, modify) {
    const name = `${action}${this.graph ? 'Graph' : ''}AndFetch`
    return this.execute(modelClass =>
      modelClass[name](ctx.request.body)
        .modify(this.applyScope)
        .modify(modify)
    )
  }

  executeAndFetchById(action, ctx, modify) {
    const id = this.getId(ctx)
    const name = `${action}${this.graph ? 'Graph' : ''}AndFetchById`
    return this.execute(modelClass =>
      modelClass[name](id, ctx.request.body)
        .modify(this.applyScope)
        .modify(modify)
        .then(model => this.checkModel(model, id))
    )
  }

  collection = {
    get(ctx, modify) {
      return this.modelClass
        .find(ctx.query)
        .modify(this.applyScope)
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
      return this.executeAndFetch('insert', ctx, modify)
    },

    put(ctx, modify) {
      return this.executeAndFetch('update', ctx, modify)
    },

    patch(ctx, modify) {
      return this.executeAndFetch('upsert', ctx, modify)
    }
  }

  member = {
    get(ctx, modify) {
      const id = this.getId(ctx)
      return this.modelClass
        .findById(id, ctx.query)
        .modify(this.applyScope)
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
      return this.executeAndFetchById('update', ctx, modify)
    },

    patch(ctx, modify) {
      return this.executeAndFetchById('upsert', ctx, modify)
    }
  }
}
