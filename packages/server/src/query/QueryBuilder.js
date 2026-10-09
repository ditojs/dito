import objection from 'objection'
import {
  isArray,
  isString,
  isBoolean,
  isObject,
  isPlainObject,
  asArray,
  clone,
  mapKeys,
  parseDataPath,
  deprecate
} from '@ditojs/utils'
import { QueryParameters } from './QueryParameters.js'
import { KnexHelper } from '../lib/index.js'
import { DitoGraphProcessor } from '../graph/index.js'
import { QueryBuilderError, RelationError } from '../errors/index.js'
import { createLookup } from '../utils/object.js'
import { getScope } from '../utils/scope.js'

const SYMBOL_ALL = Symbol('all')

export class QueryBuilder extends objection.QueryBuilder {
  #ignoreGraph = false
  #scopes = { default: true } // Eager-apply the default scope
  #allowScopes = null
  #ignoreScopes = {}
  #appliedScopes = {}
  #allowFilters = null
  #omits = []

  // @override
  clone() {
    const copy = super.clone()
    copy.#ignoreGraph = this.#ignoreGraph
    copy.#appliedScopes = { ...this.#appliedScopes }
    copy.#allowFilters = this.#allowFilters ? { ...this.#allowFilters } : null
    // Unlike `#copyScopesFromParent()` for child queries, a clone keeps all
    // scopes, graph and non-graph:
    copy.#scopes = { ...this.#scopes }
    copy.#allowScopes = this.#allowScopes ? { ...this.#allowScopes } : null
    copy.#ignoreScopes = { ...this.#ignoreScopes }
    return copy
  }

  // @override
  async execute() {
    if (this.#omits.length > 0) {
      this.runAfter(result => {
        for (const model of asArray(result)) {
          model.$omitFromJson(...this.#omits)
        }
        return result
      })
    }
    this.#applyScopes()
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
      this.#clearScopes(false)
    } else {
      // Inherit the graph scopes from the parent query.
      this.#ignoreGraph = query.#ignoreGraph
      this.#copyScopesFromParent(query)
    }
    return this
  }

  // @override
  toFindQuery() {
    // Objection's `asFindQuery()` in static hooks clears the `runAfter()`
    // callbacks of the original query itself now (objection#2093), but its
    // `toFindQuery()` keeps them. Dito's `toFindQuery()` has always cleared
    // them, so keep doing so in 3.x.
    // TODO: Remove in 4.0, leaving `toFindQuery()` to Objection.
    return super.toFindQuery().clear('runAfter')
  }

  omit(...properties) {
    this.#omits.push(...properties)
    return this
  }

  #withScope(...args) {
    const { checkAllowedScopes, scopes } = getScopes(args)
    for (const expr of scopes) {
      if (expr) {
        const { scope, graph } = getScope(expr)
        if (
          checkAllowedScopes &&
          this.#allowScopes &&
          !this.#allowScopes[scope]
        ) {
          throw new QueryBuilderError(
            `Query scope '${scope}' is not allowed.`
          )
        }
        this.#scopes[scope] ||= graph
      }
    }
    return scopes
  }

  withScope(...args) {
    this.#withScope(...args)
    return this
  }

  // Clear all scopes defined with `withScope()` statements, preserving the
  // default scope.
  clearWithScope() {
    return this.#clearScopes(true)
  }

  ignoreScope(...scopes) {
    if (!this.#ignoreScopes[SYMBOL_ALL]) {
      this.#ignoreScopes =
        scopes.length > 0
          ? {
              ...this.#ignoreScopes,
              ...createLookup(scopes)
            }
          : // Empty arguments = ignore all scopes
            {
              [SYMBOL_ALL]: true
            }
    }
    return this
  }

  applyScope(...args) {
    // When directly applying a scope, still use `#withScope() to merge it into
    // `this.#scopes`, so it can still be passed on to forked child queries.
    // This also handles the checks against `#allowScopes`.
    for (const expr of this.#withScope(...args)) {
      if (expr) {
        const { scope, graph } = getScope(expr)
        this.#applyScope(scope, graph)
      }
    }
    return this
  }

  allowScope(...scopes) {
    this.#allowScopes ||= {
      default: true // The default scope is always allowed.
    }
    for (const expr of scopes) {
      if (expr) {
        const { scope } = getScope(expr)
        this.#allowScopes[scope] = true
      }
    }
    return this
  }

  clearAllowScope() {
    this.#allowScopes = null
    return this
  }

  #clearScopes(addDefault) {
    // `_scopes` is an object where the keys are the scopes and the values
    // indicate if the scope should be eager-applied or not:
    this.#scopes = addDefault
      ? { default: true } // Eager-apply the default scope
      : {}
    return this
  }

  #copyScopesFromParent(query) {
    const isSameModelClass = this.modelClass() === query.modelClass()
    // Only copy `#allowScopes` and `_ignoreScopes` if it's for the same model.
    if (isSameModelClass) {
      this.#allowScopes = query.#allowScopes ? { ...query.#allowScopes } : null
      this.#ignoreScopes = { ...query.#ignoreScopes }
    }
    // When copying scopes for child-queries, we also need to take the
    // already applied scopes into account and copy those too.
    const scopes = { ...query.#appliedScopes, ...query.#scopes }
    // If the target is a child query of a graph query, copy all scopes, graph
    // and non-graph. If it is a child query of a related or eager query,
    // copy only the graph scopes.
    const shouldCopyAllScopes = isSameModelClass && query.has(/GraphAndFetch$/)
    this.#scopes = shouldCopyAllScopes
      ? scopes
      : filterScopes(scopes, (scope, graph) => graph) // copy graph-scopes only.
  }

  #applyScopes() {
    if (!this.#ignoreScopes[SYMBOL_ALL]) {
      // Objection's `isFind()` is also true for `upsertGraph()`, which rejects
      // `where` conditions on its root query, so check for it separately:
      const isUpsertGraph = this.has(/^upsertGraph/)
      // Only apply default scopes if this is a normal find query, meaning it
      // does not define any write operations or special selects, e.g. `count`:
      const isNormalFind = (
        this.isFind() &&
        !isUpsertGraph &&
        !this.hasSpecialSelects()
      )
      // If this isn't a normal find query, ignore all graph operations,
      // to not mess with special selects such as `count`, etc:
      this.#ignoreGraph = !isNormalFind
      // All scopes in `_scopes` were already checked against `#allowScopes`.
      // They themselves are allowed to apply / request other scopes that
      // aren't listed, so clear `#allowScopes` and restore again after:
      const allowScopes = this.#allowScopes
      this.#allowScopes = null
      const collectedScopes = {}
      // Scopes can themselves request more scopes by calling `withScope()`
      // In order to prevent that from causing problems while looping over
      // `_scopes`, create a local copy of the entries, set `_scopes` to an
      // empty object during iteration and check if there are new entries after
      // one full loop. Keep doing this until there's nothing left, but keep
      // track of all the applied scopes, so `_scopes` can be set to the the
      // that in the end. This is needed for child queries, see `childQueryOf()`
      let scopes = Object.entries(this.#scopes)
      while (scopes.length > 0) {
        this.#scopes = {}
        for (const [scope, graph] of scopes) {
          // Don't apply `default` scopes on anything else than a normal find
          // query:
          if (isNormalFind || scope !== 'default') {
            this.#applyScope(scope, graph)
            collectedScopes[scope] ||= graph
          } else if (isUpsertGraph) {
            // Keep the `default` scope for the child queries of upserts, e.g.
            // the refetch of `upsertGraphAndFetch()`:
            collectedScopes[scope] ||= graph
          }
        }
        scopes = Object.entries(this.#scopes)
      }
      this.#scopes = collectedScopes
      this.#allowScopes = allowScopes
      this.#ignoreGraph = false
    }
  }

  #applyScope(scope, graph) {
    if (!this.#ignoreScopes[SYMBOL_ALL] && !this.#ignoreScopes[scope]) {
      // Prevent multiple application of scopes. This can easily occur
      // with the nesting and eager-application of graph-scopes, see below.
      // NOTE: The boolean values indicate the `graph` settings, not whether the
      // scopes were applied or not.
      if (!(scope in this.#appliedScopes)) {
        // Only apply graph-scopes that are actually defined on the model:
        const func = this.modelClass().getScope(scope)
        if (func) {
          func.call(this, this)
        }
        this.#appliedScopes[scope] = graph
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
            [name]: query => {
              query.withScope(
                name,
                // Pass `false` for `checkAllowedScopes` as when `#applyScope()`
                // was called, no further checks are required.
                false
              )
              if (query.isJoinChildQuery()) {
                // Join child queries are never executed, and need to apply
                // their scopes manually. Note that it's OK to call this
                // repeatedly, because `_appliedScopes` prevents multiple
                // application of the same scope.
                query.#applyScopes()
              }
            }
          }
          this.withGraph(
            addGraphScope(this.modelClass(), expr, [name], modifiers, true)
          ).modifiers(modifiers)
        }
      }
    }
  }

  applyFilter(name, ...args) {
    if (isObject(name)) {
      // Multiple filters: applyFilter({ active: [], recent: [30] })
      for (const [key, value] of Object.entries(name)) {
        this.applyFilter(key, ...asArray(value))
      }
      return this
    }

    if (this.#allowFilters && !this.#allowFilters[name]) {
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
    this.#allowFilters ||= {}
    for (const filter of filters) {
      this.#allowFilters[filter] = true
    }
    return this
  }

  // @override
  // Objection's algorithm-agnostic `withGraph()` keeps the algorithms of the
  // relations that are already loaded, and uses the last used one for new
  // ones. Additionally, this handles `#ignoreGraph`:
  withGraph(expr, options = {}) {
    const { algorithm } = options
    if (algorithm !== undefined && !['fetch', 'join'].includes(algorithm)) {
      throw new QueryBuilderError(
        `Graph algorithm '${algorithm}' is unsupported.`
      )
    }
    if (!this.#ignoreGraph) {
      super.withGraph(expr, options)
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
      relation,
      wildcard,
      expression,
      nestedDataPath,
      name
    } = this.modelClass().getPropertyOrRelationAtDataPath(parsedDataPath)

    if (nestedDataPath) {
      // Once a JSON data type is reached, even if it's not at the end of the
      // provided path, load it and assume we're done with the loading part.
      if (
        !(
          wildcard ||
          property && ['object', 'array'].includes(property.type)
        )
      ) {
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
    if (name && !relation) {
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
          restart ? ' restart identity' : ''
        }${
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
    return this.runBefore((result, builder) => {
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
    }).runAfter((result, builder) => {
      if (!builder.context().isMainQuery) {
        return result === 0
          ? mainQuery[options.fetch ? 'insertAndFetch' : 'insert'](data)
          : // We can use the `mainQuery` we saved in runBefore() to fetch the
            // inserted results. It is noteworthy that this query will return
            // the wrong results if the update changed any of the columns the
            // where operates with. This also returns all updated models.
            mainQuery.first()
      }
      return result
    })
  }

  find(query, allowParam) {
    if (!query) return this
    const allowed = !allowParam
      ? QueryParameters.getAllowed()
      : // If it's already a lookup object just use it, otherwise convert it:
        isPlainObject(allowParam)
        ? allowParam
        : createLookup(allowParam)
    for (const [key, value] of Object.entries(query)) {
      // Support array notation for multiple parameters, as sent by axios:
      const param = key.endsWith('[]') ? key.slice(0, -2) : key
      if (!allowed[param]) {
        throw new QueryBuilderError(`Query parameter '${key}' is not allowed.`)
      }
      const paramHandler = QueryParameters.get(param)
      if (!paramHandler) {
        throw new QueryBuilderError(
          `Invalid query parameter '${param}' in '${key}=${value}'.`
        )
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

  // Extend Objection's `patchAndFetch()` and `updateAndFetch()` to also support
  // arrays of models, not only single instances.
  // See: https://gitter.im/Vincit/objection.js?at=5f994a5900a0f3369d366d6f

  patchAndFetch(data) {
    return isArray(data)
      ? this.#upsertAndFetch(data)
      : super.patchAndFetch(data)
  }

  updateAndFetch(data) {
    return isArray(data)
      ? this.#upsertAndFetch(data, { update: true })
      : super.updateAndFetch(data)
  }

  upsertAndFetch(data) {
    return this.#upsertAndFetch(data, {
      // Insert missing nodes only at root by allowing `insertMissing`,
      // but set `noInsert` for all relations:
      insertMissing: true,
      noInsert: this.modelClass().getRelationNames()
    })
  }

  #upsertAndFetch(data, options) {
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
    return this.#handleDitoGraph(
      'insertGraph',
      data,
      options,
      insertDitoGraphOptions
    )
  }

  insertDitoGraphAndFetch(data, options) {
    return this.#handleDitoGraph(
      'insertGraphAndFetch',
      data,
      options,
      insertDitoGraphOptions
    )
  }

  upsertDitoGraph(data, options) {
    return this.#handleDitoGraph(
      'upsertGraph',
      data,
      options,
      upsertDitoGraphOptions
    )
  }

  upsertDitoGraphAndFetch(data, options) {
    return this.#handleDitoGraph(
      'upsertGraphAndFetch',
      data,
      options,
      upsertDitoGraphOptions
    )
  }

  patchDitoGraph(data, options) {
    return this.#handleDitoGraph(
      'upsertGraph',
      data,
      options,
      patchDitoGraphOptions
    )
  }

  patchDitoGraphAndFetch(data, options) {
    return this.#handleDitoGraph(
      'upsertGraphAndFetch',
      data,
      options,
      patchDitoGraphOptions
    )
  }

  updateDitoGraph(data, options) {
    return this.#handleDitoGraph(
      'upsertGraph',
      data,
      options,
      updateDitoGraphOptions
    )
  }

  updateDitoGraphAndFetch(data, options) {
    return this.#handleDitoGraph(
      'upsertGraphAndFetch',
      data,
      options,
      updateDitoGraphOptions
    )
  }

  upsertDitoGraphAndFetchById(id, data, options) {
    this.context({ byId: id })
    return this.upsertDitoGraphAndFetch(
      {
        ...data,
        ...this.modelClass().getReference(id)
      },
      options
    )
  }

  patchDitoGraphAndFetchById(id, data, options) {
    this.context({ byId: id })
    return this.patchDitoGraphAndFetch(
      {
        ...data,
        ...this.modelClass().getReference(id)
      },
      options
    )
  }

  updateDitoGraphAndFetchById(id, data, options) {
    this.context({ byId: id })
    return this.updateDitoGraphAndFetch(
      {
        ...data,
        ...this.modelClass().getReference(id)
      },
      options
    )
  }

  #handleDitoGraph(method, data, options, defaultOptions) {
    const { cyclic, ...graphOptions } = options ?? {}
    if (cyclic !== undefined) {
      deprecate(
        'The `cyclic` graph option is deprecated and has no effect anymore. ' +
        'Objection.js resolves cyclic `#ref` references on its own now.'
      )
    }
    const graphProcessor = new DitoGraphProcessor(
      this.modelClass(),
      data,
      {
        ...defaultOptions,
        ...graphOptions
      },
      {
        processOverrides: true,
        processRelates: true
      }
    )
    this[method](graphProcessor.getData(), graphProcessor.getOptions())
    return this
  }

  static mixin(target) {
    // Expose a selection of QueryBuilder methods directly on the target,
    // redirecting the calls to `this.query()[method](...)`
    for (const method of mixinMethods) {
      if (method in target) {
        console.warn(
          `There is already a property named '${method}' on '${target}'`
        )
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
  QueryBuilder.prototype[key] = function (...args) {
    const modelClass = this.modelClass()
    const { properties } = modelClass.definition

    // Expands all identifiers known to the model to their extended versions.
    const expandIdentifier = identifier => {
      // Support expansion of identifiers with aliases, e.g. `name AS newName`
      const alias = (
        isString(identifier) &&
        identifier.match(/^\s*([a-z][\w_]+)(\s+AS\s+.*)$/i)
      )
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

function getScopes(scopes) {
  let checkAllowedScopes = true
  const last = scopes.at(-1)
  if (isBoolean(last)) {
    checkAllowedScopes = last
    scopes = scopes.slice(0, -1)
  }
  return { checkAllowedScopes, scopes }
}

function filterScopes(scopes, callback) {
  return Object.fromEntries(
    Object.entries(scopes).filter(
      ([scope, graph]) => callback(scope, graph)
    )
  )
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
        !expr.$modify.includes(scope) && (
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
  'havingWrapped'
]
