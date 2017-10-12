import objection from 'objection'
import colors from 'colors/safe'
import findQuery from 'objection-find'
import pluralize from 'pluralize'
import {hyphenate, isObject, keyItemsBy} from '../utils'

export default class ApiGenerator {
  constructor({adapter, prefix, logger} = {}) {
    const noop = () => {}
    this.adapter = adapter || noop
    this.logger = logger || noop
    this.prefix = /\/$/.test(prefix) ? prefix : `${prefix}/`
    this.models = Object.create(null)
    this.findQueries = Object.create(null)
  }

  getFindQuery(modelClass) {
    const {name} = modelClass
    let query = this.findQueries[name]
    if (!query) {
      query = this.findQueries[name] = findQuery(modelClass)
    }
    return query
  }

  addModel(modelClass, { access = {} } = {}) {
    this.logger(`${colors.green(modelClass.name)}${colors.white(':')}`)
    this.generateRoutes(modelClass, 'collection', access.collection, 1)
    this.generateRoutes(modelClass, 'member', access.member, 1)
    for (const relation of Object.values(modelClass.getRelations())) {
      this.logger(`  ${colors.blue(relation.name)}${colors.white(':')}`)
      this.generateRoutes(relation, 'relation', access.relation, 2)
      this.generateRoutes(relation, 'relatedMember', access.relatedMember, 2)
    }
  }

  generateRoutes(target, type, getAccess = () => true, indent) {
    const handlers = restHandlers[type]
    for (let [verb, handler] of Object.entries(handlers)) {
      // Freeze access object so we can pass the same one but no middleware
      // can alter it and affect future requests.
      const access = Object.freeze(getAccess(verb, target))
      if (!access) {
        continue
      }
      if (isObject(handler)) {
        if (handler.isValid && !handler.isValid(target)) {
          continue
        }
        handler = handler.handler
      }
      const route = `${this.prefix}${routes[type](target)}`
      this.adapter({verb, route, access},
        ctx => handler.call(this, target, ctx))
      const space = '  '.repeat(indent || 0)
      this.logger(
        `${space}${colors.magenta(verb.toUpperCase())} ${colors.white(route)}`)
    }
  }
}

const routes = {
  collection(modelClass) {
    return hyphenate(pluralize(modelClass.name))
  },
  member(modelClass) {
    return `${routes.collection(modelClass)}/:id`
  },
  relation(relation) {
    return `${routes.member(relation.ownerModelClass)}/${relation.name}`
  },
  relatedMember(relation) {
    return `${routes.relation(relation)}/:relatedId`
  }
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
      const builder = modelClass.query()
      return builder
        .allowEager(this.getFindQuery(modelClass).allowEager())
        .eager(ctx.query.eager)
        .where(builder.fullIdColumnFor(modelClass), ctx.params.id)
        .first()
        .then(model => checkModel(model))
    },

    // put collection
    put(modelClass, ctx) {
      const builder = modelClass.query()
      return builder
        .update(ctx.body)
        .where(builder.fullIdColumnFor(modelClass), ctx.params.id)
        .then(model => {
          return modelClass
            .query()
            .allowEager(this.getFindQuery(modelClass).allowEager())
            .eager(ctx.query.eager)
            .where(builder.fullIdColumnFor(modelClass), ctx.params.id)
            .first()
        })
        .then(model => checkModel(model))
    },

    // patch collection
    patch(modelClass, ctx) {
      const builder = modelClass.query()
      return builder
        .patch(ctx.body)
        .where(builder.fullIdColumnFor(modelClass), ctx.params.id)
        .then(() => {
          return modelClass
            .query()
            .allowEager(this.getFindQuery(modelClass).allowEager())
            .eager(ctx.query.eager)
            .where(builder.fullIdColumnFor(modelClass), ctx.params.id)
            .first()
        })
        .then(model => checkModel(model))
    },

    // delete collection
    delete(modelClass, ctx) {
      return objection.transaction(modelClass, modelClass => {
        const builder = modelClass.query()
        return builder
          .delete()
          .where(builder.fullIdColumnFor(modelClass), ctx.params.id)
      }).then(() => ({})) // TODO: What does LB do here?
    }
  },

  relation: {
    // post relation
    post(relation, ctx) {
      const {ownerModelClass} = relation
      return objection.transaction(ownerModelClass, ownerModelClass => {
        const builder = ownerModelClass.query()
        return builder
          .where(builder.fullIdColumnFor(ownerModelClass), ctx.params.id)
          .first()
          .then(model => checkModel(model)
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
      const {ownerModelClass} = relation
      const builder = ownerModelClass.query()
      return builder
        .where(builder.fullIdColumnFor(ownerModelClass), ctx.params.id)
        .first()
        .then(model => {
          const query = this.getFindQuery(relation.relatedModelClass)
            .build(ctx.query, checkModel(model).$relatedQuery(relation.name))
          return relation instanceof objection.BelongsToOneRelation
            ? query.first()
            : query
        })
    },

    // delete relation
    delete(relation, ctx) {
      const {ownerModelClass} = relation
      return objection.transaction(ownerModelClass, ownerModelClass => {
        const builder = ownerModelClass.query()
        return builder
          .where(builder.fullIdColumnFor(ownerModelClass), ctx.params.id)
          .first()
          .then(model => checkModel(model)
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
        const {ownerModelClass, relatedModelClass} = relation
        let model
        return objection.transaction(ownerModelClass, relatedModelClass,
          (ownerModelClass, relatedModelClass) => {
            const builder = ownerModelClass.query()
            return builder
              .where(builder.fullIdColumnFor(ownerModelClass), ctx.params.id)
              .first()
              .eager(relation.name)
              .then(mod => {
                model = checkModel(mod)
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
        const {ownerModelClass, relatedModelClass} = relation
        return objection.transaction(ownerModelClass, relatedModelClass,
          (ownerModelClass, relatedModelClass) => {
            const builder = ownerModelClass.query()
            return builder
              .where(builder.fullIdColumnFor(ownerModelClass), ctx.params.id)
              .first()
              .then(model => {
                return checkModel(model)
                  .$relatedQuery(relation.name)
                  .relate(ctx.params.relatedId)
              })
              .then(() => {
                return relatedModelClass
                  .where(builder.fullIdColumnFor(relation.relatedModelClass),
                    ctx.params.relatedId)
                  .allowEager(
                    this.getFindQuery(relation.relatedModelClass).allowEager())
                  .eager(ctx.params.eager)
                  .first()
              })
          }
        )
      }
    }
  }
}

function checkModel(model, statusCode = 404) {
  if (!model) {
    const err = new Error()
    err.statusCode = statusCode
    throw err
  }
  return model
}
