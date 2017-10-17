import objection from 'objection'
import chalk from 'chalk'
import pluralize from 'pluralize'
import { isObject, kebabCase } from '../utils'
import { convertSchema } from '../model/schema'
import NotFoundError from '../model/NotFoundError'

export default class RestGenerator {
  constructor({ adapter, prefix, logger } = {}) {
    this.adapter = adapter
    this.logger = logger
    this.prefix = /\/$/.test(prefix) ? prefix : `${prefix}/`
    this.models = Object.create(null)
    this.findQueries = Object.create(null)
  }

  addModelRoutes(modelClass) {
    this.log(`${chalk.green(modelClass.name)}${chalk.white(':')}`)
    const { collection, instance, relations } = modelClass.routes || {}
    this.addRoutes(modelClass, null, 'collection', collection, 1)
    // Install static methods before ids, as they wouldn't match otherwise
    this.addMethods(modelClass, 'collectionMethod', 1)
    this.addRoutes(modelClass, null, 'instance', instance, 1)
    this.addMethods(modelClass, 'instanceMethod', 1)
    if (relations) {
      for (const relation of Object.values(modelClass.getRelations())) {
        const { name } = relation
        this.log(`${chalk.blue(name)}${chalk.white(':')}`, 1)
        const settings = relations[name]
        this.addRoutes(modelClass, relation, 'relation', settings, 2)
        if (!relation.isOneToOne()) {
          // TODO: Shouldn't OneToOne relations also offer a way to unrelated /
          // relate instead of directly manipulate the related object? Should
          // we make the distinction between relation and instance here too, and
          // if so, do we go by Id as well?
          this.addRoutes(modelClass, relation, 'relationInstance', settings, 2)
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
      const route = this.getRoutePath(type, modelClass, relation)
      const target = relation || modelClass
      this.adapter.addRoute(
        { modelClass, relation, type, verb, route, settings },
        ctx => handler(target, ctx))
      this.log(`${chalk.magenta(verb.toUpperCase())} ${chalk.white(route)}`,
        indent)
    }
  }

  addMethods(modelClass, type, indent) {
    for (const [name, schema] of Object.entries(modelClass.methods || {})) {
      if (type === 'instanceMethod' ^ !!schema.static) {
        const method = {
          name,
          verb: 'get',
          path: name,
          ...schema
        }
        const { verb, path, access } = method
        const settings = {
          access: access != null ? access : true,
          verb
        }
        const route = this.getRoutePath(type, modelClass, path)
        const handler = methodHandlers[type]
        const validate = {
          arguments: createArgumentsValidator(modelClass, method.arguments),
          return: createArgumentsValidator(modelClass, [method.return])
        }
        this.adapter.addRoute(
          { modelClass, method, type, verb, route, settings },
          ctx => handler(modelClass, method, validate, ctx))
        this.log(`${chalk.magenta(verb.toUpperCase())} ${chalk.white(route)}`,
          indent)
      }
    }
  }

  log(str, indent = 0) {
    if (this.logger) {
      this.logger(`${'  '.repeat(indent)}${str}`)
    }
  }

  getRoutePath(type, modelClass, param) {
    return `${this.prefix}${routePath[type](modelClass, param)}`
  }
}

// TODO: Add normalization Options!
function normalize(name, plural = false) {
  return kebabCase(plural ? pluralize(name) : name)
}

const routePath = {
  collection(modelClass) {
    return normalize(modelClass.name, true)
  },
  collectionMethod(modelClass, path) {
    return `${routePath.collection(modelClass)}/${normalize(path)}`
  },
  instance(modelClass) {
    return `${routePath.collection(modelClass)}/:id`
  },
  instanceMethod(modelClass, path) {
    return `${routePath.instance(modelClass)}/${normalize(path)}`
  },
  relation(modelClass, relation) {
    return `${routePath.instance(modelClass)}/${normalize(relation.name)}`
  },
  relationInstance(modelClass, relation) {
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
    obj = {
      access: obj,
      verb
    }
  }
  return obj
}

const settingsHandlers = {
  collection: getSettings,
  instance: getSettings,

  relation: (verb, handlers, settings) => {
    const relation = settings && settings.relation
    return getSettings(verb, handlers,
      relation !== undefined ? relation : settings)
  },

  relationInstance: (verb, handlers, settings) => {
    const instance = settings && settings.relation
    return getSettings(verb, handlers,
      instance !== undefined ? instance : settings)
  }
}

/**
 * Remote Methods
 */
function createArgumentsValidator(modelClass, args = []) {
  const validator = modelClass.getValidator()
  if (args.length > 0) {
    const properties = {}
    for (const arg of args) {
      if (arg) {
        const { name, type, ...rest } = arg
        properties[name || 'root'] = { type, ...rest }
      }
    }
    const schema = convertSchema(properties, validator)
    return validator.compileWithCoercing(schema)
  }
  return () => true
}

function getArguments(modelClass, method, validate, query) {
  if (!validate(query)) {
    throw new modelClass.ValidationError(validate.errors,
      `The provided data is not valid: ${JSON.stringify(query)}`)
  }
  const args = []
  for (const { name } of method.arguments || []) {
    args.push(name ? query[name] : query)
  }
  return args
}

function getReturn(modelClass, method, validate, value) {
  const { name } = method.return || {}
  return Promise.resolve(value).then(value => {
    // Use 'root' if no name is given, see createArgumentsValidator()
    const data = { [name || 'root']: value }
    if (!validate(data)) {
      throw new modelClass.ValidationError(validate.errors,
        `Invalid result of remote method: ${value}`)
    }
    return name ? data : value
  })
}

function checkMethod(func, modelClass, name, isStatic, statusCode = 404) {
  if (!func) {
    const prefix = isStatic ? 'Static remote' : 'Remote'
    const err = new NotFoundError(
      `${prefix} method ${name} not found on Model ${modelClass.name}`)
    err.statusCode = statusCode
    throw err
  }
  return func
}

const methodHandlers = {
  collectionMethod(modelClass, method, validate, ctx) {
    const { name } = method
    const func = checkMethod(modelClass[name], modelClass, name, true)
    const args = getArguments(modelClass, method, validate.arguments, ctx.query)
    const value = func.call(modelClass, args)
    return getReturn(modelClass, method, validate.return, value)
  },

  instanceMethod(modelClass, method, validate, ctx) {
    return restHandlers.instance.get(modelClass, ctx)
      .then(model => {
        const { name } = method
        const func = checkMethod(model[name], modelClass, name, false)
        const args = getArguments(modelClass, method, validate.arguments,
          ctx.query)
        const value = func.call(model, args)
        return getReturn(modelClass, method, validate.return, value)
      })
  }
}

/**
 * Rest Routes
 */

function checkModel(model, modelClass, id, statusCode = 404) {
  if (!model) {
    const err = new NotFoundError(
      `Cannot find ${modelClass.name} model with id ${id}`)
    err.statusCode = statusCode
    throw err
  }
  return model
}

const restHandlers = {
  collection: {
    // get collection
    get(modelClass, ctx) {
      return modelClass.getFindQuery().build(ctx.query, modelClass.query())
    },

    // delete collection
    delete(modelClass, ctx) {
      return restHandlers.collection.get(modelClass, ctx)
        .delete()
        .then(count => ({ count }))
    },

    // post collection
    post(modelClass, ctx) {
      // TODO: Do graph methods need wrapping in transactions?
      return objection.transaction(modelClass, modelClass => {
        return modelClass.query()
          .insertGraph(ctx.request.body)
      })
    },

    // put collection
    put(modelClass, ctx) {
      return objection.transaction(modelClass, modelClass => {
        return modelClass.query()
          // TODO: upsertGraphAndFetch()
          // https://github.com/Vincit/objection.js/issues/556
          .upsertGraph(ctx.request.body)
      })
    },

    // patch collection
    patch(modelClass, ctx) {
      return objection.transaction(modelClass, modelClass => {
        return modelClass.query()
          // TODO: patchGraphAndFetch()!
          // https://github.com/Vincit/objection.js/issues/557
          .upsertGraph(ctx.request.body)
      })
    }
  },

  instance: {
    // get collection
    get(modelClass, ctx) {
      const { id } = ctx.params
      const builder = modelClass.query()
      return builder
        .findById(id)
        .allowEager(modelClass.getFindQuery().allowEager())
        .eager(ctx.query.eager)
        .then(model => checkModel(model, modelClass, id))
    },

    // delete collection
    delete(modelClass, ctx) {
      return modelClass.query()
        .deleteById(ctx.params.id)
        .then(count => ({ count }))
    },

    // put collection
    put(modelClass, ctx) {
      const { id } = ctx.params
      return modelClass.query()
        // TODO: upsertGraphAndFetch()
        // https://github.com/Vincit/objection.js/issues/556
        .updateAndFetchById(id, ctx.request.body)
        .then(model => checkModel(model, modelClass, id))
    },

    // patch collection
    patch(modelClass, ctx) {
      const { id } = ctx.params
      return modelClass.query()
        // TODO: patchGraphAndFetch()!
        // https://github.com/Vincit/objection.js/issues/557
        .patchAndFetchById(id, ctx.request.body)
        .then(model => checkModel(model, modelClass, id))
    }
  },

  relation: {
    // get relation
    get(relation, ctx) {
      const { id } = ctx.params
      const { ownerModelClass } = relation
      const builder = ownerModelClass.query()
      return builder
        .findById(id)
        .then(model => {
          checkModel(model, ownerModelClass, id)
          const query = relation.relatedModelClass.getFindQuery()
            .build(ctx.query, model.$relatedQuery(relation.name))
          return relation.isOneToOne() ? query.first() : query
        })
    },

    // delete relation
    delete(relation, ctx) {
      // TODO: What's the expected behavior in a toOne relation?
      // Currently it deletes the object itself, but shouldn't it unrelate
      // instead?
      const { id } = ctx.params
      const { ownerModelClass } = relation
      return objection.transaction(ownerModelClass, ownerModelClass => {
        const builder = ownerModelClass.query()
        return builder
          .findById(id)
          .then(model => checkModel(model, ownerModelClass, id)
            .$relatedQuery(relation.name)
            .delete())
          .then(count => ({ count }))
      })
    },

    // post relation
    post(relation, ctx) {
      // TODO: What's the expected behavior in a toOne relation?
      const { id } = ctx.params
      const { ownerModelClass } = relation
      return objection.transaction(ownerModelClass, ownerModelClass => {
        const builder = ownerModelClass.query()
        return builder
          .findById(id)
          .then(model => checkModel(model, ownerModelClass, id)
            .$relatedQuery(relation.name)
            .insertGraph(ctx.request.body))
      })
    },

    // put relation
    put(relation, ctx) {
      // TODO: What's the expected behavior in a toOne relation?
      const { id } = ctx.params
      const { ownerModelClass } = relation
      return objection.transaction(ownerModelClass, ownerModelClass => {
        const builder = ownerModelClass.query()
        return builder
          .findById(id)
          .then(model => checkModel(model, ownerModelClass, id)
            .$relatedQuery(relation.name)
            // TODO: upsertGraphAndFetch()
            // https://github.com/Vincit/objection.js/issues/556
            .upsertGraph(ctx.request.body))
      })
    }
  },

  relationInstance: {
    post(relation, ctx) {
      const { id, relatedId } = ctx.params
      const { ownerModelClass, relatedModelClass } = relation
      return objection.transaction(ownerModelClass, relatedModelClass,
        (ownerModelClass, relatedModelClass) => {
          const builder = ownerModelClass.query()
          return builder
            .findById(id)
            .then(model => {
              return checkModel(model, ownerModelClass, id)
                .$relatedQuery(relation.name)
                .relate(relatedId)
            })
            .then(related => {
              console.log(related) // TODO: inspect and decide what to do next
              return relatedModelClass
                .findById(relatedId)
                .allowEager(
                  relation.relatedModelClass.getFindQuery().allowEager())
                .eager(ctx.query.eager)
            })
        }
      )
    }
  }
}
