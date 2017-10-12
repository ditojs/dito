import objection from 'objection'
import Ajv from 'ajv'
import colors from 'colors/safe'
import findQuery from 'objection-find'
import pluralize from 'pluralize'
import {hyphenate, isObject, keyItemsBy} from '../utils'

export default class ApiGenerator {
  constructor({adapter, prefix, logger} = {}) {
    this.adapter = adapter || (() => {})
    this.logger = logger
    this.prefix = /\/$/.test(prefix) ? prefix : `${prefix}/`
    this.models = Object.create(null)
    this.findQueries = Object.create(null)
    // TODO: Implement valudation and value coercion for remote method arguments
    // and return value through Ajv.
    this.ajv = new Ajv({ coerceTypes: true })
  }

  getFindQuery(modelClass) {
    const {name} = modelClass
    let query = this.findQueries[name]
    if (!query) {
      query = this.findQueries[name] = findQuery(modelClass)
    }
    return query
  }

  addModelRoutes(modelClass) {
    this.log(`${colors.green(modelClass.name)}${colors.white(':')}`)
    const {collection, member, relations} = modelClass.routes || {}
    // Install methods before ids, as they wouldn't match otherwise
    this.addModelMethods(modelClass, 1)
    this.addRoutes(modelClass, 'collection', collection, 1)
    this.addRoutes(modelClass, 'member', member, 1)
    for (const relation of Object.values(modelClass.getRelations())) {
      this.log(`${colors.blue(relation.name)}${colors.white(':')}`, 1)
      this.addRoutes(relation, 'relation', relations, 2)
      this.addRoutes(relation, 'relatedMember', relations, 2)
    }
  }

  addRoutes(target, type, accessOptions = {}, indent) {
    const handlers = restHandlers[type]
    const getAccess = accessHandlers[type]
    for (let [verb, handler] of Object.entries(getAccess ? handlers : {})) {
      // Freeze access object so we can pass the same one but no middleware
      // can alter it and affect future requests.
      const access = Object.freeze(getAccess(verb, accessOptions, target))
      if (!access) {
        continue
      }
      if (isObject(handler)) {
        if (handler.isValid && !handler.isValid(target)) {
          continue
        }
        handler = handler.handler
      }
      const route = this.getRoutePath(type, target)
      this.adapter({verb, route, access},
        ctx => handler.call(this, target, ctx))
      this.log(`${colors.magenta(verb.toUpperCase())} ${colors.white(route)}`,
        indent)
    }
  }

  addModelMethods(modelClass, indent) {
    for (const [name, method] of Object.entries(modelClass.methods || {})) {
      const {
        arguments: _arguments,
        return: _return,
        static: _static,
        verb = 'get',
        path = name
      } = method
      const type = `${_static ? 'collection' : 'member'}Method`
      const route = this.getRoutePath(type, modelClass, path)
      // TODO: Access control for methods
      const access = true
      const handler = methodHandlers[type]
      this.adapter({verb, route, access},
        ctx => handler.call(this, modelClass, name, _arguments, _return, ctx))
      this.log(`${colors.magenta(verb.toUpperCase())} ${colors.white(route)}`,
        indent)
    }
  }

  log(str, indent = 0) {
    if (this.logger) {
      this.logger(`${'  '.repeat(indent)}${str}`)
    }
  }

  getRoutePath(type, target, param) {
    return `${this.prefix}${routePath[type](target, param)}`
  }
}

const routePath = {
  collection(modelClass) {
    return hyphenate(pluralize(modelClass.name))
  },
  member(modelClass) {
    return `${routePath.collection(modelClass)}/:id`
  },
  relation(relation) {
    return `${routePath.member(relation.ownerModelClass)}/${relation.name}`
  },
  relatedMember(relation) {
    return `${routePath.relation(relation)}/:relatedId`
  },
  collectionMethod(modelClass, path) {
    return `${routePath.collection(modelClass)}/${path}`
  },
  memberMethod(modelClass, path) {
    return `${routePath.member(modelClass)}/${path}`
  }
}

/**
 * Access Handling
 */

function getAccess(verb, options) {
  return isObject(options) ? options[verb] : options
}

const accessHandlers = {
  collection: (verb, collection) => getAccess(verb, collection),

  member: (verb, member) => getAccess(verb, member),

  relation: (verb, relations, {name}) => {
    const relation = relations[name]
    return getAccess(verb, relation && relation.relation || relation)
  },

  relatedMember: (verb, relations, {name}) => {
    const relation = relations[name]
    return getAccess(verb, relation && relation.member || relation)
  }
}

/**
 * Remote Methods
 */

function getArguments($arguments, query) {
  const args = []
  for (const {name, type} of $arguments || []) {
    args.push(query[name])
  }
  return args
}

function getReturn({name, type} = {}, value) {
  return Promise.resolve(value).then(value => {
    return name ? { [name]: value } : value
  })
}

function checkMethod(method, modelClass, name, _static, statusCode = 404) {
  if (!method) {
    const prefix = _static ? 'Static remote' : 'remote'
    const err = new Error(
      `${prefix} method ${name} not found on Model ${modelClass.name}`)
    err.statusCode = statusCode
    throw err
  }
  return method
}

const methodHandlers = {
  collectionMethod(modelClass, name, _arguments, _return, ctx) {
    const method = checkMethod(modelClass[name], modelClass, name, true)
    const value = method.call(modelClass, getArguments(_arguments, ctx.query))
    return getReturn(_return, value)
  },

  memberMethod(modelClass, name, _arguments, _return, ctx) {
    return restHandlers.member.get.call(this, modelClass, ctx)
      .then(model => {
        const method = checkMethod(model[name], modelClass, name, false)
        const value = method.call(model, getArguments(_arguments, ctx.query))
        return getReturn(_return, value)
      })
  }
}

/**
 * Rest Routes
 */

function checkModel(model, modelClass, id, statusCode = 404) {
  if (!model) {
    const err = new Error(`Cannot find ${modelClass.name} model with id ${id}`)
    err.statusCode = statusCode
    throw err
  }
  return model
}

const restHandlers = {
  collection: {
    // post collection
    post(modelClass, ctx) {
      // TODO: Support multiples?, name it generatePostAll()?
      return objection.transaction(modelClass, modelClass => {
        return modelClass
          .query()
          .allowEager(this.getFindQuery(modelClass).allowEager())
          .eager(ctx.query.eager)
          .insert(ctx.body)
          .then(model => model.$query().first())
      })
    },

    // get collection
    get(modelClass, ctx) {
      return this.getFindQuery(modelClass).build(ctx.query, modelClass.query())
    },

    // patch collection
    patch(modelClass, ctx) {
      return this.getFindQuery(modelClass)
        .build(ctx.query, modelClass.query())
        .patch(ctx.body)
        .then(total => ({total}))
    },

    // delete collection
    delete(modelClass, ctx) {
      return this.getFindQuery(modelClass)
        .build(ctx.query, modelClass.query())
        .delete()
        .then(total => ({total}))
    }
  },

  member: {
    // get collection
    get(modelClass, ctx) {
      const {id} = ctx.params
      const builder = modelClass.query()
      return builder
        .allowEager(this.getFindQuery(modelClass).allowEager())
        .eager(ctx.query.eager)
        .where(builder.fullIdColumnFor(modelClass), id)
        .first()
        .then(model => checkModel(model, modelClass, id))
    },

    // put collection
    put(modelClass, ctx) {
      const {id} = ctx.params
      const builder = modelClass.query()
      return builder
        .update(ctx.body)
        .where(builder.fullIdColumnFor(modelClass), id)
        .then(model => {
          return modelClass
            .query()
            .allowEager(this.getFindQuery(modelClass).allowEager())
            .eager(ctx.query.eager)
            .where(builder.fullIdColumnFor(modelClass), id)
            .first()
        })
        .then(model => checkModel(model, modelClass, id))
    },

    // patch collection
    patch(modelClass, ctx) {
      const {id} = ctx.params
      const builder = modelClass.query()
      return builder
        .patch(ctx.body)
        .where(builder.fullIdColumnFor(modelClass), id)
        .then(() => {
          return modelClass
            .query()
            .allowEager(this.getFindQuery(modelClass).allowEager())
            .eager(ctx.query.eager)
            .where(builder.fullIdColumnFor(modelClass), id)
            .first()
        })
        .then(model => checkModel(model, modelClass, id))
    },

    // delete collection
    delete(modelClass, ctx) {
      const {id} = ctx.params
      return objection.transaction(modelClass, modelClass => {
        const builder = modelClass.query()
        return builder
          .delete()
          .where(builder.fullIdColumnFor(modelClass), id)
      }).then(() => ({})) // TODO: What does LB do here?
    }
  },

  relation: {
    // post relation
    post(relation, ctx) {
      const {id} = ctx.params
      const {ownerModelClass} = relation
      return objection.transaction(ownerModelClass, ownerModelClass => {
        const builder = ownerModelClass.query()
        return builder
          .where(builder.fullIdColumnFor(ownerModelClass), id)
          .first()
          .then(model => checkModel(model, ownerModelClass, id)
            .$relatedQuery(relation.name)
            .insert(ctx.body))
          .then(model => model
            .$query()
            .first()
            .allowEager(
              this.getFindQuery(relation.relatedModelClass).allowEager())
            .eager(ctx.query.eager))
      })
    },

    // get relation
    get(relation, ctx) {
      const {id} = ctx.params
      const {ownerModelClass} = relation
      const builder = ownerModelClass.query()
      return builder
        .where(builder.fullIdColumnFor(ownerModelClass), id)
        .first()
        .then(model => {
          checkModel(model, ownerModelClass, id)
          const query = this.getFindQuery(relation.relatedModelClass)
            .build(ctx.query, model.$relatedQuery(relation.name))
          return relation instanceof objection.BelongsToOneRelation
            ? query.first()
            : query
        })
    },

    // delete relation
    delete(relation, ctx) {
      const {id} = ctx.params
      const {ownerModelClass} = relation
      return objection.transaction(ownerModelClass, ownerModelClass => {
        const builder = ownerModelClass.query()
        return builder
          .where(builder.fullIdColumnFor(ownerModelClass), id)
          .first()
          .then(model => checkModel(model, ownerModelClass, id)
            .$relatedQuery(relation.name)
            .delete())
          .then(() => ({})) // TODO: What does LB do here?
      })
    },

    // put relation
    put: {
      isValid(relation) {
        return relation instanceof objection.BelongsToOneRelation
      },
      handler(relation, ctx) {
        const {id} = ctx.params
        const {ownerModelClass, relatedModelClass} = relation
        let model
        return objection.transaction(ownerModelClass, relatedModelClass,
          (ownerModelClass, relatedModelClass) => {
            const builder = ownerModelClass.query()
            return builder
              .where(builder.fullIdColumnFor(ownerModelClass), id)
              .first()
              .eager(relation.name)
              .then(mod => {
                model = checkModel(mod, ownerModelClass, id)
                const current = model[relation.name]
                const idKey = relatedModelClass.getIdProperty()
                const currentById = keyItemsBy(current, idKey)
                const inputModels = relatedModelClass.ensureModelArray(ctx.body)
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
                  .whereIn(builder.fullIdColumnFor(relatedModelClass),
                    deleteModels.map(model => model.$id()))
                  .then(() => Promise.all(insertAndUpdateQueries))
              })
              .then(() => model.$relatedQuery(relation.name))
          }
        )
      }
    }
  },

  relatedMember: {
    // TODO: HasManyRelation, BelongsToOneRelation, HasOneThroughRelation,
    // ManyToManyRelation?

    // post relatedMember = "generateRelationRelate" ??
    post: {
      isValid(relation) {
        return relation instanceof objection.ManyToManyRelation
      },
      handler(relation, ctx) {
        const {id, relatedId, eager} = ctx.params
        const {ownerModelClass, relatedModelClass} = relation
        return objection.transaction(ownerModelClass, relatedModelClass,
          (ownerModelClass, relatedModelClass) => {
            const builder = ownerModelClass.query()
            return builder
              .where(builder.fullIdColumnFor(ownerModelClass), id)
              .first()
              .then(model => {
                return checkModel(model, ownerModelClass, id)
                  .$relatedQuery(relation.name)
                  .relate(relatedId)
              })
              .then(() => {
                return relatedModelClass
                  .where(builder.fullIdColumnFor(relation.relatedModelClass),
                    relatedId)
                  .allowEager(
                    this.getFindQuery(relation.relatedModelClass).allowEager())
                  // TODO: Shouldn't this be ctx.query.eager?
                  .eager(ctx.params.eager)
                  .first()
              })
          }
        )
      }
    }
  }
}
