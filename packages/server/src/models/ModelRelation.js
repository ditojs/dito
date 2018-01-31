import { QueryBuilder } from '@/query'

export default class ModelRelation {
  constructor(modelClass, model, relation) {
    this.modelClass = modelClass
    this.model = model
    this.relation = relation
    this.name = relation.name
  }

  query(trx) {
    return this.modelClass
      ? this.modelClass.relatedQuery(this.name, trx)
      : this.model.$relatedQuery(this.name, trx)
  }

  load(...args) {
    return this.modelClass
      ? this.modelClass.loadRelated(args[0], this.name, ...args.slice(1))
      : this.model.$loadRelated(this.name, ...args)
  }

  get joinModelClass() {
    const joinModelClass = this.relation.joinModelClass(
      this.relation.relatedModelClass.knex())
    // Add QueryBuilder.mixin() if there is no joinModelClass.where() yet:
    if (!('where' in joinModelClass)) {
      QueryBuilder.mixin(joinModelClass)
    }
    return joinModelClass
  }
}

// Expose a selection of QueryBuilder methods as instance methods on relations.
QueryBuilder.mixin(ModelRelation.prototype)
