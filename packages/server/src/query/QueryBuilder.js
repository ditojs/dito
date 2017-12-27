import objection from 'objection'
import { KnexHelper } from '@/mixins'
import { QueryError } from '@/errors'
import PropertyRef from './PropertyRef'
import QueryHandlers from './QueryHandlers'
import QueryFilters from './QueryFilters'
import { isObject, isArray, isString, asArray } from '@/utils'

// This code is based on objection-find, and simplified.
// Instead of a separate class, we extend objection.QueryBuilder to better
// integrate with Objection.js

export default class QueryBuilder extends objection.QueryBuilder {
  constructor(modelClass) {
    super(modelClass)
    this._propertyRefsAllowed = null
    this._propertyRefsCache = {}
    this._applyDefaultEager = true
    this._applyDefaultOrder = true
    this._scopes = []
  }

  clone() {
    const clone = super.clone()
    clone._propertyRefsAllowed = this._propertyRefsAllowed
    clone._propertyRefsCache = this._propertyRefsCache
    clone._applyDefaultEager = this._applyDefaultEager
    clone._applyDefaultOrder = this._applyDefaultOrder
    clone._scopes = this._scopes
    return clone
  }

  execute() {
    // Only apply defaultEager setting if this is a find query, meaning it does
    // not specify any write operations, without any special selects: count()...
    if (this.isFindQuery() && !this.hasSelects()) {
      const { defaultEager, defaultOrder } = this.modelClass()
      if (defaultEager && this._applyDefaultEager) {
        // Use mergeEager() instead of eager(), in case mergeEager() was already
        // called before. Using eager() sets `_applyDefaultEager` to `false`.
        this.mergeEager(defaultEager)
      }
      if (defaultOrder && this._applyDefaultOrder) {
        this.orderBy(...asArray(defaultOrder))
      }
    }
    // Now finally apply the scopes.
    for (const scope of this._scopes) {
      this.applyFilter(scope)
    }
    return super.execute()
  }

  hasSelects() {
    return this.has(QueryBuilder.SelectSelector)
  }

  clearScope() {
    this._scopes = []
    return this
  }

  scope(...scopes) {
    return this.clearScope().mergeScope(...scopes)
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
    // A simple rediret to applyFilter() for the sake of naming consistency.
    return this.applyFilter(...scopes)
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
  upsert(data, opt = {}) {
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
          builder[opt.update ? 'update' : 'patch'](data)
        }
        return result
      })
      .runAfter((result, builder) => {
        if (!builder.context().isMainQuery) {
          return result === 0
            ? mainQuery[opt.fetch ? 'insertAndFetch' : 'insert'](data)
            // We can use the `mainQuery` we saved in runBefore() to fetch the
            // inserted results. It is noteworthy that this query will return
            // the wrong results if the update changed any of the columns the
            // where operates with. This also returns all updated models.
            : mainQuery.first()
        }
        return result
      })
  }

  upsertAndFetch(data, opt) {
    return this.upsert(data, { ...opt, fetch: true })
  }

  insertGraph(data, opt) {
    opt = mergeOptions(insertGraphOptions, opt)
    return super.insertGraph(processGraph(data, opt), opt)
  }

  insertGraphAndFetch(data, opt) {
    opt = mergeOptions(insertGraphOptions, opt)
    return super.insertGraphAndFetch(processGraph(data, opt), opt)
  }

  upsertGraph(data, opt) {
    opt = mergeOptions(upsertGraphOptions, opt)
    return super.upsertGraph(processGraph(data, opt), opt)
  }

  upsertGraphAndFetch(data, opt) {
    opt = mergeOptions(upsertGraphOptions, opt)
    return super.upsertGraphAndFetch(processGraph(data, opt), opt)
  }

  updateGraph(data, opt) {
    opt = mergeOptions(updateGraphOptions, opt)
    return super.upsertGraph(processGraph(data, opt), opt)
  }

  updateGraphAndFetch(data, opt) {
    opt = mergeOptions(updateGraphOptions, opt)
    return super.upsertGraphAndFetch(processGraph(data, opt), opt)
  }

  upsertGraphAndFetchById(id, data, opt) {
    return this.upsertGraphAndFetch(this.addIdProperties(data, id), opt)
  }

  updateGraphAndFetchById(id, data, opt) {
    return this.updateGraphAndFetch(this.addIdProperties(data, id), opt)
  }

  addIdProperties(data, id) {
    const modelClass = this.modelClass()
    const obj = { ...data }
    const ids = asArray(id)
    for (const [index, column] of asArray(modelClass.idColumn).entries()) {
      obj[modelClass.columnNameToPropertyName(column)] = ids[index]
    }
    return obj
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
          throw new QueryError(
            `Invalid query parameter '${key}' in '${key}=${value}'.`)
        }
      } else {
        throw new QueryError(`Query parameter '${key}' is not allowed.`)
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
      throw new QueryError(`Invalid filter in '${key}=${value}'.`)
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
    } else if (isObject(arg)) {
      const converted = {}
      for (const key in arg) {
        converted[convertIdentifier(key)] = arg[key]
      }
      arg = converted
    }
    return method.call(this, arg, ...args)
  }
}

// Change the defaults of insertGraph, upsertGraph and updateGraph
const insertGraphOptions = {
  relate: true,
  dataPath: true
}

const upsertGraphOptions = {
  relate: true,
  unrelate: true,
  insertMissing: true,
  dataPath: true
}

const updateGraphOptions = {
  ...upsertGraphOptions,
  update: true
}

function mergeOptions(defaults, opt) {
  return opt ? { ...defaults, ...opt } : defaults
}

function processGraph(data, opt) {
  // processGraph() handles relate option by detecting Objection isntances in
  // the graph and converting them to shallow id links. For details, see:
  // https://gitter.im/Vincit/objection.js?at=5a4246eeba39a53f1aa3a3b1
  const processRelate = data => {
    if (data) {
      if (data.$isObjectionModel) {
        // Shallow-clone to avoid relations causing problems
        // TODO: Ideally, there would be a switch in Objection that would tell
        // `relate: true` to behave this way with `$isObjectionModel` but still
        // would allow referencing deep models. Check with @koskimas.
        data = data.$clone(true)
      } else if (isArray(data)) {
        data = data.map(entry => processRelate(entry))
      } else if (isObject(data)) {
        const processed = {}
        for (const key in data) {
          processed[key] = processRelate(data[key])
        }
        data = processed
      }
    }
    return data
  }

  return opt.relate ? processRelate(data) : data
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
  'update',
  'relate',
  'patch',
  'upsert',
  'truncate',
  'delete',
  'deleteById',
  'insertAndFetch',
  'updateAndFetch',
  'upsertAndFetch',
  'updateAndFetchById',
  'patchAndFetchById',
  'insertGraph',
  'updateGraph',
  'upsertGraph',
  'insertGraphAndFetch',
  'updateGraphAndFetch',
  'upsertGraphAndFetch',
  'updateGraphAndFetchById',
  'upsertGraphAndFetchById',
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
