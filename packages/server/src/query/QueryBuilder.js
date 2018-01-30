import objection from 'objection'
import { KnexHelper } from '@/lib'
import { QueryBuilderError } from '@/errors'
import { QueryHandlers } from './QueryHandlers'
import { QueryFilters } from './QueryFilters'
import PropertyRef from './PropertyRef'
import Graph from './Graph'
import eagerScope from './eagerScope'
import { isArray, isPlainObject, isString, asArray } from '@ditojs/utils'

// This code is based on objection-find, and simplified.
// Instead of a separate class, we extend objection.QueryBuilder to better
// integrate with Objection.js

export class QueryBuilder extends objection.QueryBuilder {
  constructor(modelClass) {
    super(modelClass)
    this._propertyRefsAllowed = null
    this._propertyRefsCache = {}
    this._applyDefaultEager = true
    this._applyDefaultInclude = true
    this._applyDefaultExclude = true
    this._applyDefaultOrder = true
    this._scopes = []
    this._include = null
    this._exclude = null
  }

  clone() {
    const clone = super.clone()
    clone._propertyRefsAllowed = this._propertyRefsAllowed
    clone._propertyRefsCache = this._propertyRefsCache
    clone._applyDefaultEager = this._applyDefaultEager
    clone._applyDefaultOrder = this._applyDefaultOrder
    clone._applyDefaultInclude = this._applyDefaultInclude
    clone._applyDefaultExclude = this._applyDefaultExclude
    clone._scopes = [...this._scopes]
    clone._include = this._include ? { ...this._include } : null
    clone._exclude = this._exclude ? { ...this._exclude } : null
    return clone
  }

  async execute() {
    // Only apply the default: { eager, include, order } settings if this is a
    // find query, meaning it does not specify any write operations, without any
    // special selects. This is required to exclude count(), etc...
    const isFind = this.isFind() && !this.hasSelects()
    if (isFind) {
      const {
        default: { eager, order, include, exclude } = {}
      } = this.modelClass().definition
      if (eager && this._applyDefaultEager) {
        // Use mergeEager() instead of eager(), in case mergeEager() was already
        // called before. Using eager() sets `_applyDefaultEager` to `false`.
        this.mergeEager(eager)
      }
      if (order && this._applyDefaultOrder) {
        this.orderBy(...asArray(order))
      }
      if (include && this._applyDefaultInclude) {
        this.mergeInclude(...asArray(include))
      }
      if (exclude && this._applyDefaultExclude) {
        this.mergeExclude(...asArray(exclude))
      }
    }
    // Now finally apply the scopes.
    this.applyFilter(...this._scopes)
    // Handle _include & _exclude after all scopes were applied, as we need to
    // include the child eager expressions that may be altered by scopes.
    if (isFind && (this._include || this._exclude)) {
      if (this._include) {
        // If there is an include list, automatically add all child eager
        // expressions to the include list.
        if (this._eagerExpression?.numChildren > 0) {
          for (const key of Object.keys(this._eagerExpression.children)) {
            this._include[key] = true
          }
        }
      }
      // Objection's QueryBuilder.traverse() doesn't work after range(),
      // so let's work around it:
      this.runAfter(result => {
        const data = result && this.has('range')
          ? result.results
          : result
        this.resultModelClass().traverse(this.modelClass(), data, model => {
          if (this._include) {
            model.$pick(this._include)
          }
          if (this._exclude) {
            model.$omit(this._exclude)
          }
        })
        return result
      })
    }

    return super.execute()
  }

  eagerScope(...args) {
    if (this._eagerExpression) {
      eagerScope(this.modelClass(), this._eagerExpression, args)
    }
    return this
  }

  eager(...args) {
    this._applyDefaultEager = false
    return super.eager(...args)
  }

  clearEager() {
    this._applyDefaultEager = false
    return super.clearEager()
  }

  orderBy(...args) {
    this._applyDefaultOrder = false
    return super.orderBy(...args)
  }

  clearOrder() {
    this._applyDefaultOrder = false
    return this
  }

  clearDefaults() {
    this._applyDefaultEager = false
    this._applyDefaultOrder = false
    return this
  }

  scope(...scopes) {
    return this.clearScope().mergeScope(...scopes)
  }

  clearScope() {
    this._scopes = []
    return this
  }

  mergeScope(...scopes) {
    for (const scope of scopes) {
      if (!this._scopes.includes(scope)) {
        this._scopes.push(scope)
      }
    }
    return this
  }

  applyScope(...scopes) {
    // A simple redirect to applyFilter() for the sake of naming consistency.
    return this.applyFilter(...scopes)
  }

  include(...properties) {
    return this.clearInclude().mergeInclude(...properties)
  }

  clearInclude() {
    this._include = null
    this._applyDefaultInclude = false
    return this
  }

  mergeInclude(...properties) {
    this._include = this._include || {}
    for (const property of properties) {
      this._include[property] = true
    }
    return this
  }

  exclude(...properties) {
    return this.clearExclude().mergeExclude(...properties)
  }

  clearExclude() {
    this._exclude = null
    this._applyDefaultExclude = false
    return this
  }

  mergeExclude(...properties) {
    this._exclude = this._exclude || {}
    for (const property of properties) {
      this._exclude[property] = true
    }
    return this
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
    const graph = new Graph(this.modelClass(), data, restoreRelations,
      mergeOptions(defaults, options))
    const builder = super[method](graph.getData(), graph.getOptions())
    if (restoreRelations) {
      builder.then(result => graph.restoreRelations(result))
    }
    return builder
  }

  insertGraph(data, options) {
    return this._handleGraph('insertGraph',
      data, insertGraphOptions, options, true)
  }

  insertGraphAndFetch(data, options) {
    return this._handleGraph('insertGraphAndFetch',
      data, insertGraphOptions, options, false)
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
    return this.upsertGraphAndFetch(
      this.modelClass().getIdProperties(id, { ...data }), options)
  }

  updateGraphAndFetchById(id, data, options) {
    return this.updateGraphAndFetch(
      this.modelClass().getIdProperties(id, { ...data }), options)
  }

  patchGraphAndFetchById(id, data, options) {
    return this.patchGraphAndFetch(
      this.modelClass().getIdProperties(id, { ...data }), options)
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

  findById(id, query, allowed) {
    // Add support for optional query to findById()
    super.findById(id)
    return query ? this.findOne(query, allowed) : this
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

// Add conversion of identifiers to all `where` statements, by detecting use of
// model properties and expanding them to `${modelClass.name}.${propertyName}`,
// for unambiguous identification of used properties in complex statements.
for (const key of [
  'where', 'whereNot', 'whereIn', 'whereNotIn', 'whereNull', 'whereNotNull',
  'whereBetween', 'whereNotBetween'
]) {
  const method = QueryBuilder.prototype[key]
  QueryBuilder.prototype[key] = function (arg, ...args) {
    const modelClass = this.modelClass()
    const { properties } = modelClass.definition

    const convertIdentifier = identifier => identifier in properties
      ? `${modelClass.name}.${identifier}`
      : identifier

    if (isString(arg)) {
      arg = convertIdentifier(arg)
    } else if (isPlainObject(arg)) {
      const converted = {}
      for (const key in arg) {
        converted[convertIdentifier(key)] = arg[key]
      }
      arg = converted
    }
    return method.call(this, arg, ...args)
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
  'clearOrder',
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
  'whereJsonEquals',
  'whereJsonNotEquals',
  'whereJsonSupersetOf',
  'whereJsonNotSupersetOf',
  'whereJsonSubsetOf',
  'whereJsonNotSubsetOf',
  'whereJsonHasAny',
  'whereJsonHasAll',
  'whereJsonField',
  'whereJsonIsArray',
  'whereJsonIsObject'
]
