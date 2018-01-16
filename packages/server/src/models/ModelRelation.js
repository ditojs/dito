import { QueryBuilder } from '@/query'

export default class ModelRelation {
  constructor(model, relation) {
    this.model = model
    this.relation = relation
    this.name = relation.name
  }

  query() {
    return this.model.$relatedQuery(this.name)
  }

  load() {
    return this.model.$loadRelated(this.name)
  }
}

// Expose a selection of QueryBuilder methods as instance methods on relations.
QueryBuilder.mixin(ModelRelation.prototype)
