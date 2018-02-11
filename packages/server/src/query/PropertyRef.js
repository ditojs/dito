import { QueryBuilderError } from '@/errors'

// TODO: Make this work with objection.ref():
// http://vincit.github.io/objection.js/#ref
// So that query references can works with JSON attributes as well. See if this
// also works with eager query data, nested relationships, etc?
// TODO: semi-colon is currently used for operators. Use a different string
// to mark operators instead, e.g. 'jsonColumn:details.name::like=%bla%'
// TODO: Implement proper OR queries through where objects rather than the
// current '|' approach that only works with one operator for multiple fields.
// See: https://flask-restless.readthedocs.io/en/stable/searchformat.html
export default class PropertyRef {
  constructor(str, modelClass, parseDirection, allowed) {
    if (parseDirection) {
      // Support direction for order statements
      const [key, direction] = str.trim().split(/\s+/)
      if (direction && !['asc', 'desc'].includes(direction)) {
        throw new QueryBuilderError(`Invalid order direction: '${direction}'.`)
      }
      this.key = key
      this.direction = direction
    } else {
      this.key = str.trim()
    }
    if (allowed && !allowed[this.key]) {
      throw new QueryBuilderError(`Property '${this.key}' not allowed.`)
    }
    const parts = this.key.split('.')
    if (parts.length === 1) {
      this.relation = null
      this.propertyName = parts[0]
      this.modelClass = modelClass
    } else if (parts.length === 2) {
      const relationName = parts[0]
      try {
        this.relation = modelClass.getRelation(relationName)
      } catch (err) {
        throw new QueryBuilderError(`Unknown relation '${relationName}'.`)
      }
      this.propertyName = parts[1]
      this.modelClass = this.relation.relatedModelClass
    } else {
      throw new QueryBuilderError(`Only one level of relations is supported.`)
    }
    const { properties } = this.modelClass.getJsonSchema() || {}
    if (properties && !(this.propertyName in properties)) {
      throw new QueryBuilderError(`Unknown property '${this.key}'.`)
    }
    this.columnName = this.modelClass.propertyNameToColumnName(
      this.propertyName)
  }

  getFullColumnName(builder) {
    // Use the full name for the relation identifiers, to always be unambiguous.
    const ref = this.relation
      ? this.relation.name
      : builder.tableRefFor(this.modelClass)
    return `${ref}.${this.columnName}`
  }

  applyQueryFilter(builder, query, queryFilter, where, value) {
    const { method, args } = queryFilter(builder, where, this, value)
    const { relation } = this
    // TODO: Figure out if all relations work, since we're using full relation
    // ids for relations (see getFullColumnName())
    if (relation && !relation.isOneToOne()) {
      const subQuery = relation.findQuery(
        relation.relatedModelClass.query(), {
          ownerIds: relation.ownerProp.refs(builder)
        }
      )
      subQuery[method](...args)
      query.whereExists(subQuery)
    } else {
      query[method](...args)
    }
  }
}
