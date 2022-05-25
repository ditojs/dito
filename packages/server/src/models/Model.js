import objection from 'objection'
import {
  isString, isObject, isArray, isFunction, isPromise, asArray, merge, flatten,
  parseDataPath, normalizeDataPath, getValueAtDataPath
} from '@ditojs/utils'
import { QueryBuilder } from '../query/index.js'
import { EventEmitter, KnexHelper } from '../lib/index.js'
import {
  convertSchema,
  addRelationSchemas,
  convertRelations
} from '../schema/index.js'
import { populateGraph, filterGraph } from '../graph/index.js'
import { formatJson } from '../utils/index.js'
import {
  ResponseError,
  GraphError, ModelError,
  NotFoundError,
  RelationError,
  WrappedError
} from '../errors/index.js'
import RelationAccessor from './RelationAccessor.js'
import definitions from './definitions/index.js'

export class Model extends objection.Model {
  // Define a default constructor to allow new Model(json) as a short-cut to
  // `Model.fromJson(json, { skipValidation: true })`
  constructor(json) {
    super()
    if (json) {
      this.$setJson(json)
    }
  }

  static setup(knex) {
    this.knex(knex)
    try {
      for (const relation of Object.values(this.getRelations())) {
        this.setupRelation(relation)
      }
    } catch (error) {
      throw error instanceof RelationError ? error : new RelationError(error)
    }
    this.referenceValidator = null
  }

  static setupRelation(relation) {
    // Add this relation to the related model's relatedRelations, so it can
    // register all required foreign keys in its properties.
    relation.relatedModelClass.getRelatedRelations().push(relation)
    // TODO: Check `through` settings to make sure they're correct?

    // Expose RelationAccessor instances for each relation under short-cut $name
    // for access to relations and implicit calls to $relatedQuery(name).
    const accessor = `$${relation.name}`
    if (accessor in this.prototype) {
      throw new RelationError(
        `Model '${this.name}' already defines a property with name ` +
        `'${accessor}' that clashes with the relation accessor.`)
    }

    // Define an accessor on the class as well as on the prototype that when
    // first called creates a RelationAccessor instance and then overrides the
    // accessor with one that then just returns the same value afterwards.
    const defineAccessor = (target, isClass) => {
      Object.defineProperty(target, accessor, {
        get() {
          const value = new RelationAccessor(
            relation,
            isClass ? this : null, // modelClass
            isClass ? null : this // model
          )
          // Override accessor with value on first call for caching.
          Object.defineProperty(this, accessor, {
            value,
            configurable: true,
            enumerable: false
          })
          return value
        },
        configurable: true,
        enumerable: false
      })
    }

    defineAccessor(this, true)
    defineAccessor(this.prototype, false)
  }

  // @overridable
  static initialize() {
    const { hooks, assets } = this.definition
    this._setupEmitter(hooks)
    if (assets) {
      this._setupAssetsEvents(assets)
    }
  }

  // @overridable
  $initialize() {
  }

  get $app() {
    return this.constructor.app
  }

  $is(model) {
    return model?.constructor === this.constructor && model?.id === this.id
  }

  $has(...properties) {
    for (const property of properties) {
      if (!(property in this)) return false
    }
    return true
  }

  $update(properties, trx) {
    return this.$query(trx)
      .update(properties)
      .runAfter((result, query) =>
        // Only perform `$set()` and return `this` if the query wasn't modified
        // in a way that would remove the `update()` command, e.g. toFindQuery()
        query.has('update') ? this.$set(result) : result
      )
  }

  $patch(properties, trx) {
    return this.$query(trx)
      .patch(properties)
      .runAfter((result, query) =>
        // Only perform `$set()` and return `this` if the query wasn't modified
        // in a way that would remove the `patch()` command, e.g. toFindQuery()
        query.has('patch') ? this.$set(result) : result
      )
  }

  // @override
  $transaction(trx, handler) {
    return this.constructor.transaction(trx, handler)
  }

  // @override
  static transaction(trx, handler) {
    // Support both `transaction(trx, handler)` & `transaction(handler)`
    if (!handler) {
      handler = trx
      trx = null
    }
    if (handler) {
      // Use existing transaction, or create new one, to execute handler with:
      return trx
        ? handler(trx)
        : this.knex().transaction(handler)
    } else {
      // No arguments, simply delegate to objection's transaction()
      return super.transaction()
    }
  }

  // @override
  $validate(json, options = {}) {
    if (options.skipValidation) {
      return json
    }
    if (!options.graph && !options.async) {
      // Fall back to Objection's $validate() if we don't need any of our
      // extensions (async and graph for now):
      return super.$validate(json, options)
    }
    json = json || this
    const inputJson = json
    const shallow = json.$isObjectionModel && !options.graph
    if (shallow) {
      // Strip away relations and other internal stuff.
      json = json.clone({ shallow: true })
      // We can mutate `json` now that we took a copy of it.
      options = { ...options, mutable: true }
    }

    const validator = this.constructor.getValidator()
    const args = {
      options,
      model: this,
      json,
      ctx: Object.create(null)
    }

    validator.beforeValidate(args)
    const result = validator.validate(args)
    const handleResult = result => {
      validator.afterValidate(args)
      // If `json` was shallow-cloned, copy over the possible default values.
      return shallow ? inputJson.$set(result) : result
    }
    // Handle both async and sync validation here:
    return isPromise(result)
      ? result.then(handleResult)
      : handleResult(result)
  }

  async $validateGraph(options = {}) {
    await this.$validate(null, {
      ...options,
      graph: true,
      // Always use `async: true` option here for simplicity:
      async: true
    })
    return this
  }

  // @override
  static fromJson(json, options = {}) {
    if (options.async && !options.skipValidation) {
      // Handle async validation, as supported by Dito:
      const model = new this()
      return model.$validate(json, options).then(
        json => model.$setJson(json, {
          ...options,
          skipValidation: true
        })
      )
    }
    // Fall back to Objection's fromJson() if we don't need async handling:
    return super.fromJson(json, options)
  }

  // @override
  static query(trx) {
    return super.query(trx).onError(err => {
      // TODO: Shouldn't this wrapping happen on the Controller level?
      err = err instanceof ResponseError ? err
        : err instanceof objection.DBError ? this.app.createDatabaseError(err)
        : new WrappedError(err)
      return Promise.reject(err)
    })
  }

  static async count(...args) {
    const { count } = await this.query().count(...args).first() || {}
    return +count || 0
  }

  // @override
  static get tableName() {
    // If the class name ends in 'Model', remove that from the table name.
    return this.name.match(/^(.*?)(?:Model|)$/)[1]
  }

  // @override
  static get idColumn() {
    // Try extracting the id column name from the raw properties definitions,
    // not the resolved `definition.properties` which aren't ready at this point
    // with fall-back onto default Objection.js behavior.
    const { properties } = this
    const ids = []
    for (const [name, property] of Object.entries(properties || {})) {
      if (property?.primary) {
        ids.push(name)
      }
    }
    const { length } = ids
    return length > 1 ? ids : length > 0 ? ids[0] : super.idColumn
  }

  static getReference(modelOrId, includeProperties) {
    // Creates a reference model that takes over the id / #ref properties from
    // the passed model or id value/array, omitting any other properties in it,
    // except for anything mentioned in the optional `includeProperties` arg.
    const ref = new this()
    const idProperties = this.getIdPropertyArray()
    if (isObject(modelOrId)) {
      const addProperty = key => {
        const value = modelOrId[key]
        if (value !== undefined) {
          ref[key] = value
        }
      }
      // Also support Objection's #ref type references next to id properties.
      addProperty(this.uidRefProp)
      idProperties.forEach(addProperty)
      includeProperties?.forEach(addProperty)
    } else {
      // An id value/array: Map it to the properties in `getIdPropertyArray()`:
      const ids = asArray(modelOrId)
      if (ids.length !== idProperties.length) {
        throw new ModelError(
          this,
          `Invalid amount of id values provided for reference: Unable to map ${
            formatJson(modelOrId, false)
          } to ${
            formatJson(idProperties, false)
          }.`
        )
      }
      idProperties.forEach((key, index) => {
        ref[key] = ids[index]
      })
    }
    return ref
  }

  static isReference(obj) {
    let validator = this.referenceValidator
    if (!validator) {
      // For `data` to be considered a reference, it needs to hold only one
      // value that is either the target's id, or an Objection.js #ref value:
      validator = this.referenceValidator = this.app.compileValidator(
        {
          oneOf: [
            {
              type: 'object',
              // Support composite keys and add a property for each key:
              properties: this.getIdPropertyArray().reduce(
                (idProperties, idProperty) => {
                  idProperties[idProperty] = {
                    type: this.definition.properties[idProperty].type
                  }
                  return idProperties
                },
                {}
              ),
              additionalProperties: false
            },
            {
              type: 'object',
              properties: {
                [this.uidRefProp]: {
                  type: 'string'
                }
              },
              additionalProperties: false
            }
          ]
        },
        // Receive `false` instead of thrown exceptions when validation fails:
        { throw: false }
      )
    }
    return validator(obj)
  }

  static getScope(name) {
    return this.definition.scopes[name]
  }

  static hasScope(name) {
    return !!this.getScope(name)
  }

  static getModifiers() {
    return this.definition.modifiers
  }

  static get relationMappings() {
    return this._getCached('relationMappings', () => (
      convertRelations(this, this.definition.relations, this.app.models)
    ), {})
  }

  static get jsonSchema() {
    return this._getCached('jsonSchema', () => {
      const schema = convertSchema({
        type: 'object',
        properties: this.definition.properties
      })
      addRelationSchemas(this, schema.properties)
      // Merge in root-level schema additions
      merge(schema, this.definition.schema)
      return {
        $id: this.name,
        ...schema
      }
    }, {})
  }

  static get virtualAttributes() {
    // Leverage Objection's own mechanism called `virtualAttributes` to handle
    // `computedAttributes` when setting JSON data.
    return this.computedAttributes
  }

  static get jsonAttributes() {
    return this._getCached('jsonSchema:jsonAttributes', () => (
      this.getAttributes(({ type, specificType, computed }) =>
        !computed && !specificType && (type === 'object' || type === 'array'))
    ), [])
  }

  static get booleanAttributes() {
    return this._getCached('jsonSchema:booleanAttributes', () => (
      this.getAttributes(({ type, computed }) =>
        !computed && type === 'boolean')
    ), [])
  }

  static get dateAttributes() {
    return this._getCached('jsonSchema:dateAttributes', () => (
      this.getAttributes(({ type, computed }) =>
        !computed && ['date', 'datetime', 'timestamp'].includes(type))
    ), [])
  }

  static get computedAttributes() {
    return this._getCached('jsonSchema:computedAttributes', () => (
      this.getAttributes(({ computed }) => computed)
    ), [])
  }

  static get hiddenAttributes() {
    return this._getCached('jsonSchema:hiddenAttributes', () => (
      this.getAttributes(({ hidden }) => hidden)
    ), [])
  }

  static getAttributes(filter) {
    const attributes = []
    const { properties } = this.definition
    for (const [name, property] of Object.entries(properties)) {
      if (filter(property)) {
        attributes.push(name)
      }
    }
    return attributes
  }

  static _getCached(identifier, calculate, empty = {}) {
    let cache = getMeta(this, 'cache', {})
    // Use a simple dependency tracking mechanism with cache identifiers that
    // can be children of other cached values, e.g.:
    // 'jsonSchema:jsonAttributes' as a child of 'jsonSchema', so that whenever
    // 'jsonSchema' changes, all cached child values  are invalidated.
    let entry
    for (const part of identifier.split(':')) {
      entry = cache[part] = cache[part] || {
        cache: {},
        value: undefined
      }
      cache = entry.cache
    }
    if (entry?.value === undefined) {
      // Temporarily set cache to an empty object to prevent endless
      // recursion with interdependent jsonSchema related calls...
      entry.value = empty
      entry.value = calculate()
      // Clear child dependencies once parent value has changed:
      entry.cache = {}
    }
    return entry?.value
  }

  static getRelatedRelations() {
    return getMeta(this, 'relatedRelations', [])
  }

  // Override propertyNameToColumnName() / columnNameToPropertyName() to not
  // rely on $formatDatabaseJson() /  $parseDatabaseJson() do detect naming
  // conventions but assume simply that they're always the same.
  // This is fine since we can now change naming at Knex level.
  // See knexSnakeCaseMappers()

  // @override
  static propertyNameToColumnName(propertyName) {
    return propertyName
  }

  // @override
  static columnNameToPropertyName(columnName) {
    return columnName
  }

  // @override
  $setJson(json, options) {
    options = options || {}
    const callInitialize = (
      // Only call initialize when:
      // 1. we're not partially patching:
      !options.patch &&
      // 2. $initialize() is actually doing something:
      this.$initialize !== Model.prototype.$initialize &&
      // 3. the data is not just a reference:
      !this.constructor.isReference(json)
    )
    if (!callInitialize || options.skipValidation) {
      super.$setJson(json, options)
      if (callInitialize) {
        this.$initialize()
      }
    } else {
      // If validation isn't skipped or the model provides its own $initialize()
      // method, call $setJson() with patch validation first to not complain
      // about missing fields, then perform a full validation after calling
      // $initialize(), to give the model a chance to configure itself.
      super.$setJson(json, { ...options, patch: true })
      this.$initialize()
      this.$validate(this, options)
    }
    return this
  }

  // @override
  $formatDatabaseJson(json) {
    const { constructor } = this
    for (const key of constructor.dateAttributes) {
      const date = json[key]
      if (date?.toISOString) {
        json[key] = date.toISOString()
      }
    }
    if (constructor.isSQLite()) {
      // SQLite does not support boolean natively and needs conversion...
      for (const key of constructor.booleanAttributes) {
        const bool = json[key]
        if (bool !== undefined) {
          json[key] = bool ? 1 : 0
        }
      }
    }
    // Remove the computed properties so they don't attempt to get set.
    for (const key of constructor.computedAttributes) {
      delete json[key]
    }
    // NOTE: No need to normalize the identifiers in the JSON in case of
    // normalizeDbNames, as this already happens through
    // knex.config.wrapIdentifier(), see Application.js
    return super.$formatDatabaseJson(json)
  }

  // @override
  $parseDatabaseJson(json) {
    const { constructor } = this
    json = super.$parseDatabaseJson(json)
    if (constructor.isSQLite()) {
      // SQLite does not support boolean natively and needs conversion...
      for (const key of constructor.booleanAttributes) {
        const bool = json[key]
        if (bool !== undefined) {
          json[key] = !!bool
        }
      }
    }
    // Also run through normal $parseJson(), for handling of `Date` and
    // `AssetFile`.
    return this.$parseJson(json)
  }

  // @override
  $parseJson(json) {
    const { constructor } = this
    for (const key of constructor.dateAttributes) {
      const date = json[key]
      if (date !== undefined) {
        json[key] = isString(date) ? new Date(date) : date
      }
    }
    // Convert plain asset files objects to AssetFile instances with references
    // to the linked storage.
    const { assets } = constructor.definition
    if (assets) {
      for (const dataPath in assets) {
        const storage = constructor.app.getStorage(assets[dataPath].storage)
        const data = getValueAtDataPath(json, dataPath, () => null)
        if (data) {
          const convertToAssetFiles = data => {
            if (data) {
              if (isArray(data)) {
                data.forEach(convertToAssetFiles)
              } else {
                storage.convertAssetFile(data)
              }
            }
          }
          convertToAssetFiles(data)
        }
      }
    }
    return json
  }

  // @override
  $formatJson(json) {
    const { constructor } = this
    // Calculate and set the computed properties.
    for (const key of constructor.computedAttributes) {
      // Perhaps the computed property is produced in the SQL statement,
      // in which case we don't have to do anything anymore here.
      if (!(key in json)) {
        const value = this[key]
        if (value !== undefined) {
          json[key] = value
        }
      }
    }
    // Remove hidden attributes.
    for (const key of constructor.hiddenAttributes) {
      delete json[key]
    }
    return json
  }

  // Graph handling

  $filterGraph(modelGraph, expr) {
    return filterGraph(this.constructor, modelGraph, expr)
  }

  async $populateGraph(modelGraph, expr, trx) {
    return populateGraph(this.constructor, modelGraph, expr, trx)
  }

  static filterGraph(modelGraph, expr) {
    return filterGraph(this, modelGraph, expr)
  }

  static async populateGraph(modelGraph, expr, trx) {
    return populateGraph(this, modelGraph, expr, trx)
  }

  static getPropertyOrRelationAtDataPath(dataPath) {
    // Finds the property or relation at the given the dataPath of the model by
    // parsing the dataPath and matching it to its relations and properties.
    const parsedDataPath = parseDataPath(dataPath)
    let index = 0

    const getResult = (property = null, relation = null) => {
      const found = property || relation
      const name = parsedDataPath[index]
      const next = index + 1
      const dataPath = found
        ? normalizeDataPath(parsedDataPath.slice(0, next))
        : null
      const nestedDataPath = found
        ? normalizeDataPath(parsedDataPath.slice(next))
        : null
      const expression = found
        ? parsedDataPath.slice(0, relation ? next : index).join('.') +
          (property ? `(#${name})` : '')
        : null
      return {
        property,
        relation,
        dataPath,
        nestedDataPath,
        name,
        expression,
        index
      }
    }

    const [firstToken, ...otherTokens] = parsedDataPath
    const property = this.definition.properties[firstToken]
    if (property) {
      return getResult(property)
    } else {
      let relation = this.getRelations()[firstToken]
      if (relation) {
        let { relatedModelClass } = relation
        for (const token of otherTokens) {
          index++
          const property = relatedModelClass.definition.properties[token]
          if (property) {
            return getResult(property)
          } else if (token === '*') {
            if (relation.isOneToOne()) {
              // Do not support wildcards on one-to-one relations:
              return getResult()
            } else {
              continue
            }
          } else {
            // Found a relation? Keep iterating.
            relation = relatedModelClass.getRelations()[token]
            if (relation) {
              relatedModelClass = relation.relatedModelClass
            } else {
              return getResult()
            }
          }
        }
        if (relation) {
          // Still here? Found a relation at the end of the data-path.
          return getResult(null, relation)
        }
      }
    }
    return getResult()
  }

  // @override
  static relatedQuery(relationName, trx) {
    // https://github.com/Vincit/objection.js/issues/1720
    return super.relatedQuery(relationName, trx).alias(relationName)
  }

  // @override
  static modifierNotFound(query, modifier) {
    if (isString(modifier)) {
      if (query.modelClass().hasScope(modifier)) {
        return query.applyScope(modifier)
      }
      // Now check possible scope prefixes and handle them:
      switch (modifier[0]) {
      case '^': // Eager-applied scope:
        // Always apply eager-scopes, even if the model itself doesn't know it.
        // The scope may still be known in eager-loaded relations.
        // Note: `applyScope()` will handle the '^' sign.
        return query.applyScope(modifier)
      case '-': // Ignore scope:
        return query.ignoreScope(modifier.slice(1))
      case '#': // Select column:
        return query.select(modifier.slice(1))
      }
    }
    super.modifierNotFound(query, modifier)
  }

  // @override
  static createNotFoundError(ctx, error) {
    return new NotFoundError(
      error || (
        ctx.byId
          ? `'${this.name}' model with id ${ctx.byId} not found`
          : `'${this.name}' model not found`
      )
    )
  }

  // @override
  static createValidator() {
    // Use a shared validator per app, so model schema can reference each other.
    // NOTE: The Dito Validator class creates and manages this shared Objection
    // Validator instance for us, we just need to return it here:
    return this.app.validator
  }

  // @override
  static createValidationError({ type, message, errors, options, json }) {
    switch (type) {
    case 'ModelValidation':
      return this.app.createValidationError({
        type,
        message:
          message || `The provided data for the ${this.name} model is not valid`,
        errors,
        options,
        json
      })
    case 'RelationExpression':
    case 'UnallowedRelation':
      return new RelationError({ type, message, errors })
    case 'InvalidGraph':
      return new GraphError({ type, message, errors })
    default:
      return new ResponseError({ type, message, errors })
    }
  }

  // @override
  static QueryBuilder = QueryBuilder

  // https://vincit.github.io/objection.js/api/model/static-properties.html#static-cloneobjectattributes
  static cloneObjectAttributes = false

  // Only pick properties for database JSON that is mentioned in the schema.
  static pickJsonSchemaProperties = true

  // See https://gitter.im/Vincit/objection.js?at=5a81f859ce68c3bc7479d65a
  static useLimitInFirst = true

  static get definition() {
    // Check if we already have a definition object for this class and return it
    return getMeta(this, 'definition', () => {
      const definition = {}

      const setDefinition = (name, property) => {
        Object.defineProperty(definition, name, {
          ...property,
          enumerable: true
        })
      }

      const getDefinition = name => {
        let modelClass = this
        // Collect ancestor values for proper inheritance.
        // NOTE: values are collected in sequence of inheritance, from sub-class
        // to super-class. To go from super-class to sub-class when merging,
        // `mergeReversed()` is used to prevent wrong overrides.
        // `mergeAsReversedArrays()` can be used to keep arrays of inherited
        // values per key, see `definitions.hooks`.
        const values = []
        while (modelClass !== objection.Model) {
          // Only consider model classes that actually define `name` property.
          if (name in modelClass) {
            // Use reflection through getOwnPropertyDescriptor() to be able to
            // call the getter on `this` rather than on `modelClass`. This can
            // be used to provide abstract base-classes and have them create
            // their relations for `this` inside `get relations()` accessors.
            const desc = Object.getOwnPropertyDescriptor(modelClass, name)
            if (desc) {
              const value = desc.get?.call(this) || desc.value
              if (value) {
                values.push(value)
              }
            }
          }
          modelClass = Object.getPrototypeOf(modelClass)
        }
        // To prevent endless recursion with interdependent calls related to
        // properties, override definition before calling handler():
        setDefinition(name, {
          configurable: true,
          value: {}
        })
        try {
          const merged = definitions[name].call(this, values)
          // Once calculated, override getter with final merged value.
          setDefinition(name, {
            configurable: false,
            value: merged
          })
          return merged
        } catch (error) {
          throw new ModelError(this, error.message)
        }
      }

      // If no definition object was defined yet, create one with accessors for
      // each entry in `definitions`. Each of these getters when called merge
      // definitions up the inheritance chain and store the merged result in
      // `modelClass.definition[name]` for further caching.
      for (const name in definitions) {
        setDefinition(name, {
          configurable: true,
          get: () => getDefinition(name)
        })
      }
      return definition
    })
  }

  // Hooks

  $emit(event, ...args) {
    return this.constructor.emit(event, this, ...args)
  }

  static beforeFind(args) {
    return this._emitStaticHook('before:find', args)
  }

  static afterFind(args) {
    return this._emitStaticHook('after:find', args)
  }

  static beforeInsert(args) {
    return this._emitStaticHook('before:insert', args)
  }

  static afterInsert(args) {
    return this._emitStaticHook('after:insert', args)
  }

  static beforeUpdate(args) {
    return this._emitStaticHook('before:update', args)
  }

  static afterUpdate(args) {
    return this._emitStaticHook('after:update', args)
  }

  static beforeDelete(args) {
    return this._emitStaticHook('before:delete', args)
  }

  static afterDelete(args) {
    return this._emitStaticHook('after:delete', args)
  }

  static async _emitStaticHook(event, originalArgs) {
    const listeners = this.listeners(event)
    if (listeners.length > 0) {
      // Static hooks are emitted in sequence (but each event can be async), and
      // results are passed through and returned in the end.
      let { result } = originalArgs
      // The result of any event handler will override `args.result` in the call
      // of the next handler in sequence. As `StaticHookArguments` in Objection
      // is private, use a JS inheritance trick here to override `args.result`:
      const args = Object.create(originalArgs, {
        type: {
          value: event
        },
        result: {
          get() {
            return result
          }
        }
      })
      for (const listener of listeners) {
        const res = await listener.call(this, args)
        if (res !== undefined) {
          result = res
        }
      }
      // Unfortunately `result` is always an array, even when the actual result
      // is a model object. Avoid returning it when it's not actually changed.
      // See: https://github.com/Vincit/objection.js/issues/1842
      if (result !== originalArgs.result) {
        return result
      }
    }
  }

  // Assets handling

  static _setupAssetsEvents(assets) {
    const assetDataPaths = Object.keys(assets)

    this.on([
      'before:insert',
      'before:update',
      'before:delete'
    ], async ({ type, transaction, inputItems, asFindQuery }) => {
      const afterItems = type === 'before:delete'
        ? []
        : inputItems
      // Figure out which asset data paths where actually present in the
      // submitted data, and only compare these. But when deleting, use all.
      const dataPaths = afterItems.length > 0
        ? assetDataPaths.filter(
          path => getValueAtAssetDataPath(afterItems[0], path) !== undefined
        )
        : assetDataPaths

      // `dataPaths` is empty in the case of an update/insert that does not
      // affect the assets.
      if (dataPaths.length === 0) return

      // Load the model's asset files in their current state before the query is
      // executed.
      const beforeItems = type === 'before:insert'
        ? []
        : await loadAssetDataPaths(asFindQuery(), dataPaths)
      const beforeFilesPerDataPath = getFilesPerAssetDataPath(
        beforeItems,
        dataPaths
      )
      const afterFilesPerDataPath = getFilesPerAssetDataPath(
        afterItems,
        dataPaths
      )

      const importedFiles = []
      const modifiedFiles = []

      if (transaction.rollback) {
        // Prevent wrong memory leak error messages when installing more than 10
        // 'rollback' handlers, which can happen with more complex queries.
        transaction.setMaxListeners(0)
        transaction.on('rollback', async error => {
          if (importedFiles.length > 0) {
            console.info(
              `Received '${error}', removing imported files again: ${
                importedFiles.map(file => `'${file.name}'`)
              }`
            )
            await Promise.all(
              importedFiles.map(
                file => file.storage.removeFile(file)
              )
            )
          }
          if (modifiedFiles.length > 0) {
            // TODO: `modifiedFiles` should be restored as well, but that's far
            // from trivial since no backup is kept in `handleModifiedAssets`
            console.warn(
              `Unable to restore these already modified files: ${
                modifiedFiles.map(file => `'${file.name}'`)
              }`
            )
          }
        })
      }

      for (const dataPath of dataPaths) {
        const storage = this.app.getStorage(assets[dataPath].storage)
        const beforeFiles = beforeFilesPerDataPath[dataPath] || []
        const afterFiles = afterFilesPerDataPath[dataPath] || []
        const beforeByKey = mapFilesByKey(beforeFiles)
        const afterByKey = mapFilesByKey(afterFiles)
        const removedFiles = beforeFiles.filter(file => !afterByKey[file.key])
        const addedFiles = afterFiles.filter(file => !beforeByKey[file.key])
        // Also handle modified files, which are files where the data property
        // is changed before update / patch, meanting the file is changed.
        // NOTE: This will change the content for all the references to it,
        // and thus should only really be used when there's only one reference.
        const modifiedFiles = afterFiles.filter(
          file => file.data && beforeByKey[file.key]
        )
        importedFiles.push(
          ...await this.app.handleAdddedAndRemovedAssets(
            storage,
            addedFiles,
            removedFiles,
            transaction
          )
        )
        modifiedFiles.push(
          ...await this.app.handleModifiedAssets(
            storage,
            modifiedFiles,
            transaction
          )
        )
      }
    })
  }
}

EventEmitter.mixin(Model)
KnexHelper.mixin(Model)
// Expose a selection of QueryBuilder methods as static methods on model classes
QueryBuilder.mixin(Model)

const metaMap = new WeakMap()

function getMeta(modelClass, key, value) {
  let meta = metaMap.get(modelClass)
  if (!meta) {
    metaMap.set(modelClass, meta = {})
  }
  if (!(key in meta)) {
    meta[key] = isFunction(value) ? value() : value
  }
  return meta[key]
}

function loadAssetDataPaths(query, dataPaths) {
  return dataPaths.reduce(
    (query, dataPath) => query.loadDataPath(dataPath),
    query
  )
}

function getValueAtAssetDataPath(item, path) {
  return getValueAtDataPath(item, path, () => undefined)
}

function getFilesPerAssetDataPath(items, dataPaths) {
  return dataPaths.reduce(
    (allFiles, dataPath) => {
      allFiles[dataPath] = asArray(items).reduce(
        (files, item) => {
          const data = asArray(getValueAtAssetDataPath(item, dataPath))
          // Use flatten() as dataPath may contain wildcards, resulting in
          // nested files arrays.
          files.push(...flatten(data).filter(file => !!file))
          return files
        },
        []
      )
      return allFiles
    },
    {}
  )
}

function mapFilesByKey(files) {
  return files.reduce(
    (map, file) => {
      map[file.key] = file
      return map
    },
    {}
  )
}
