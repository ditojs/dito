import objection from 'objection'
import chalk from 'chalk'
import pluralize from 'pluralize'
import { convertSchema } from '@/schema'
import { NotFoundError } from '@/errors'
import { isObject, isString, isFunction, pick, hyphenate } from '@ditojs/utils'

export default class RestGenerator {
  constructor({ adapter, logging, prefix } = {}) {
    this.adapter = adapter
    this.logging = logging
    this.prefix = /\/$/.test(prefix) ? prefix : `${prefix}/`
    this.models = Object.create(null)
  }

  addModelRoutes(modelClass) {
    this.log(`${chalk.green(modelClass.name)}${chalk.white(':')}`)
    const { routes = {}, methods = {} } = modelClass.definition
    this.addRoutes(modelClass, null, 'collection', routes.collection, 1)
    // Install static methods before ids, as they wouldn't match otherwise
    this.addMethods(modelClass, 'collectionMethod', methods.collection, 1)
    this.addRoutes(modelClass, null, 'member', routes.member, 1)
    this.addMethods(modelClass, 'memberMethod', methods.member, 1)
    const { relations } = routes
    if (relations) {
      for (const relation of Object.values(modelClass.getRelations())) {
        const { name } = relation
        this.log(`${chalk.blue(name)}${chalk.white(':')}`, 1)
        const settings = pick(relations[name], relations)
        this.addRoutes(modelClass, relation, 'relation', settings, 2)
        if (!relation.isOneToOne()) {
          // TODO: Shouldn't OneToOne relations also offer a way to unrelated /
          // relate instead of directly manipulate the related object? Should
          // we make the distinction between relation and member here too, and
          // if so, do we go by Id as well?
          this.addRoutes(modelClass, relation, 'relationMember', settings, 2)
        }
      }
    }
  }

  addRoutes(modelClass, relation, type, routesSettings, indent) {
    const handlers = restHandlers[type]
    const getSettings = settingsHandlers[type]
    for (const [verb, handler] of Object.entries(getSettings ? handlers : {})) {
      const settings = getSettings(verb, handlers, routesSettings)
      if (!settings || !settings.access) {
        continue
      }
      const path = this.getRoutePath(type, modelClass, relation)
      const target = relation || modelClass
      this.adapter.addRoute(
        { modelClass, relation, type, verb, path, settings },
        ctx => handler(target, ctx))
      this.log(`${chalk.magenta(verb.toUpperCase())} ${chalk.white(path)}`,
        indent)
    }
  }

  addMethods(modelClass, type, methodsSettings, indent) {
    for (const [name, schema] of Object.entries(methodsSettings || {})) {
      const method = {
        // Defaults:
        name,
        verb: 'get',
        // Overrides:
        ...schema
      }
      const { verb, access } = method
      const settings = {
        access: access != null ? access : true
      }
      const path = this.getRoutePath(type, modelClass, name)
      const handler = methodHandlers[type]
      const validate = {
        arguments: createArgumentsValidator(modelClass, method.arguments),
        return: createArgumentsValidator(modelClass, [method.return], {
          // Use instanceof checks instead of $ref to check returned values
          instanceof: true
        })
      }
      this.adapter.addRoute(
        { modelClass, method, type, verb, path, settings },
        ctx => handler(modelClass, method, validate, ctx))
      this.log(`${chalk.magenta(verb.toUpperCase())} ${chalk.white(path)}`,
        indent)
    }
  }

  log(str, indent = 0) {
    if (this.logging) {
      console.log(`${'  '.repeat(indent)}${str}`)
    }
  }

  getRoutePath(type, modelClass, param) {
    return `${this.prefix}${routePath[type](modelClass, param)}`
  }
}

// TODO: Add normalization Options!
function normalize(name, plural = false) {
  return hyphenate(plural ? pluralize(name) : name)
}

const routePath = {
  collection(modelClass) {
    return normalize(modelClass.name, true)
  },
  collectionMethod(modelClass, path) {
    return `${routePath.collection(modelClass)}/${normalize(path)}`
  },
  member(modelClass) {
    return `${routePath.collection(modelClass)}/:id`
  },
  memberMethod(modelClass, path) {
    return `${routePath.member(modelClass)}/${normalize(path)}`
  },
  relation(modelClass, relation) {
    return `${routePath.member(modelClass)}/${normalize(relation.name)}`
  },
  relationMember(modelClass, relation) {
    return `${routePath.relation(modelClass, relation)}/:relatedId`
  }
}

/**
 * Route Settings Handling
 */

function getSettings(verb, handlers, settings) {
  // Only use `settings[verb]` as the settings for this handler, if `settings`
  // contains any of the verbs defined in handlers. If not, then `settings`
  // is a shared object to be used for all verbs:
  let obj = isObject(settings) &&
    Object.keys(handlers).find(verb => settings[verb])
    ? settings[verb]
    : settings || false
  if (!isObject(obj) || !('access' in obj)) {
    // TODO: Improve check by looking for any route settings properties in
    // Object.keys(obj), and only wrap with `access: obj` if obj doesn't contain
    // any of these keys.
    obj = { access: obj }
  }
  return obj
}

const settingsHandlers = {
  collection: getSettings,
  member: getSettings,

  relation: (verb, handlers, settings) => {
    return getSettings(verb, handlers,
      settings && pick(settings.relation, settings))
  },

  relationMember: (verb, handlers, settings) => {
    return getSettings(verb, handlers,
      settings && pick(settings.relation, settings))
  }
}

/**
 * Remote Methods
 */
function createArgumentsValidator(modelClass, args = [], options = {}) {
  if (args.length > 0) {
    let properties = null
    for (const arg of args) {
      if (arg) {
        const property = isString(arg) ? { type: arg } : arg
        const { name, type, ...rest } = property
        properties = properties || {}
        properties[name || 'root'] = type ? { type, ...rest } : rest
      }
    }
    if (properties) {
      const schema = convertSchema(properties, options)
      return modelClass.compileValidator(schema)
    }
  }
  return () => true
}

function getArguments(modelClass, method, validate, ctx) {
  const { query } = ctx
  if (!validate(query)) {
    throw modelClass.createValidationError({
      type: 'RestValidation',
      message: `The provided data is not valid: ${JSON.stringify(query)}`,
      errors: validate.errors
    })
  }
  const args = []
  // If no arguments are provided, pass the full ctx object to the method
  for (const { name, value } of method.arguments || [{ value: ctx }]) {
    args.push(name ? query[name] : value || query)
  }
  return args
}

function getReturn(modelClass, method, validate, value) {
  const { name } = method.return || {}
  return Promise.resolve(value).then(value => {
    // Use 'root' if no name is given, see createArgumentsValidator()
    const data = { [name || 'root']: value }
    if (!validate.call(value, data)) { // passContext
      throw modelClass.createValidationError({
        type: 'RestValidation',
        message: `Invalid result of remote method: ${value}`,
        errors: validate.errors
      })
    }
    return name ? data : value
  })
}

function checkMethod(func, modelClass, name, prefix) {
  if (!isFunction(func)) {
    throw new NotFoundError(
      `${prefix} method '${name}' not found on Model '${modelClass.name}'`)
  }
  return func
}

const methodHandlers = {
  async collectionMethod(modelClass, method, validate, ctx) {
    const { name } = method
    const func = checkMethod(modelClass[name], modelClass, name, 'Collection')
    const args = getArguments(modelClass, method, validate.arguments, ctx)
    const value = await func.apply(modelClass, args)
    return getReturn(modelClass, method, validate.return, value)
  },

  async memberMethod(modelClass, method, validate, ctx) {
    const { id } = ctx.params
    const args = getArguments(modelClass, method, validate.arguments, ctx)
    // Now determine a list of allowed query parameter names, based on the
    // method definition and the result of its processing in getArguments():
    const { query } = ctx
    const allowed = args[0] === query
      // The full query object is expected, let all parameters pass
      ? Object.keys(query)
      // Build a list of allowed parameter names
      : method.arguments
        ? method.arguments.map(arg => arg.name)
        : null
    // Now pas son the list of allowed parameters to findById which will only
    // let those through and complain about additional ones.
    const model = await modelClass.findById(id, query, allowed)
    checkModel(model, modelClass, id)
    const { name } = method
    const func = checkMethod(model[name], modelClass, name, 'Member')
    const value = await func.apply(model, args)
    return getReturn(modelClass, method, validate.return, value)
  }
}

/**
 * Rest Routes
 */

function checkModel(model, modelClass, id) {
  if (!model) {
    throw new NotFoundError(
      `Cannot find '${modelClass.name}' model with id ${id}`)
  }
  return model
}

const restHandlers = {
  collection: {
    get(modelClass, ctx) {
      return modelClass.find(ctx.query)
    },
    delete(modelClass, ctx) {
      return modelClass.find(ctx.query)
        .delete()
        .then(count => ({ count }))
    },
    post(modelClass, ctx) {
      return objection.transaction(modelClass, modelClass =>
        modelClass.insertGraphAndFetch(ctx.request.body)
      )
    },
    put(modelClass, ctx) {
      return objection.transaction(modelClass, modelClass =>
        modelClass.updateGraphAndFetch(ctx.request.body)
      )
    },
    patch(modelClass, ctx) {
      return objection.transaction(modelClass, modelClass =>
        modelClass.upsertGraphAndFetch(ctx.request.body)
      )
    }
  },

  member: {
    get(modelClass, ctx) {
      const { id } = ctx.params
      return modelClass.findById(id, ctx.query)
        .then(model => checkModel(model, modelClass, id))
    },
    delete(modelClass, ctx) {
      const { id } = ctx.params
      return modelClass.deleteById(id)
        .then(count => ({ count }))
    },
    put(modelClass, ctx) {
      const { id } = ctx.params
      return objection.transaction(modelClass, modelClass =>
        modelClass.updateGraphAndFetchById(id, ctx.request.body)
          .then(model => checkModel(model, modelClass, id))
      )
    },
    patch(modelClass, ctx) {
      const { id } = ctx.params
      return objection.transaction(modelClass, modelClass =>
        modelClass.upsertGraphAndFetchById(id, ctx.request.body)
          .then(model => checkModel(model, modelClass, id))
      )
    }
  },

  relation: {
    get(relation, ctx) {
      // NOTE: `id` is the id of the member to which this relation belongs,
      // taken from the route parameters, to the `ctx.query` object.
      const { id } = ctx.params
      const { ownerModelClass } = relation
      const find = relation.isOneToOne() ? 'findOne' : 'find'
      return ownerModelClass.findById(id)
        .then(model => checkModel(model, ownerModelClass, id)
          .$relatedQuery(relation.name)[find](ctx.query))
        .then(result => result || null)
    },
    delete(relation, ctx) {
      // TODO: What's the expected behavior in a toOne relation?
      // Currently it deletes the object itself, but shouldn't it unrelate
      // instead?
      const { id } = ctx.params
      const { ownerModelClass } = relation
      return ownerModelClass.findById(id)
        .then(model => checkModel(model, ownerModelClass, id)
          .$relatedQuery(relation.name)
          // TODO: Test if filter works for delete
          .find(ctx.query)
          .delete())
        .then(count => ({ count }))
    },
    post(relation, ctx) {
      // TODO: What's the expected behavior in a toOne relation?
      const { id } = ctx.params
      const { ownerModelClass } = relation
      return objection.transaction(ownerModelClass, ownerModelClass =>
        ownerModelClass.findById(id)
          .then(model => checkModel(model, ownerModelClass, id)
            .$relatedQuery(relation.name)
            .insertGraphAndFetch(ctx.request.body))
      )
    },
    put(relation, ctx) {
      // TODO: What's the expected behavior in a toOne relation?
      const { id } = ctx.params
      const { ownerModelClass } = relation
      return objection.transaction(ownerModelClass, ownerModelClass =>
        ownerModelClass.findById(id)
          .then(model => checkModel(model, ownerModelClass, id)
            .$relatedQuery(relation.name)
            // TODO: Should this be supported? Does it work?
            // .find(ctx.query)
            .updateGraphAndFetch(ctx.request.body))
      )
    },
    patch(relation, ctx) {
      // TODO: What's the expected behavior in a toOne relation?
      const { id } = ctx.params
      const { ownerModelClass } = relation
      return objection.transaction(ownerModelClass, ownerModelClass =>
        ownerModelClass.findById(id)
          .then(model => checkModel(model, ownerModelClass, id)
            .$relatedQuery(relation.name)
            // TODO: Should this be supported? Does it work?
            // .find(ctx.query)
            .upsertGraphAndFetch(ctx.request.body))
      )
    }
  },

  relationMember: {
    post(relation, ctx) {
      const { id, relatedId } = ctx.params
      const { ownerModelClass, relatedModelClass } = relation
      return ownerModelClass
        .findById(id)
        .then(model => checkModel(model, ownerModelClass, id)
          .$relatedQuery(relation.name)
          .relate(relatedId))
        .then(related => {
          // TODO: inspect and decide what to do next
          console.log('related', related)
          return relatedModelClass
            .findById(relatedId, ctx.query)
        })
    }
  }
}
