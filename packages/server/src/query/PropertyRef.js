import { QueryError } from '@/errors'
import { capitalize } from '@ditojs/utils'

// TODO:
// Make this work with objection.ref():
// https://github.com/Vincit/objection.js/blob/master/doc/includes/API.md#global-query-building-helpers
// So that query references can works with JSON attributes as well. See if this
// also works with eager query data, nested relationships, etc?
// TODO: semi-colon is currently used for operators. Use a different string
// to mark operators instead, e.g. 'jsonColumn:details.name::like=%bla%'
// TODO: Implement proper OR queries through where objects rather than the
// current '|' approach that only works with one operator for multiple fields.
// See: https://flask-restless.readthedocs.io/en/stable/searchformat.html
export default class PropertyRef {
  constructor(str, modelClass, parseDir, allowed) {
    if (parseDir) {
      // Support direction for order statements
      const [key, dir] = str.trim().split(/\s+/)
      if (dir && !/^(asc|desc)$/i.test(dir)) {
        throw new QueryError(`Invalid order direction: '${dir}'.`)
      }
      this.key = key
      this.dir = dir
    } else {
      this.key = str.trim()
    }
    if (allowed && !allowed[this.key]) {
      throw new QueryError(
        `Property reference '${this.key}' not allowed.`)
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
        throw new QueryError(
          `Unknown relation '${relationName}'.`)
      }
      this.propertyName = parts[1]
      this.modelClass = this.relation.relatedModelClass
    } else {
      throw new QueryError(
        `Only one level of relations is supported.`)
    }
    const { properties } = this.modelClass.getJsonSchema() || {}
    if (properties && !(this.propertyName in properties)) {
      throw new QueryError(`Unknown property '${this.key}'.`)
    }
    this.columnName = this.modelClass.propertyNameToColumnName(
      this.propertyName)
  }

  fullColumnName(builder) {
    // Use the full name for the relation identifiers, to always be unambiguous.
    const ref = this.relation
      ? this.relation.name
      : builder.tableRefFor(this.modelClass)
    return `${ref}.${this.columnName}`
  }

  applyQueryFilter(builder, query, queryFilter, value, boolOp) {
    const { method, args } = queryFilter(builder, this, value, this.modelClass)
    const whereMethod = boolOp ? `${boolOp}${capitalize(method)}` : method
    const { relation } = this
    // TODO: Figure out if all relations work, since we're using full relation
    // ids for relations (see fullColumnName())
    if (relation && !relation.isOneToOne()) {
      const subQuery = relation.findQuery(
        relation.relatedModelClass.query(), {
          ownerIds: relation.ownerProp.refs(builder)
        }
      )
      subQuery[whereMethod](...args)
      query.whereExists(subQuery)
    } else {
      query[whereMethod](...args)
    }
  }
}
