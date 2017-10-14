import objection from 'objection'
import colors from 'colors/safe'
import pluralize from 'pluralize'
import { isObject, keyItemsBy, hyphenate } from '../utils'
import { convertSchema } from '../core/schema'
import NotFoundError from './NotFoundError'

export default class RestGenerator {
  constructor({ adapter, prefix, logger } = {}) {
    this.adapter = adapter
    this.logger = logger
    this.prefix = /\/$/.test(prefix) ? prefix : `${prefix}/`
    this.models = Object.create(null)
    this.findQueries = Object.create(null)
  }

  addModelRoutes(modelClass) {
    this.log(`${colors.green(modelClass.name)}${colors.white(':')}`)
    const { collection, instance, relations } = modelClass.routes || {}
    this.addRoutes(modelClass, null, 'collection', collection, 1)
    // Install static methods before ids, as they wouldn't match otherwise
    this.addMethods(modelClass, 'collectionMethod', 1)
    this.addRoutes(modelClass, null, 'instance', instance, 1)
    this.addMethods(modelClass, 'instanceMethod', 1)
    if (relations) {
      for (const relation of Object.values(modelClass.getRelations())) {
        const { name } = relation
        this.log(`${colors.blue(name)}${colors.white(':')}`, 1)
        const settings = relations[name]
        this.addRoutes(modelClass, relation, 'relation', settings, 2)
        this.addRoutes(modelClass, relation, 'relationInstance', settings, 2)
      }
    }
  }

  addRoutes(modelClass, relation, type, routesSettings = {}, indent) {
    const handlers = restHandlers[type]
    const getSettings = settingsHandlers[type]
    for (let [verb, handler] of Object.entries(getSettings ? handlers : {})) {
      const settings = getSettings(verb, handlers, routesSettings)
      if (!settings || !settings.access) {
        continue
      }
      if (isObject(handler)) {
        if (relation && handler.isValid && !handler.isValid(relation)) {
          continue
        }
        handler = handler.handler
      }
      const route = this.getRoutePath(type, modelClass, relation)
      const target = relation || modelClass
      this.adapter.addRoute(
        { modelClass, relation, type, verb, route, settings },
        ctx => handler(target, ctx))
      this.log(`${colors.magenta(verb.toUpperCase())} ${colors.white(route)}`,
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
        this.log(`${colors.magenta(verb.toUpperCase())} ${colors.white(route)}`,
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
  return hyphenate(plural ? pluralize(name) : name)
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
    : settings
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
          // TODO: upsertGraphAndFetch()!
          .upsertGraph(ctx.request.body)
      })
    },

    // patch collection
    patch(modelClass, ctx) {
      return objection.transaction(modelClass, modelClass => {
        return modelClass.query()
          // TODO: updateGraphAndFetch()!
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
        .allowEager(modelClass.getFindQuery().allowEager())
        .eager(ctx.query.eager)
        .findById(id)
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
        .updateAndFetchById(id, ctx.request.body)
        .then(model => checkModel(model, modelClass, id))
    },

    // patch collection
    patch(modelClass, ctx) {
      const { id } = ctx.params
      return modelClass.query()
        .patchAndFetchById(id, ctx.request.body)
        .then(model => checkModel(model, modelClass, id))
    }
  },

  relation: {
    // post relation
    post(relation, ctx) {
      // TODO: What's the expected behavior in a toOne relation?
      const { id } = ctx.params
      const { body } = ctx.request
      const { ownerModelClass } = relation
      return objection.transaction(ownerModelClass, ownerModelClass => {
        const builder = ownerModelClass.query()
        return builder
          .whereComposite(builder.fullIdColumnFor(ownerModelClass), id)
          .first()
          .then(model => checkModel(model, ownerModelClass, id)
            .$relatedQuery(relation.name)
            .insertGraph(body))
      })
    },

    // get relation
    get(relation, ctx) {
      const { id } = ctx.params
      const { ownerModelClass } = relation
      const builder = ownerModelClass.query()
      return builder
        .whereComposite(builder.fullIdColumnFor(ownerModelClass), id)
        .first()
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
      const { id } = ctx.params
      const { ownerModelClass } = relation
      return objection.transaction(ownerModelClass, ownerModelClass => {
        const builder = ownerModelClass.query()
        return builder
          .whereComposite(builder.fullIdColumnFor(ownerModelClass), id)
          .first()
          .then(model => checkModel(model, ownerModelClass, id)
            .$relatedQuery(relation.name)
            .delete())
          .then(() => ({})) // TODO: What does LB do here?
      })
    },

    // put relation
    put: {
      // TODO: What's the expected behavior in a toOne relation?
      isValid(relation) {
        return !(relation.isOneToOne())
      },
      handler(relation, ctx) {
        const { id } = ctx.params
        const { ownerModelClass, relatedModelClass } = relation
        let model
        return objection.transaction(ownerModelClass, relatedModelClass,
          (ownerModelClass, relatedModelClass) => {
            const builder = ownerModelClass.query()
            return builder
              .whereComposite(builder.fullIdColumnFor(ownerModelClass), id)
              .first()
              .eager(relation.name)
              .then(mod => {
                model = checkModel(mod, ownerModelClass, id)
                const current = model[relation.name]
                const idKey = relatedModelClass.getIdProperty()
                const currentById = keyItemsBy(current, idKey)
                const inputModels = relatedModelClass.ensureModelArray(
                  ctx.request.body)
                const inputModelsById = keyItemsBy(inputModels, idKey)

                function isNew(model) {
                  return !model.$id() || !currentById[model.$id()]
                }

                const insertModels = inputModels.filter(isNew)
                const updateModels = inputModels.filter(m => !isNew(m))
                const deleteModels = current.filter(
                  model => !inputModelsById[model.$id()])

                const insertAndUpdateQueries = [
                  ...updateModels.map(update => update.$query().patch()),
                  ...insertModels.map(insert => {
                    delete insert[relatedModelClass.getIdProperty()]
                    return model.$relatedQuery(relation.name).insert(insert)
                  })
                ]

                return model
                  .$relatedQuery(relation.name)
                  .delete()
                  .whereInComposite(builder.fullIdColumnFor(relatedModelClass),
                    deleteModels.map(model => model.$id()))
                  .then(() => Promise.all(insertAndUpdateQueries))
              })
              .then(() => model.$relatedQuery(relation.name))
          }
        )
      }
    }
  },

  relationInstance: {
    // TODO: HasManyRelation, BelongsToOneRelation, HasOneThroughRelation,
    // ManyToManyRelation?

    // post relationInstance = "generateRelationRelate" ??
    post: {
      isValid(relation) {
        return relation instanceof objection.ManyToManyRelation
      },
      handler(relation, ctx) {
        const { id, relatedId } = ctx.params
        const { ownerModelClass, relatedModelClass } = relation
        return objection.transaction(ownerModelClass, relatedModelClass,
          (ownerModelClass, relatedModelClass) => {
            const builder = ownerModelClass.query()
            return builder
              .whereComposite(builder.fullIdColumnFor(ownerModelClass), id)
              .first()
              .then(model => {
                return checkModel(model, ownerModelClass, id)
                  .$relatedQuery(relation.name)
                  .relate(relatedId)
              })
              .then(() => {
                return relatedModelClass
                  .whereComposite(
                    builder.fullIdColumnFor(relation.relatedModelClass),
                    relatedId)
                  .allowEager(
                    relation.relatedModelClass.getFindQuery().allowEager())
                  .eager(ctx.query.eager)
                  .first()
              })
          }
        )
      }
    }
  }
}
