import objection from 'objection'
import {
  isObject, isPlainObject, isString, isArray, clone, mapKeys,
  getValueAtDataPath, setValueAtDataPath, parseDataPath
} from '@ditojs/utils'
import { QueryParameters } from './QueryParameters.js'
import { KnexHelper } from '../lib/index.js'
import { DitoGraphProcessor, walkGraph } from '../graph/index.js'
import { QueryBuilderError, RelationError } from '../errors/index.js'
import { createLookup, getScope, deprecate } from '../utils/index.js'

const SYMBOL_ALL = Symbol('all')

export class QueryBuilder extends objection.QueryBuilder {
  constructor(modelClass) {
    super(modelClass)
    this._ignoreGraph = false
    this._graphAlgorithm = 'fetch'
    this._allowFilters = null
    this._allowScopes = null
    this._ignoreScopes = {}
    this._appliedScopes = {}
    this._executeFirst = null // Part of a work-around for cyclic graphs
    this._clearScopes(true)
  }

  // @override
  clone() {
    const copy = super.clone()
    copy._ignoreGraph = this._ignoreGraph
    copy._graphAlgorithm = this._graphAlgorithm
    copy._appliedScopes = { ...this._appliedScopes }
    copy._allowFilters = this._allowFilters ? { ...this._allowFilters } : null
    copy._copyScopes(this)
    return copy
  }

  // @override
  async execute() {
    if (!this._ignoreScopes[SYMBOL_ALL]) {
      // Only apply default scopes if this is a normal find query, meaning it
      // does not define any write operations or special selects, e.g. `count`:
      const isNormalFind = (
        this.isFind() &&
        !this.hasSpecialSelects()
      )
      // If this isn't a normal find query, ignore all graph operations,
      // to not mess with special selects such as `count`, etc:
      this._ignoreGraph = !isNormalFind
      // All scopes in `_scopes` were already checked against `_allowScopes`.
      // They themeselves are allowed to apply / request other scopes that
      // aren't listed, so clear `_applyScope` and restore again after:
      const { _allowScopes } = this
      this._allowScopes = null
      const collectedScopes = {}
      // Scopes can themselves request more scopes by calling `withScope()`
      // In order to prevent that from causing problems while looping over
      // `_scopes`, create a local copy of the entries, set `_scopes` to an
      // empty object during iteration and check if there are new entries after
      // one full loop. Keep doing this until there's nothing left, but keep
      // track of all the applied scopes, so `_scopes` can be set to the the
      // that in the end. This is needed for child queries, see `childQueryOf()`
      let scopes = Object.entries(this._scopes)
      while (scopes.length > 0) {
        this._scopes = {}
        for (const [scope, graph] of scopes) {
          // Don't apply `default` scopes on anything else than a normal find
          // query:
          if (scope !== 'default' || isNormalFind) {
            this._applyScope(scope, graph)
            collectedScopes[scope] ||= graph
          }
        }
        scopes = Object.entries(this._scopes)
      }
      this._scopes = collectedScopes
      this._allowScopes = _allowScopes
      this._ignoreGraph = false
    }
    // In case of cyclic graphs, run `_executeFirst()` now:
    await this._executeFirst?.()
    return super.execute()
  }

  hasNormalSelects() {
    // Returns true if the query defines normal selects:
    //   select(), column(), columns()
    return this.has(/^(select|columns?)$/)
  }

  hasSpecialSelects() {
    // Returns true if the query defines special selects:
    //   distinct(), count(), countDistinct(), min(), max(),
    //   sum(), sumDistinct(), avg(), avgDistinct()
    return this.hasSelects() && !this.hasNormalSelects()
  }

  // @override
  childQueryOf(query, options) {
    super.childQueryOf(query, options)
    if (this.isInternal()) {
      // Internal queries shouldn't apply or inherit any scopes, not even the
      // default scope.
      this._clearScopes(false)
    } else {
      // Inherit the graph scopes from the parent query.
      this._copyScopes(query, true)
    }
    return this
  }

  // @override
  toFindQuery() {
    // Temporary workaround to fix this issue until it is resolved in Objection:
    // https://github.com/Vincit/objection.js/issues/2093
    return super.toFindQuery().clear('runAfter')
  }

  withScope(...scopes) {
    for (const expr of scopes) {
      if (expr) {
        const { scope, graph } = getScope(expr)
        if (this._allowScopes && !this._allowScopes[scope]) {
          throw new QueryBuilderError(
            `Query scope '${scope}' is not allowed.`
          )
        }
        this._scopes[scope] ||= graph
      }
    }
    return this
  }

  // Clear all scopes defined with `withScope()` statements, preserving the
  // default scope.
  clearWithScope() {
    return this._clearScopes(true)
  }

  ignoreScope(...scopes) {
    if (!this._ignoreScopes[SYMBOL_ALL]) {
      this._ignoreScopes = scopes.length > 0
        ? {
          ...this._ignoreScopes,
          ...createLookup(scopes)
        }
        // Empty arguments = ignore all scopes
        : {
          [SYMBOL_ALL]: true
        }
    }
    return this
  }

  applyScope(...scopes) {
    // When directly applying a scope, still merge it into `this._scopes`,
    // so it can still be passed on to forked child queries. This also handles
    // the checks against `_allowScopes`.
    this.withScope(...scopes)
    for (const expr of scopes) {
      if (expr) {
        const { scope, graph } = getScope(expr)
        this._applyScope(scope, graph)
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

  clearAllowScope() {
    this._allowScopes = null
  }

  scope(...scopes) {
    deprecate(`QueryBuilder#scope() is deprecated. Use #withScope() instead.`)

    return this.clearWithScope().withScope(...scopes)
  }

  mergeScope(...scopes) {
    deprecate(`QueryBuilder#mergeScope() is deprecated. Use #withScope() instead.`)

    return this.withScope(...scopes)
  }

  clearScope() {
    deprecate(`QueryBuilder#clearScope() is deprecated. Use #clearWithScope() or #ignoreScope() instead.`)

    return this.clearWithScope()
  }

  _clearScopes(addDefault) {
    // `_scopes` is an object where the keys are the scopes and the values
    // indicate if the scope should be eager-applied or not:
    this._scopes = addDefault
      ? { default: true } // eager-apply the default scope
      : {}
    return this
  }

  _copyScopes(query, isChildQuery = false) {
    const isSameModelClass = this.modelClass() === query.modelClass()
    // Only copy `_allowScopes` and `_ignoreScopes` if it's for the same model.
    if (isSameModelClass) {
      this._allowScopes = query._allowScopes ? { ...query._allowScopes } : null
      this._ignoreScopes = { ...query._ignoreScopes }
    }
    const scopes = isChildQuery
      // When copying scopes for child-queries, we also need to take the already
      // applied scopes into account and copy those too.
      ? { ...query._appliedScopes, ...query._scopes }
      : { ...query._scopes }
    // If the target is a child query of a graph query, copy all scopes, graph
    // and non-graph. If it is a child query of a related or eager query,
    // copy only the graph scopes.
    const copyAllScopes =
      isSameModelClass && isChildQuery && query.has(/GraphAndFetch$/)
    this._scopes = copyAllScopes
      ? scopes
      : filterScopes(scopes, (scope, graph) => graph) // copy graph-scopes only.
  }

  _applyScope(scope, graph) {
    if (!this._ignoreScopes[SYMBOL_ALL] && !this._ignoreScopes[scope]) {
      // Prevent multiple application of scopes. This can easily occur
      // with the nesting and eager-application of graph-scopes, see below.
      // NOTE: The boolean values indicate the `graph` settings, not whether the
      // scopes were applied or not.
      if (!(scope in this._appliedScopes)) {
        // Only apply graph-scopes that are actually defined on the model:
        const func = this.modelClass().getScope(scope)
        if (func) {
          func.call(this, this)
        }
        this._appliedScopes[scope] = graph
      }
      if (graph) {
        // Also bake the scope into any graph expression that may have been
        // set already using `withGraph()` & co.
        const expr = this.graphExpressionObject()
        if (expr) {
          // Add a new modifier to the existing graph expression that
          // recursively adds the graph-scope to the resulting queries. This
          // even works if nested scopes expand the graph expression, because it
          // re-applies itself to the result.
          const name = `^${scope}`
          const modifiers = {
            [name]: query => query.withScope(name)
          }
          this.withGraph(
            addGraphScope(this.modelClass(), expr, [name], modifiers, true)
          ).modifiers(modifiers)
        }
      }
    }
  }

  applyFilter(name, ...args) {
    if (this._allowFilters && !this._allowFilters[name]) {
      throw new QueryBuilderError(`Query filter '${name}' is not allowed.`)
    }
    const filter = this.modelClass().definition.filters[name]
    if (!filter) {
      throw new QueryBuilderError(`Query filter '${name}' is not defined.`)
    }
    // NOTE: Filters are automatically combine with and operations!
    return this.andWhere(query => filter(query, ...args))
  }

  allowFilter(...filters) {
    this._allowFilters = this._allowFilters || {}
    for (const filter of filters) {
      this._allowFilters[filter] = true
    }
  }

  // A algorithm-agnostic version of `withGraphFetched()` / `withGraphJoined()`,
  // with the algorithm specifiable in the options. Additionally, it handles
  // `_ignoreGraph` and `_graphAlgorithm`:
  withGraph(expr, options = {}) {
    // To make merging easier, keep the current algorithm if none is specified:
    const { algorithm = this._graphAlgorithm } = options
    const method = {
      fetch: 'withGraphFetched',
      join: 'withGraphJoined'
    }[algorithm]
    if (!method) {
      throw new QueryBuilderError(
        `Graph algorithm '${algorithm}' is unsupported.`
      )
    }
    if (!this._ignoreGraph) {
      this._graphAlgorithm = algorithm
      super[method](expr, options)
    }
    return this
  }

  // @override
  withGraphFetched(expr, options) {
    return this.withGraph(expr, { ...options, algorithm: 'fetch' })
  }

  // @override
  withGraphJoined(expr, options) {
    return this.withGraph(expr, { ...options, algorithm: 'join' })
  }

  toSQL() {
    return this.toKnexQuery().toSQL()
  }

  raw(...args) {
    // TODO: Figure out a way to support `object.raw()` syntax and return a knex
    // raw expression without accessing the private `RawBuilder.toKnexRaw()`:
    return objection.raw(...args).toKnexRaw(this)
  }

  selectRaw(...args) {
    return this.select(objection.raw(...args))
  }

  // Non-deprecated version of Objection's `pluck()`
  pluck(key) {
    return this.runAfter(result =>
      isArray(result)
        ? result.map(it => it?.[key])
        : isObject(result)
          ? result[key]
          : result
    )
  }

  loadDataPath(dataPath, options) {
    const parsedDataPath = parseDataPath(dataPath)

    const {
      property,
      expression,
      nestedDataPath,
      name,
      index
    } = this.modelClass().getPropertyOrRelationAtDataPath(parsedDataPath)

    if (nestedDataPath) {
      // Once a JSON data type is reached, even if it's not at the end of the
      // provided path, load it and assume we're done with the loading part.
      if (!(property && ['object', 'array'].includes(property.type))) {
        throw new QueryBuilderError(
          `Unable to load full data-path '${
            dataPath
          }' (Unmatched: '${
            nestedDataPath
          }').`
        )
      }
    }

    // Handle the special case of root-level property separately,
    // because `withGraph('(#propertyName)')` is not supported.
    if (property && index === 0) {
      this.select(name)
    } else {
      this.withGraph(expression, options)
    }
    return this
  }

  // @override
  truncate({ restart = true, cascade = false } = {}) {
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

  find(query, allowParam) {
    if (!query) return this
    const allowed = !allowParam
      ? QueryParameters.allowed()
      // If it's already a lookup object just use it, otherwise convert it:
      : isPlainObject(allowParam) ? allowParam : createLookup(allowParam)
    for (const [key, value] of Object.entries(query)) {
      // Support array notation for multiple parameters, as sent by axios:
      const param = key.endsWith('[]') ? key.slice(0, -2) : key
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
    return this
  }

  // @override
  findById(id) {
    // Remember id so Model.createNotFoundError() can report it:
    this.context({ byId: id })
    return super.findById(id)
  }

  // @override
  patchAndFetchById(id, data) {
    this.context({ byId: id })
    return super.patchAndFetchById(id, data)
  }

  // @override
  updateAndFetchById(id, data) {
    this.context({ byId: id })
    return super.updateAndFetchById(id, data)
  }

  // @override
  deleteById(id) {
    this.context({ byId: id })
    return super.deleteById(id)
  }

  patchById(id, data) {
    return this.findById(id).patch(data)
  }

  updateById(id, data) {
    return this.findById(id).update(data)
  }

  // Extend Objection's `patchAndFetch()` and `updateAndFetch()` to also support
  // arrays of models, not only single instances.
  // See: https://gitter.im/Vincit/objection.js?at=5f994a5900a0f3369d366d6f

  patchAndFetch(data) {
    return isArray(data)
      ? this._upsertAndFetch(data)
      : super.patchAndFetch(data)
  }

  updateAndFetch(data) {
    return isArray(data)
      ? this._upsertAndFetch(data, { update: true })
      : super.updateAndFetch(data)
  }

  upsertAndFetch(data) {
    return this._upsertAndFetch(data, {
      // Insert missing nodes only at root by allowing `insertMissing`,
      // but set `noInsert` for all relations:
      insertMissing: true,
      noInsert: this.modelClass().getRelationNames()
    })
  }

  _upsertAndFetch(data, options) {
    return this.upsertGraphAndFetch(data, {
      fetchStrategy: 'OnlyNeeded',
      noInset: true,
      noDelete: true,
      noRelate: true,
      noUnrelate: true,
      ...options
    })
  }

  insertDitoGraph(data, options) {
    return this._handleDitoGraph('insertGraph',
      data, options, insertDitoGraphOptions)
  }

  insertDitoGraphAndFetch(data, options) {
    return this._handleDitoGraph('insertGraphAndFetch',
      data, options, insertDitoGraphOptions)
  }

  upsertDitoGraph(data, options) {
    return this._handleDitoGraph('upsertGraph',
      data, options, upsertDitoGraphOptions)
  }

  upsertDitoGraphAndFetch(data, options) {
    return this._handleDitoGraph('upsertGraphAndFetch',
      data, options, upsertDitoGraphOptions)
  }

  patchDitoGraph(data, options) {
    return this._handleDitoGraph('upsertGraph',
      data, options, patchDitoGraphOptions)
  }

  patchDitoGraphAndFetch(data, options) {
    return this._handleDitoGraph('upsertGraphAndFetch',
      data, options, patchDitoGraphOptions)
  }

  updateDitoGraph(data, options) {
    return this._handleDitoGraph('upsertGraph',
      data, options, updateDitoGraphOptions)
  }

  updateDitoGraphAndFetch(data, options) {
    return this._handleDitoGraph('upsertGraphAndFetch',
      data, options, updateDitoGraphOptions)
  }

  upsertDitoGraphAndFetchById(id, data, options) {
    this.context({ byId: id })
    return this.upsertDitoGraphAndFetch({
      ...data,
      ...this.modelClass().getReference(id)
    }, options)
  }

  patchDitoGraphAndFetchById(id, data, options) {
    this.context({ byId: id })
    return this.patchDitoGraphAndFetch({
      ...data,
      ...this.modelClass().getReference(id)
    }, options)
  }

  updateDitoGraphAndFetchById(id, data, options) {
    this.context({ byId: id })
    return this.updateDitoGraphAndFetch({
      ...data,
      ...this.modelClass().getReference(id)
    }, options)
  }

  _handleDitoGraph(method, data, options, defaultOptions) {
    const handleGraph = data => {
      const graphProcessor = new DitoGraphProcessor(
        this.modelClass(),
        data,
        {
          ...defaultOptions,
          ...options
        },
        {
          processOverrides: true,
          processRelates: true
        }
      )
      this[method](graphProcessor.getData(), graphProcessor.getOptions())
    }

    if (options?.cyclic && method.startsWith('upsert')) {
      // `_upsertCyclicDitoGraphAndFetch()` needs to run asynchronously,
      // but we can't do so here and `runBefore()` executes too late,
      // so use `_executeFirst()` to work around it.
      this._executeFirst = async () => {
        this._executeFirst = null
        handleGraph(
          await this.clone()._upsertCyclicDitoGraphAndFetch(data, options)
        )
      }
    } else {
      handleGraph(data)
    }

    return this
  }

  async _upsertCyclicDitoGraphAndFetch(data, options) {
    // TODO: This is part of a workaround for the following Objection.js issue.
    // Replace with a normal `upsertGraphAndFetch()` once it is fixed:
    // https://github.com/Vincit/objection.js/issues/1482

    // First, collect all #id identifiers and #ref references in the graph,
    // along with their data paths.
    const identifiers = {}
    const references = {}

    const { uidProp, uidRefProp } = this.modelClass()

    walkGraph(data, (value, path) => {
      if (isObject(value)) {
        const { [uidProp]: id, [uidRefProp]: ref } = value
        if (id) {
          // TODO: Also store the correct `idColumn` property for the given path
          identifiers[id] = path.join('/')
        } else if (ref) {
          references[path.join('/')] = ref
        }
      }
    })

    // Now clone the data and delete all references from it, for the initial
    // upsert.
    const cloned = clone(data)
    for (const path of Object.keys(references)) {
      const parts = parseDataPath(path)
      const key = parts.pop()
      const parent = getValueAtDataPath(cloned, parts)
      delete parent[key]
    }

    // TODO: The model isn't necessarily fetched with data in the same order as
    // `cloned` defines, e.g. if there is sorting in the database. A solid
    // implementation of this would take care of that and map entries from
    // `model` back to `cloned`, so that the `setDataPath` calls below would
    // still work in such cases.
    const { cyclic, ...opts } = options
    const model = await this.upsertDitoGraphAndFetch(cloned, opts)

    // Now for each identifier, create an object containing only the final id in
    // the fetched model data:
    const links = {}
    for (const [identifier, path] of Object.entries(identifiers)) {
      // TODO: Use the correct `idColumn` property for the given path
      const { id } = getValueAtDataPath(model, path)
      links[identifier] = { id }
    }

    // And finally replace all references with the final ids, before upserting
    // once again:
    for (const [path, reference] of Object.entries(references)) {
      const link = links[reference]
      if (link) {
        setValueAtDataPath(model, path, link)
      }
    }

    return model
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

// Override all deprecated eager methods to respect the `_ignoreGraph` flag,
// and also keep track of `_graphAlgorithm`, as required by `withGraph()`
// TODO: Remove once we move to Objection 3.0
for (const key of [
  'eager', 'joinEager', 'naiveEager',
  'mergeEager', 'mergeJoinEager', 'mergeNaiveEager'
]) {
  const method = QueryBuilder.prototype[key]
  QueryBuilder.prototype[key] = function(...args) {
    if (!this._ignoreGraph) {
      this._graphAlgorithm = /join/i.test(key) ? 'join' : 'fetch'
      method.call(this, ...args)
    }
    return this
  }
}

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
  'whereColumn', 'andWhereColumn', 'orWhereColumn',
  'whereNotColumn', 'andWhereNotColumn', 'orWhereNotColumn',
  'whereComposite', 'andWhereComposite', 'orWhereComposite',
  'whereInComposite',
  'whereNotInComposite',

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
    const expandIdentifier = identifier => {
      // Support expansion of identifiers with aliases, e.g. `name AS newName`
      const alias =
        isString(identifier) &&
        identifier.match(/^\s*([a-z][\w_]+)(\s+AS\s+.*)$/i)
      return alias
        ? `${expandIdentifier(alias[1])}${alias[2]}`
        : identifier === '*' || identifier in properties
          ? `${this.tableRefFor(modelClass)}.${identifier}`
          : identifier
    }

    const convertArgument = arg => {
      if (isString(arg)) {
        arg = expandIdentifier(arg)
      } else if (isArray(arg)) {
        arg = arg.map(expandIdentifier)
      } else if (isPlainObject(arg)) {
        arg = mapKeys(arg, expandIdentifier)
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

function filterScopes(scopes, callback) {
  return Object.fromEntries(Object.entries(scopes).filter(
    ([scope, graph]) => callback(scope, graph)
  ))
}

// The default options for insertDitoGraph(), upsertDitoGraph(),
// updateDitoGraph() and patchDitoGraph()
const insertDitoGraphOptions = {
  // When working with large graphs, using the 'OnlyNeeded' fetch-strategy
  // will reduce the number of update queries from a lot to only those
  // rows that have changes.
  fetchStrategy: 'OnlyNeeded',
  relate: true,
  allowRefs: true
}

const upsertDitoGraphOptions = {
  ...insertDitoGraphOptions,
  insertMissing: true,
  unrelate: true
}

const patchDitoGraphOptions = {
  ...upsertDitoGraphOptions,
  insertMissing: false
}

const updateDitoGraphOptions = {
  ...patchDitoGraphOptions,
  insertMissing: false,
  update: true
}

function addGraphScope(modelClass, expr, scopes, modifiers, isRoot = false) {
  if (isRoot) {
    expr = clone(expr)
  } else {
    // Only add the scope if it's not already defined by the graph expression
    // and if it's actually available in the model's list of modifiers.
    for (const scope of scopes) {
      if (
        !expr.$modify?.includes(scope) && (
          modelClass.hasScope(scope) ||
          modifiers[scope]
        )
      ) {
        expr.$modify.push(scope)
      }
    }
  }
  const relations = modelClass.getRelations()
  for (const key in expr) {
    // All enumerable properties that don't start with '$' are child nodes.
    if (key[0] !== '$') {
      const childExpr = expr[key]
      const relation = relations[childExpr.$relation || key]
      if (!relation) {
        throw new RelationError(`Invalid child expression: '${key}'`)
      }
      addGraphScope(relation.relatedModelClass, childExpr, scopes, modifiers)
    }
  }
  return expr
}

// List of all `QueryBuilder` methods to be mixed into `Model` as a short-cut
// for `model.query().METHOD()`
//
// Use this code to find all `QueryBuilder` methods:
//
// function getAllPropertyNames(obj) {
//   const proto = Object.getPrototypeOf(obj)
//   const inherited = proto ? getAllPropertyNames(proto) : []
//   return [...new Set(Object.getOwnPropertyNames(obj).concat(inherited))]
// }
//
// console.dir(getAllPropertyNames(QueryBuilder.prototype).sort(), {
//   colors: true,
//   depth: null,
//   maxArrayLength: null
// })

const mixinMethods = [
  'first',
  'find',
  'findOne',
  'findById',

  'withGraph',
  'withGraphFetched',
  'withGraphJoined',
  'clearWithGraph',

  'withScope',
  'applyScope',
  'clearWithScope',

  'clear',
  'pick',
  'omit',
  'select',

  'insert',
  'upsert',

  'update',
  'patch',
  'delete',

  'updateById',
  'patchById',
  'deleteById',

  'truncate',

  'insertAndFetch',
  'upsertAndFetch',
  'updateAndFetch',
  'patchAndFetch',

  'updateAndFetchById',
  'patchAndFetchById',

  'insertGraph',
  'upsertGraph',
  'insertGraphAndFetch',
  'upsertGraphAndFetch',

  'insertDitoGraph',
  'upsertDitoGraph',
  'updateDitoGraph',
  'patchDitoGraph',
  'insertDitoGraphAndFetch',
  'upsertDitoGraphAndFetch',
  'updateDitoGraphAndFetch',
  'patchDitoGraphAndFetch',

  'upsertDitoGraphAndFetchById',
  'updateDitoGraphAndFetchById',
  'patchDitoGraphAndFetchById',

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
  'whereColumn',
  'whereNotColumn',
  'whereComposite',
  'whereInComposite',
  'whereNotInComposite',
  'whereJsonHasAny',
  'whereJsonHasAll',
  'whereJsonIsArray',
  'whereJsonNotArray',
  'whereJsonIsObject',
  'whereJsonNotObject',
  'whereJsonSubsetOf',
  'whereJsonNotSubsetOf',
  'whereJsonSupersetOf',
  'whereJsonNotSupersetOf',

  'having',
  'havingIn',
  'havingNotIn',
  'havingNull',
  'havingNotNull',
  'havingExists',
  'havingNotExists',
  'havingBetween',
  'havingNotBetween',
  'havingRaw',
  'havingWrapped',

  // deprecated methods that are still supported at the moment.
  // TODO: Remove once we move to Objection 3.0
  'eager',
  'joinEager',
  'naiveEager',
  'mergeEager',
  'mergeJoinEager',
  'mergeNaiveEager',
  'clearEager',

  'scope',
  'mergeScope',
  'clearScope'
]
