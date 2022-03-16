import { QueryBuilder } from '../query/index.js'

export default class RelationAccessor {
  constructor(relation, modelClass, model) {
    this.relation = relation
    this.name = relation.name
    this.modelClass = modelClass
    this.model = model
  }

  query(trx) {
    return this.modelClass
      ? this.modelClass.relatedQuery(this.name, trx)
      : this.model.$relatedQuery(this.name, trx)
  }

  load(arg0, ...args) {
    return this.modelClass
      ? this.modelClass.loadRelated(arg0, this.name, ...args)
      : this.model.$loadRelated(this.name, arg0, ...args)
  }

  /**
   * Accessor to provide simplified access to the implicitly generated join
   * model class, handling the passing on of  the knex instance, as well as
   * the application of `QueryBuilder.mixin()`.
   */
  get joinModelClass() {
    const { joinModelClass } = this.relation
    // Result is already cached per knex by `this.relation.joinModelClass()`,
    // so all that's left to do is apply `QueryBuilder.mixin()`,
    // if there is no `joinModelClass.where()` yet:
    if (joinModelClass && !('where' in joinModelClass)) {
      QueryBuilder.mixin(joinModelClass)
    }
    return joinModelClass
  }
}

// Expose a selection of QueryBuilder methods as instance methods on relations.
QueryBuilder.mixin(RelationAccessor.prototype)
