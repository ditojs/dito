import objection from 'objection'
import { KnexHelper } from '@/lib'
import { QueryBuilderError, RelationError } from '@/errors'
import { QueryParameters } from './QueryParameters'
import { QueryWhereFilters } from './QueryWhereFilters'
import PropertyRef from './PropertyRef'
import { GraphProcessor } from '@/graph'
import { isPlainObject, isString, isArray, clone } from '@ditojs/utils'
import { createLookup, getScope } from '@/utils'

// This code is based on objection-find, and simplified.
// Instead of a separate class, we extend objection.QueryBuilder to better
// integrate with Objection.js

export class QueryBuilder extends objection.QueryBuilder {
  constructor(modelClass) {
    super(modelClass)
    this._propertyRefsCache = {}
    this._allowScopes = null
    this._ignoreScopes = false
    this._appliedScopes = {}
    this._allowFilters = null
    this._clearScopes(true)
  }

  // @override
  clone() {
    const copy = super.clone()
    copy._propertyRefsCache = this._propertyRefsCache
    copy._copyScopes(this)
    copy._ignoreScopes = this._ignoreScopes
    copy._appliedScopes = { ...this._appliedScopes }
    copy._allowFilters = { ...this._allowFilters }
    return copy
  }

  // @override
  execute() {
    if (!this._ignoreScopes) {
      for (const { scope, eager } of this._scopes) {
        this._applyScope(scope, eager)
      }
    }
    // If this isn't a find query, meaning if it defines any write operations or
    // special selects, then 'eager' and 'orderBy' operations need to be
    // cleared. This is to not mess with special selects such as count(), etc...
    if (
      !this.isFind() ||
      this.hasSelects() && !this.has(/^(select|columns?)$/)
    ) {
      this.clearEager()
      this.clear('orderBy')
    }
    return super.execute()
  }

  // @override
  childQueryOf(query, fork) {
    if (fork) {
      // Forked queries shouldn't apply or inherit any scopes.
      this._clearScopes(false)
    } else {
      // Inherit the scopes from the parent query, but only include non-eager
      // scopes if this query is for the same model-class as the parent query.
      this._copyScopes(query, this.modelClass() !== query.modelClass())
    }
    return super.childQueryOf(query, fork)
  }

  scope(...scopes) {
    return this._clearScopes(true).mergeScope(...scopes)
  }

  mergeScope(...scopes) {
    for (const expr of scopes) {
      if (expr) {
        const { scope, eager } = getScope(expr)
        // Merge with existing matching scope statements, or add a new one.
        const existing = this._scopes.find(entry => entry.scope === scope)
        if (existing) {
          existing.eager = existing.eager || eager
        } else {
          this._scopes.push({ scope, eager })
        }
      }
    }
    return this
  }

  applyScope(...scopes) {
    // When directly applying a scope, still merge it into the list of scopes
    // `this._scopes`, so it can still be passed on to forked child queries:
    this.mergeScope(...scopes)
    for (const expr of scopes) {
      if (expr) {
        const { scope, eager } = getScope(expr)
        this._applyScope(scope, eager)
      }
    }
    return this
  }

  allowScope(...scopes) {
    this._allowScopes = this._allowScopes || {
      default: true // The default scope is always allowed.
    }
    for (const expr of scopes) {
      if (expr) {
        const { scope } = getScope(expr)
        this._allowScopes[scope] = true
      }
    }
  }

  clearScope() {
    return this._clearScopes(false)
  }

  ignoreScope() {
    this._ignoreScopes = true
    return this
  }

  _copyScopes(query, eagerOnly = false) {
    if (eagerOnly) {
      this._scopes = query._scopes.filter(scope => scope.eager)
    } else {
      this._scopes = query._scopes.slice()
      this._allowScopes = query._allowScopes
        ? { ...query._allowScopes }
        : null
    }
  }

  _applyScope(scope, eager) {
    if (!this._ignoreScopes) {
      const modelClass = this.modelClass()
      // When a scope itself is allowed, it should be able to apply all other
      // scopes internally, ignoring the settings of _allowScopes during its
      // execution. Do so by temporarily clearing and restoring _allowScopes:
      const { _allowScopes } = this
      this._allowScopes = null
      try {
        if (
          // Prevent multiple application of scopes. This can easily occur
          // with the nesting of eager scopes, see below.
          !this._appliedScopes[scope] &&
          // Only eager-apply scopes that are actually defined on the model:
          (!eager || modelClass.hasScope(scope))
        ) {
          if (_allowScopes && !_allowScopes[scope]) {
            throw new QueryBuilderError(
              `Query scope '${scope}' is not allowed.`
            )
          }
          this._appliedScopes[scope] = true
          this.modify(scope)
        }
        const eagerObject = eager && this.eagerObject()
        if (eagerObject) {
          // Add a new modifier to the existing eager expression that
          // recursively applies the eager-scope to the resulting queries.
          // This even works if nested scopes expand the eager expression,
          // because it re-applies itself to the result.
          const name = `^${scope}`
          const modifiers = {
            [name]: query => query._applyScope(scope, eager)
          }
          this.eager(
            addEagerScope(
              this.modelClass(),
              eagerObject,
              [name],
              modifiers
            ),
            {
              ...this.eagerModifiers(),
              ...modifiers
            }
          )
        }
      } finally {
        this._allowScopes = _allowScopes
      }
    }
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

  applyFilter(name, ...args) {
    // NOTE: Dito's `applyFilter()` does something else than Objection's
    // deprecated `applyFilter()`, use `applyModifier()` instead!
    if (this._allowFilters && !this._allowFilters[name]) {
      throw new QueryBuilderError(`Query filter '${name}' is not allowed.`)
    }
    const filter = this.modelClass().definition.filters[name]
    if (!filter) {
      throw new QueryBuilderError(`Query filter '${name}' is not defined.`)
    }
    // NOTE: Filters are automatically combine with and operations!
    return this.andWhere(function() {
      filter(this, ...args)
    })
  }

  // Work-around for Objection's issue in modify() introduced in v1.3.0
  // See: https://github.com/Vincit/objection.js/issues/1085
  modify(arg, ...args) {
    return arg === undefined
      ? this
      : isString(arg)
        ? this.applyModifier(arg, ...args)
        : super.modify(arg, ...args)
  }

  allowFilter(...filters) {
    this._allowFilters = this._allowFilters || {}
    for (const filter of filters) {
      this._allowFilters[filter] = true
    }
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
    if (options.skipProcessing) {
      return super[method](data, options)
    }
    const graph = new GraphProcessor(
      this.modelClass(),
      data,
      options,
      // Only process overrides and relates if the options aren't overridden,
      // to still allow Objection.js-style graph calls with detailed options.
      options === defaultOptions
        ? {
          processOverrides: true,
          processRelates: true
        }
        : {}
    )
    return super[method](graph.getData(), graph.getOptions())
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
    return this.upsertGraphAndFetch({
      ...data,
      ...this.modelClass().getReference(id)
    }, options)
  }

  updateGraphAndFetchById(id, data, options) {
    this.context({ byId: id })
    return this.updateGraphAndFetch({
      ...data,
      ...this.modelClass().getReference(id)
    }, options)
  }

  patchGraphAndFetchById(id, data, options) {
    this.context({ byId: id })
    return this.patchGraphAndFetch({
      ...data,
      ...this.modelClass().getReference(id)
    }, options)
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
  findById(id) {
    // Remember id so Model.createNotFoundError() can report it:
    this.context({ byId: id })
    return super.findById(id)
  }

  find(query, allowParam) {
    if (!query) return this
    const allowed = !allowParam
      ? QueryParameters.allowed()
      // If it's already a lookup object just use it, otherwise convert it:
      : isPlainObject(allowParam) ? allowParam : createLookup(allowParam)
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

  'select', 'column', 'columns', 'first',

  'groupBy', 'orderBy'
]) {
  const method = QueryBuilder.prototype[key]
  QueryBuilder.prototype[key] = function(...args) {
    const modelClass = this.modelClass()
    const { properties } = modelClass.definition

    // Expands all identifiers known to the model to their extended versions.
    const expandIdentifier = identifier =>
      identifier === '*' || identifier in properties
        ? `${this.tableRefFor(modelClass)}.${identifier}`
        : identifier

    const convertArgument = arg => {
      if (isString(arg)) {
        arg = expandIdentifier(arg)
      } else if (isArray(arg)) {
        arg = arg.map(value => expandIdentifier(value))
      } else if (isPlainObject(arg)) {
        arg = Object.keys(arg).reduce((converted, key) => {
          converted[expandIdentifier(key)] = arg[key]
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

function addEagerScope(modelClass, expr, scopes, modifiers, isRoot = true) {
  if (isRoot) {
    expr = clone(expr)
  } else {
    // Only add the scope if it's not already defined by the eager statement and
    // if it's actually available as a modifier in the model's modifiers list.
    for (const scope of scopes) {
      if (!expr.$modify?.includes(scope) &&
          (modelClass.modifiers[scope] || modifiers?.[scope])) {
        expr.$modify.push(scope)
      }
    }
  }
  const relations = modelClass.getRelations()
  for (const key in expr) {
    // All enumerable properties that don't start with '$' are child nodes.
    if (key[0] !== '$') {
      const child = expr[key]
      const relation = relations[child.$relation || key]
      if (!relation) {
        throw new RelationError(`Invalid child expression: '${key}'`)
      }
      addEagerScope(relation.relatedModelClass, child, scopes, modifiers, false)
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
  'clearScope',
  'clear',
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
