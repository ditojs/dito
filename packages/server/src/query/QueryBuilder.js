import objection from 'objection'
import { KnexHelper } from '@/lib'
import { QueryBuilderError, RelationError } from '@/errors'
import { QueryHandlers } from './QueryHandlers'
import { QueryFilters } from './QueryFilters'
import PropertyRef from './PropertyRef'
import GraphProcessor from './GraphProcessor'
import { isArray, isPlainObject, isString, clone } from '@ditojs/utils'

// This code is based on objection-find, and simplified.
// Instead of a separate class, we extend objection.QueryBuilder to better
// integrate with Objection.js

export class QueryBuilder extends objection.QueryBuilder {
  constructor(modelClass) {
    super(modelClass)
    this._propertyRefsAllowed = null
    this._propertyRefsCache = {}
    this._eagerScopeId = 0
    this.clearScope(true)
  }

  clone() {
    const copy = super.clone()
    copy._propertyRefsAllowed = this._propertyRefsAllowed
    copy._propertyRefsCache = this._propertyRefsCache
    copy._scopes = clone(this._scopes)
    return copy
  }

  async execute() {
    for (const { scope, eager } of this._scopes) {
      this.applyScope(scope, eager)
    }
    // If this isn't a find query, meaning if it defines any write operations or
    // special selects, then eager and order needs to be cleared. This is to not
    // mess with special selects such as count(), etc...
    if (!this.isFind() || this.hasSelects() && !this.has('select')) {
      this.clearEager()
      this.clear('orderBy')
    }

    return super.execute()
  }

  childQueryOf(query, fork) {
    if (fork) {
      this.clearScope()
    }
    return super.childQueryOf(query, fork)
  }

  applyScope(scope, eager = false) {
    if (eager) {
      const modelClass = this.modelClass()
      if (modelClass.hasScope(scope)) {
        this.applyFilter(scope)
      }
      if (this._eagerExpression) {
        const name = `_eagerScope${++this._eagerScopeId}_`
        const filters = {
          ...this._eagerFilters,
          [name]: query => query.applyScope(scope, true)
        }
        this.eager(
          addEagerScope(
            this.modelClass(),
            this._eagerExpression,
            [scope, name],
            filters
          ),
          filters
        )
      }
    } else {
      this.applyFilter(scope)
    }
    return this
  }

  clearScope(addDefault = false) {
    this._scopes = addDefault
      ? [{
        scope: 'default',
        eager: true
      }]
      : []
    return this
  }

  scope(...scopes) {
    return this.clearScope(true).mergeScope(...scopes)
  }

  mergeScope(...scopes) {
    return this._mergeScopes(scopes, false)
  }

  eagerScope(...scopes) {
    return this.clearScope(true).mergeEagerScope(...scopes)
  }

  mergeEagerScope(...scopes) {
    return this._mergeScopes(scopes, true)
  }

  _mergeScopes(scopes, eager) {
    for (const scope of scopes) {
      const entry = this._scopes.find(entry => entry.scope === scope)
      if (entry) {
        entry.eager = entry.eager || eager
      } else {
        this._scopes.push({ scope, eager })
      }
    }
    return this
  }

  break() {
    return null
  }

  raw(...args) {
    return this.knex().raw(...args)
  }

  async truncate() {
    if (this.isPostgreSQL()) {
      // Include `cascade` in PostgreSQL truncate queries.
      return this.raw('truncate table ?? restart identity cascade',
        this.modelClass().tableName)
    }
    return super.truncate()
  }

  insert(data, returning) {
    // Only PostgreSQL is able to insert multiple entries at once it seems,
    // all others have to fall back on insertGraph() to do so for now:
    return !this.isPostgreSQL() && isArray(data) && data.length > 1
      ? this.insertGraph(data)
      : super.insert(data, returning)
  }

  // https://github.com/Vincit/objection.js/issues/101#issuecomment-200363667
  upsert(data, options = {}) {
    let mainQuery
    return this
      .runBefore((result, builder) => {
        if (!builder.context().isMainQuery) {
          // At this point the builder should only contain a bunch of `where*`
          // operations. Store this query for later use in runAfter(). Also mark
          // the query with `isMainQuery: true` so we can skip all this when
          // this function is called for the `mainQuery`.
          mainQuery = builder.clone().context({ isMainQuery: true })
          // Call update() on the original query, turning it into an update.
          builder[options.update ? 'update' : 'patch'](data)
        }
        return result
      })
      .runAfter((result, builder) => {
        if (!builder.context().isMainQuery) {
          return result === 0
            ? mainQuery[options.fetch ? 'insertAndFetch' : 'insert'](data)
            // We can use the `mainQuery` we saved in runBefore() to fetch the
            // inserted results. It is noteworthy that this query will return
            // the wrong results if the update changed any of the columns the
            // where operates with. This also returns all updated models.
            : mainQuery.first()
        }
        return result
      })
  }

  upsertAndFetch(data, options) {
    return this.upsert(data, { ...options, fetch: true })
  }

  _handleGraph(method, data, defaults, options, restoreRelations) {
    const graph = new GraphProcessor(this.modelClass(), data, restoreRelations,
      mergeOptions(defaults, options))
    const builder = super[method](graph.getData(), graph.getOptions())
    if (restoreRelations) {
      builder.runAfter(result => graph.restoreRelations(result))
    }
    return builder
  }

  insertGraph(data, options) {
    return this._handleGraph('insertGraph',
      data, insertGraphOptions, options, true)
  }

  insertGraphAndFetch(data, options) {
    return this._handleGraph('insertGraphAndFetch',
      data, insertGraphOptions, options, true)
  }

  upsertGraph(data, options) {
    return this._handleGraph('upsertGraph',
      data, upsertGraphOptions, options, false)
  }

  upsertGraphAndFetch(data, options) {
    return this._handleGraph('upsertGraphAndFetch',
      data, upsertGraphOptions, options, false)
  }

  updateGraph(data, options) {
    return this._handleGraph('upsertGraph',
      data, updateGraphOptions, options, false)
  }

  updateGraphAndFetch(data, options) {
    return this._handleGraph('upsertGraphAndFetch',
      data, updateGraphOptions, options, false)
  }

  patchGraph(data, options) {
    return this._handleGraph('upsertGraph',
      data, patchGraphOptions, options, false)
  }

  patchGraphAndFetch(data, options) {
    return this._handleGraph('upsertGraphAndFetch',
      data, patchGraphOptions, options, false)
  }

  upsertGraphAndFetchById(id, data, options) {
    this.context({ byId: id })
    return this.upsertGraphAndFetch(
      this.modelClass().getIdValues(id, { ...data }), options)
  }

  updateGraphAndFetchById(id, data, options) {
    this.context({ byId: id })
    return this.updateGraphAndFetch(
      this.modelClass().getIdValues(id, { ...data }), options)
  }

  patchGraphAndFetchById(id, data, options) {
    this.context({ byId: id })
    return this.patchGraphAndFetch(
      this.modelClass().getIdValues(id, { ...data }), options)
  }

  updateAndFetchById(id, data) {
    this.context({ byId: id })
    return super.updateAndFetchById(id, data)
  }

  patchAndFetchById(id, data) {
    this.context({ byId: id })
    return super.patchAndFetchById(id, data)
  }

  deleteById(id) {
    this.context({ byId: id })
    return super.deleteById(id)
  }

  findById(id, query, allowed) {
    // Remember id so Model.createNotFoundError() can report it:
    this.context({ byId: id })
    // Add support for optional query to findById()
    super.findById(id)
    return query ? this.findOne(query, allowed) : this
  }

  find(query = {}, allowed) {
    this._relationsToJoin = {}
    // Convert allowed array to object lookup for quicker access.
    const allowedLookup = allowed?.reduce((lookup, name) => {
      lookup[name] = true
      return lookup
    }, {})
    for (const [key, value] of Object.entries(query)) {
      const inAllowed = allowedLookup?.[key]
      if (!allowed || inAllowed) {
        const queryHandler = QueryHandlers.get(key)
        if (queryHandler) {
          queryHandler(this, key, value)
        } else if (!inAllowed) {
          // Only complain if the key isn't explicitly listed in allowed even
          // if we don't recognize it here, so RrestGenerator can add the
          // remote method arguments to the allowed list and let them pass.
          throw new QueryBuilderError(
            `Invalid query parameter '${key}' in '${key}=${value}'.`)
        }
      } else {
        throw new QueryBuilderError(`Query parameter '${key}' is not allowed.`)
      }
    }
    // TODO: Is this really needed? Looks like it works without it also...
    for (const relation of Object.values(this._relationsToJoin)) {
      relation.join(this, { joinOperation: 'leftJoin' })
    }
    return this
  }

  findOne(query, allowed) {
    // TODO: This clashes with and overrides objection's own definition of
    // findOne(), decide if that's ok?
    // Only allow the following query filters on single queries:
    const allowedQueries = { where: 1, eager: 1, omit: 1, pick: 1, scope: 1 }
    allowed = allowed
      ? allowed.filter(str => allowedQueries[str])
      : Object.keys(allowedQueries)
    return this.find(query, allowed).first()
  }

  allowProperties(refs) {
    // TODO: Use a more explicit name for this in the context of QueryBuilder,
    // or decide to remove all together.
    if (refs) {
      this._propertyRefsAllowed = this._propertyRefsAllowed || {}
      for (const { key } of this.getPropertyRefs(refs, { checkAllow: false })) {
        this._propertyRefsAllowed[key] = true
      }
    } else {
      this._propertyRefsAllowed = null
    }
    return this
  }

  getPropertyRefs(refs, { parseDir = false, checkAllowed = true } = {}) {
    refs = isString(refs) ? refs.split(/\s*\|\s*/) : refs
    const cache = this._propertyRefsCache
    // Pass on _propertyRefsAllowed to make sure there are only allowed
    // properties in the query parameters.
    return refs.map(ref => cache[ref] ||
      (cache[ref] = new PropertyRef(ref, this.modelClass(), parseDir,
        checkAllowed && this._propertyRefsAllowed)))
  }

  parseQueryFilter(key, value) {
    const parts = key.split(/\s*:\s*/)
    const filterName = parts.length === 1
      ? value === null
        ? 'null'
        : 'eq'
      : parts.length === 2
        ? parts[1]
        : null
    const queryFilter = filterName && QueryFilters.get(filterName)
    if (!queryFilter) {
      throw new QueryBuilderError(`Invalid filter in '${key}=${value}'.`)
    }
    const propertyRefs = this.getPropertyRefs(parts[0])
    for (const ref of propertyRefs) {
      const { relation } = ref
      if (relation?.isOneToOne()) {
        this._relationsToJoin[relation.name] = relation
      }
    }
    if (propertyRefs.length === 1) {
      propertyRefs[0].applyQueryFilter(this, this, queryFilter, value)
    } else {
      // If there are multiple property refs, they are combined with an `OR`
      // operator.
      this.where(builder => {
        for (const ref of propertyRefs) {
          ref.applyQueryFilter(this, builder, queryFilter, value, 'or')
        }
      })
    }
  }

  static mixin(target) {
    // Expose a selection of QueryBuilder methods directly on the target,
    // redirecting the calls to `this.query()[method](...)`
    for (const method of mixinMethods) {
      if (method in target) {
        console.warn(
          `There is already a property named '${method}' on '${target}'`)
      } else {
        Object.defineProperty(target, method, {
          value(...args) {
            return this.query()[method](...args)
          },
          configurable: true,
          enumerable: false
        })
      }
    }
  }
}

KnexHelper.mixin(QueryBuilder.prototype)

// Add conversion of identifiers to all `where` statements, as well as to
// `select` and `orderBy`, by detecting use of model properties and expanding
// them to `${tableRefFor(modelClass}.${propertyName}`, for unambiguous
// identification of used properties in complex statements.
for (const key of [
  'where', 'andWhere', 'orWhere',
  'whereNot', 'orWhereNot',
  'whereIn', 'orWhereIn',
  'whereNotIn', 'orWhereNotIn',
  'whereNull', 'orWhereNull',
  'whereNotNull', 'orWhereNotNull',
  'whereBetween', 'andWhereBetween', 'orWhereBetween',
  'whereNotBetween', 'andWhereNotBetween', 'orWhereNotBetween',

  'having', 'orHaving',
  'havingIn', 'orHavingIn',
  'havingNotIn', 'orHavingNotIn',
  'havingNull', 'orHavingNull',
  'havingNotNull', 'orHavingNotNull',
  'havingBetween', 'orHavingBetween',
  'havingNotBetween', 'orHavingNotBetween',

  'select', 'first', 'pluck',

  'groupBy', 'orderBy'
]) {
  const method = QueryBuilder.prototype[key]
  QueryBuilder.prototype[key] = function (...args) {
    const modelClass = this.modelClass()
    const { properties } = modelClass.definition

    // Expands all identifiers known to the model to their extended versions.
    const convertIdentifier = identifier => identifier in properties
      ? `${this.tableRefFor(modelClass)}.${identifier}`
      : identifier

    const convertArgument = arg => {
      if (isString(arg)) {
        arg = convertIdentifier(arg)
      } else if (isArray(arg)) {
        arg = arg.map(value => convertIdentifier(value))
      } else if (isPlainObject(arg)) {
        const converted = {}
        for (const key in arg) {
          converted[convertIdentifier(key)] = arg[key]
        }
        arg = converted
      }
      return arg
    }

    const length = ['select', 'first'].includes(key) ? args.length : 1
    for (let i = 0; i < length; i++) {
      args[i] = convertArgument(args[i])
    }
    return method.call(this, ...args)
  }
}

// Change the defaults of insertGraph, upsertGraph, updateGraph and patchGraph
const insertGraphOptions = {
  relate: true
}

const upsertGraphOptions = {
  relate: true,
  unrelate: true,
  insertMissing: true
}

const patchGraphOptions = {
  relate: true,
  unrelate: true,
  insertMissing: false
}

const updateGraphOptions = {
  relate: true,
  unrelate: true,
  update: true,
  insertMissing: false
}

function mergeOptions(defaults, options) {
  return options ? { ...defaults, ...options } : defaults
}

function addEagerScope(modelClass, expr, scopes, filters, isRoot = true) {
  if (isRoot) {
    expr = expr?.isObjectionRelationExpression
      ? expr.clone()
      : objection.RelationExpression.create(expr)
  } else {
    // Only add the scope if it's not already defined by the eager statement and
    // if it's actually available as a filter in the model's namedFilters list.
    for (const scope of scopes) {
      if (!expr.args.includes(scope) &&
          (modelClass.namedFilters[scope] || filters?.[scope])) {
        expr.args.push(scope)
      }
    }
  }
  if (expr.numChildren > 0) {
    const relations = modelClass.getRelations()
    for (const child of Object.values(expr.children)) {
      const relation = relations[child.name]
      if (!relation) {
        throw new RelationError(
          `Invalid child expression: '${child.name}'`)
      }
      addEagerScope(relation.relatedModelClass, child, scopes, filters, false)
    }
  }
  return expr
}

const mixinMethods = [
  'first',
  'find',
  'findOne',
  'findById',
  'eager',
  'scope',
  'pick',
  'omit',
  'applyScope',
  'clearEager',
  'clearScope',
  'select',
  'insert',
  'upsert',
  'update',
  'relate',
  'patch',
  'truncate',
  'delete',
  'deleteById',
  'insertAndFetch',
  'upsertAndFetch',
  'updateAndFetch',
  'patchAndFetch',
  'updateAndFetchById',
  'patchAndFetchById',
  'insertGraph',
  'upsertGraph',
  'updateGraph',
  'patchGraph',
  'insertGraphAndFetch',
  'upsertGraphAndFetch',
  'updateGraphAndFetch',
  'patchGraphAndFetch',
  'upsertGraphAndFetchById',
  'updateGraphAndFetchById',
  'patchGraphAndFetchById',
  'where',
  'whereNot',
  'whereRaw',
  'whereWrapped',
  'whereExists',
  'whereNotExists',
  'whereIn',
  'whereNotIn',
  'whereNull',
  'whereNotNull',
  'whereBetween',
  'whereNotBetween',
  'whereJsonSupersetOf',
  'whereJsonNotSupersetOf',
  'whereJsonSubsetOf',
  'whereJsonNotSubsetOf',
  'whereJsonHasAny',
  'whereJsonHasAll',
  'whereJsonIsArray',
  'whereJsonIsObject',
  'having',
  'havingIn',
  'havingNotIn',
  'havingNull',
  'havingNotNull',
  'havingExists',
  'havingNotExists',
  'havingBetween',
  'havingNotBetween',
  'havingRaw'
]
