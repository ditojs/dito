import objection from 'objection'
import { KnexHelper } from '@/lib'
import { QueryBuilderError, RelationError } from '@/errors'
import { QueryParameters } from './QueryParameters'
import { QueryWhereFilters } from './QueryWhereFilters'
import PropertyRef from './PropertyRef'
import GraphProcessor from './GraphProcessor'
import { isPlainObject, isString, isArray, asArray, clone } from '@ditojs/utils'

// This code is based on objection-find, and simplified.
// Instead of a separate class, we extend objection.QueryBuilder to better
// integrate with Objection.js

export class QueryBuilder extends objection.QueryBuilder {
  constructor(modelClass) {
    super(modelClass)
    this._parent = null
    this._lastChild = null
    this._propertyRefsCache = {}
    this._eagerScopeId = 0
    this._allowScopes = null
    this._clearScopes(true)
  }

  // @override
  clone() {
    const copy = super.clone()
    copy._parent = this._parent
    copy._lastChild = this._lastChild
    copy._propertyRefsCache = this._propertyRefsCache
    copy._copyScopes(this)
    return copy
  }

  // @override
  execute() {
    // See if this query is the fetch-part of an *AndFetch() operation.
    // For more information, see childQueryOf().
    if (this._parent &&
        this._parent._lastChild === this &&
        this._parent.has(/AndFetch$/) &&
        // Check context().onBuild to filter out queries used in Objection's
        // UpsertGraph.fetchCurrentState(), which define their own onBuild().
        // TODO: The proper solution on the long run may be to write our own
        // versions of each *AndFetch() operation, unfortunately. But before
        // going down that route, see if Objection can't add a check for this,
        // e.g. QueryBuilder.isInternal(), returning true for all internal
        // queries, but false for the final fetch. We could also check for
        // `keepImplicitJoinProps` in `internalOptions()`, but that's private.
        this.context().onBuild === this._parent.context().onBuild) {
      // It's ok to just copy the parent's scopes for fetch queries,
      // since this child query cannot have any scopes of its own.
      this._copyScopes(this._parent)
    }
    for (const { scope, eager } of this._scopes) {
      this._applyScopes([scope], eager)
    }
    // If this isn't a find query, meaning if it defines any write operations or
    // special selects, then 'eager' and 'orderBy' operations need to be
    // cleared. This is to not mess with special selects such as count(), etc...
    if (!this.isFind() ||
        this.hasSelects() && !this.has(/^(select|column|columns)$/)) {
      this.clearEager()
      this.clear('orderBy')
    }

    return super.execute()
  }

  // @override
  childQueryOf(query, fork) {
    // Clear all scopes for child-queries, but remember the hierarchy and
    // sequence of queries so that in execute() we can identify the last query
    // of a *AndFetch() operation and copy the scopes from the parent.
    this._clearScopes(false)
    this._parent = query
    query._lastChild = this
    return super.childQueryOf(query, fork)
  }

  _clearScopes(addDefault) {
    this._scopes = addDefault
      ? [{
        scope: 'default',
        eager: true
      }]
      : []
    return this
  }

  _copyScopes(query) {
    this._scopes = clone(query._scopes)
    this._allowScopes = query._allowScopes
      ? { ...query._allowScopes }
      : null
    return this
  }

  _mergeScopes(scopes, eager) {
    for (const scope of scopes) {
      if (this._allowScopes && !this._allowScopes[scope]) {
        throw new QueryBuilderError(`Query scope '${scope}' is not allowed.`)
      }
      const entry = this._scopes.find(entry => entry.scope === scope)
      if (entry) {
        entry.eager = entry.eager || eager
      } else {
        this._scopes.push({ scope, eager })
      }
    }
    return this
  }

  _applyScopes(scopes, eager) {
    if (eager) {
      const modelClass = this.modelClass()
      for (const scope of scopes) {
        if (modelClass.hasScope(scope)) {
          this.applyFilter(scope)
        }
      }
      if (this._eagerExpression) {
        const name = `_eagerScope${++this._eagerScopeId}_`
        const filters = {
          [name]: query => query._applyScopes(scopes, eager)
        }
        this.eager(
          addEagerScope(
            this.modelClass(),
            this._eagerExpression,
            [name],
            filters
          ),
          {
            ...this._eagerFilters,
            ...filters
          }
        )
      }
    } else {
      this.applyFilter(...scopes)
    }
    return this
  }

  clearScope() {
    return this._clearScopes(false)
  }

  allowScope(...scopes) {
    this._allowScopes = this._allowScopes || {}
    for (const scope of scopes) {
      this._allowScopes[scope] = true
    }
  }

  scope(...scopes) {
    return this._clearScopes(true).mergeScope(...scopes)
  }

  mergeScope(...scopes) {
    return this._mergeScopes(scopes, false)
  }

  applyScope(...scopes) {
    return this._applyScopes(scopes, false)
  }

  eagerScope(...scopes) {
    return this._clearScopes(true).mergeEagerScope(...scopes)
  }

  mergeEagerScope(...scopes) {
    return this._mergeScopes(scopes, true)
  }

  applyEagerScope(...scopes) {
    return this._applyScopes(scopes, true)
  }

  raw(...args) {
    return this.knex().raw(...args)
  }

  selectRaw(...args) {
    return this.select(this.raw(...args))
  }

  // @override
  async truncate({ restart = true, cascade = false } = {}) {
    if (this.isPostgreSQL()) {
      // Support `restart` and `cascade` in PostgreSQL truncate queries.
      return this.raw(
        `truncate table ??${
          restart ? ' restart identity' : ''}${
          cascade ? ' cascade' : ''
        }`,
        this.modelClass().tableName
      )
    }
    return super.truncate()
  }

  // @override
  insert(data) {
    // Only PostgreSQL is able to insert multiple entries at once it seems,
    // all others have to fall back on insertGraph() to do so for now:
    return !this.isPostgreSQL() && isArray(data) && data.length > 1
      ? this.insertGraph(data)
      : super.insert(data)
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

  _handleGraph(method, data, defaultOptions, options = defaultOptions) {
    const graph = new GraphProcessor(this.modelClass(), data, options, {
      // Only process option overrides if the user doesn't override options:
      processOverrides: options === defaultOptions,
      restoreRelations: true
    })
    const builder = super[method](graph.getData(), graph.getOptions())
    return builder.runAfter(result => graph.restoreRelations(result))
  }

  // @override
  insertGraph(data, options) {
    return this._handleGraph('insertGraph',
      data, insertGraphOptions, options)
  }

  // @override
  insertGraphAndFetch(data, options) {
    return this._handleGraph('insertGraphAndFetch',
      data, insertGraphOptions, options)
  }

  // @override
  upsertGraph(data, options) {
    return this._handleGraph('upsertGraph',
      data, upsertGraphOptions, options)
  }

  // @override
  upsertGraphAndFetch(data, options) {
    return this._handleGraph('upsertGraphAndFetch',
      data, upsertGraphOptions, options)
  }

  updateGraph(data, options) {
    return this._handleGraph('upsertGraph',
      data, updateGraphOptions, options)
  }

  updateGraphAndFetch(data, options) {
    return this._handleGraph('upsertGraphAndFetch',
      data, updateGraphOptions, options)
  }

  patchGraph(data, options) {
    return this._handleGraph('upsertGraph',
      data, patchGraphOptions, options)
  }

  patchGraphAndFetch(data, options) {
    return this._handleGraph('upsertGraphAndFetch',
      data, patchGraphOptions, options)
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

  // @override
  updateAndFetchById(id, data) {
    this.context({ byId: id })
    return super.updateAndFetchById(id, data)
  }

  // @override
  patchAndFetchById(id, data) {
    this.context({ byId: id })
    return super.patchAndFetchById(id, data)
  }

  // @override
  deleteById(id) {
    this.context({ byId: id })
    return super.deleteById(id)
  }

  // @override
  findById(id, query, options) {
    // Remember id so Model.createNotFoundError() can report it:
    this.context({ byId: id })
    // Add support for optional query to findById()
    super.findById(id)
    return query ? this.findOne(query, options) : this
  }

  find(query, { allowParam, checkRootWhere = true } = {}) {
    // Use `true` as default for `checkRootWhere` on findOne() to emulate and
    // remain compatible with Objection's `findOne()`
    if (!query) return this
    const allowedParams = QueryParameters.getAllowed()
    const allowed = !allowParam
      ? allowedParams
      // Convert allow array to object lookup for quicker access.
      : asArray(allowParam).reduce((obj, name) => {
        obj[name] = true
        return obj
      }, {})
    if (checkRootWhere) {
      // If there are no known handlers in the query, use the whole query object
      // for the `where` handler to fall-back on Objection's format of findOne()
      const hasParams = !!Object.keys(query).find(key => allowedParams[key])
      if (!hasParams) {
        query = {
          where: query
        }
      }
    }
    this._relationsToJoin = {}
    for (const [key, value] of Object.entries(query)) {
      // Support array notation for multiple parameters, as sent by axios:
      const param = key.endsWith('[]') ? key.substr(0, key.length - 2) : key
      if (!allowed[param]) {
        throw new QueryBuilderError(`Query parameter '${key}' is not allowed.`)
      }
      const paramHandler = QueryParameters.get(param)
      if (!paramHandler) {
        throw new QueryBuilderError(
          `Invalid query parameter '${param}' in '${key}=${value}'.`)
      }
      paramHandler(this, key, value)
    }
    for (const relation of Object.values(this._relationsToJoin)) {
      relation.join(this, { joinOperation: 'leftJoin' })
    }
    return this
  }

  // @override
  findOne(query, { allowParam, checkRootWhere = true } = {}) {
    if (!query) return this
    // Only allow the suitable query handlers on find-one queries:
    const allowedParams = QueryParameters.getAllowedFindOne()
    allowParam = allowParam
      ? allowParam.filter(str => allowedParams[str])
      : Object.keys(allowedParams)
    return this.find(query, { allowParam, checkRootWhere }).first()
  }

  getPropertyRef(ref, options) {
    const cache = this._propertyRefsCache
    return cache[ref] ||
      (cache[ref] = new PropertyRef(ref, this.modelClass(), options))
  }

  parseWhereFilter(where, key, value) {
    let [ref, filter] = key.split(/\s/)
    filter = filter || (value === null ? 'null' : 'is')
    const queryFilter = filter && QueryWhereFilters.get(filter)
    if (!queryFilter) {
      throw new QueryBuilderError(`Invalid filter in '${key}=${value}'.`)
    }
    const propertyRef = this.getPropertyRef(ref)
    const { relation } = propertyRef
    if (relation?.isOneToOne()) {
      this._relationsToJoin[relation.name] = relation
    }
    propertyRef.applyWhereFilter(this, this, queryFilter, where, value)
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

  'select', 'column', 'columns', 'first', 'pluck',

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
        arg = Object.keys(arg).reduce((converted, key) => {
          converted[convertIdentifier(key)] = arg[key]
          return converted
        }, {})
      }
      return arg
    }

    const length = ['select', 'column', 'columns', 'first'].includes(key)
      ? args.length
      : 1
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

function addEagerScope(modelClass, expr, scopes, filters, isRoot = true) {
  if (isRoot) {
    expr = expr.clone ? expr.clone() : clone(expr)
  } else {
    // Only add the scope if it's not already defined by the eager statement and
    // if it's actually available as a filter in the model's namedFilters list.
    for (const scope of scopes) {
      if (!expr.$modify?.includes(scope) &&
          (modelClass.namedFilters[scope] || filters?.[scope])) {
        expr.$modify.push(scope)
      }
    }
  }
  const relations = modelClass.getRelations()
  for (const key in expr) {
    // All enumerable properties that don't start with '$' are child nodes.
    if (!key.startsWith('$')) {
      const child = expr[key]
      const relation = relations[child.$relation || key]
      if (!relation) {
        throw new RelationError(`Invalid child expression: '${key}'`)
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
  'mergeEager',
  'clearEager',
  'scope',
  'mergeScope',
  'applyScope',
  'eagerScope',
  'mergeEagerScope',
  'applyEagerScope',
  'clearScope',
  'pick',
  'omit',
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
