import objection from 'objection'
import dbErrors from 'db-errors'
import { QueryBuilder } from '@/query'
import { EventEmitter, KnexHelper } from '@/lib'
import { convertSchema, addRelationSchemas, convertRelations } from '@/schema'
import { populateGraph, filterGraph } from '@/graph'
import {
  ResponseError, DatabaseError, GraphError, ModelError, NotFoundError,
  RelationError, WrappedError
} from '@/errors'
import { mergeReversed } from '@/utils'
import { isObject, isFunction, isPromise, asArray, merge } from '@ditojs/utils'
import RelationAccessor from './RelationAccessor'
import definitionHandlers from './definitions'

export class Model extends objection.Model {
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

  static initialize() {
    // Overridable in sub-classes
    this.setupEmitter(this.definition.hooks)
  }

  $initialize() {
    // Overridable in sub-classes
  }

  get $app() {
    return this.constructor.app
  }

  $is(model) {
    return model?.constructor === this.constructor && model?.id === this.id
  }

  async $update(attributes, trx) {
    if (await this.$query(trx).update(attributes)) {
      this.$set(attributes)
    }
    return this
  }

  async $patch(attributes, trx) {
    if (await this.$query(trx).patch(attributes)) {
      this.$set(attributes)
    }
    return this
  }

  $emit(type, ...args) {
    return this.constructor.emit(type, this, ...args)
  }

  $beforeInsert(queryContext) {
    return this.$emit('before:insert', queryContext)
  }

  $afterInsert(queryContext) {
    return this.$emit('after:insert', queryContext)
  }

  $beforeUpdate(opt, queryContext) {
    return this.$emit('before:update', opt, queryContext)
  }

  $afterUpdate(opt, queryContext) {
    return this.$emit('after:update', opt, queryContext)
  }

  $afterGet(queryContext) {
    return this.$emit('after:get', queryContext)
  }

  $beforeDelete(queryContext) {
    return this.$emit('before:delete', queryContext)
  }

  $afterDelete(queryContext) {
    return this.$emit('after:delete', queryContext)
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
    json = validator.validate(args)
    const handleResult = json => {
      validator.afterValidate(args)
      // If `json` was shallow-cloned, copy over the possible default values.
      return shallow ? inputJson.$set(json) : json
    }
    // Handle both async and sync validation here:
    return isPromise(json)
      ? json.then(json => handleResult(json))
      : handleResult(json)
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
    if (options.skipValidation || !options.async) {
      // Fall back to Objection's fromJson() if we don't need async handling:
      return super.fromJson(json, options)
    }
    // From here on, we only need to handle options.async:
    const model = new this()
    return model.$validate(json, options).then(
      json => model.$setJson(json, {
        ...options,
        skipValidation: true
      })
    )
  }

  // @override
  static query(trx) {
    // See: https://github.com/Vincit/objection-db-errors/blob/e4c91197c9cce18b8492a983640921f9929f4cf1/index.js#L7-L11
    return super.query(trx).onError(err => {
      err = dbErrors.wrapError(err)
      err = err instanceof ResponseError ? err
        : err instanceof dbErrors.DBError ? new DatabaseError(err)
        : new WrappedError(err)
      return Promise.reject(err)
    })
  }

  static async count(...args) {
    const res = await this.query().count(...args).first()
    return res && +res[Object.keys(res)[0]] || 0
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
            JSON.stringify(modelOrId)
          } to ${
            JSON.stringify(idProperties)
          }.`
        )
      }
      const { properties } = this.definition
      idProperties.forEach((key, index) => {
        const id = ids[index]
        if (id !== undefined) {
          const { type } = properties[key]
          // On-the-fly coercion of numeric ids to numbers, so they can pass the
          // model validation in `CollectionController.getMemberId()`
          ref[key] = ['integer', 'number'].includes(type) ? +id : id
        }
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
                '#ref': {
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

  static hasScope(name) {
    return name in this.modifiers
  }

  static get modifiers() {
    // Convert Dito's scopes to Objection's modifiers and cache result.
    return this.getCached('modifiers', () => {
      const modifiers = {}
      for (const [name, scope] of Object.entries(this.definition.scopes)) {
        if (isFunction(scope)) {
          modifiers[name] = scope
        } else {
          throw new ModelError(this, `Invalid scope '${name}': (${scope}).`)
        }
      }
      return modifiers
    })
  }

  static get relationMappings() {
    return this.getCached('relationMappings', () => {
      const { relations } = this.definition
      return relations
        ? convertRelations(this, relations, this.app.models)
        : null
    })
  }

  static get jsonSchema() {
    return this.getCached('jsonSchema', () => {
      const schema = convertSchema(this.definition.properties)
      addRelationSchemas(this, schema.properties)
      // Merge in root-level schema additions
      merge(schema, this.definition.schema)
      return {
        $id: this.name,
        $schema: 'http://json-schema.org/draft-07/schema#',
        ...schema
      }
    })
  }

  static get virtualAttributes() {
    // Leverage Objection's own mechanism called `virtualAttributes` to handle
    // `computedAttributes` when setting JSON data.
    return this.computedAttributes
  }

  static get jsonAttributes() {
    return this.getCached('jsonSchema:jsonAttributes', () => (
      this.getAttributes(({ type, computed }) =>
        !computed && ['object', 'array'].includes(type))
    ), [])
  }

  static get booleanAttributes() {
    return this.getCached('jsonSchema:booleanAttributes', () => (
      this.getAttributes(({ type, computed }) =>
        !computed && type === 'boolean')
    ), [])
  }

  static get dateAttributes() {
    return this.getCached('jsonSchema:dateAttributes', () => (
      this.getAttributes(({ type, computed }) =>
        !computed && ['date', 'datetime', 'timestamp'].includes(type))
    ), [])
  }

  static get computedAttributes() {
    return this.getCached('jsonSchema:computedAttributes', () => (
      this.getAttributes(({ computed }) => computed)
    ), [])
  }

  static get hiddenAttributes() {
    return this.getCached('jsonSchema:hiddenAttributes', () => (
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

  static getCached(identifier, calculate, empty = {}) {
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

  // Assets handling

  getAssetConfig(dataPath) {
    return this.definition.assets?.[dataPath] || null
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
      // Do not call initialize when only patching...
      !options.patch &&
      // ...and only call it when it's actually doing something.
      this.$initialize !== Model.prototype.$initialize
    )
    // Do not call $initialize() on model data that is just a reference.
    const isReference = this.constructor.isReference(json)
    if (options.skipValidation || !callInitialize || isReference) {
      super.$setJson(json, options)
      if (callInitialize && !isReference) {
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
    json = super.$parseDatabaseJson(json)
    const { constructor } = this
    for (const key of constructor.dateAttributes) {
      const date = json[key]
      if (date !== undefined) {
        json[key] = date ? new Date(date) : date
      }
    }
    if (constructor.isSQLite()) {
      // SQLite does not support boolean natively and needs conversion...
      for (const key of constructor.booleanAttributes) {
        const bool = json[key]
        if (bool !== undefined) {
          json[key] = !!bool
        }
      }
    }
    return json
  }

  // @override
  $formatJson(json) {
    json = super.$formatJson(json)
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

  $loadEager(expr, modifiers, trx) {
    return this.constructor.query(trx)
      .findById(this.$id())
      .eager(expr, modifiers)
      .runAfter(result => Object.assign(this, result))
  }

  $filterGraph(graph, expr) {
    return this.constructor.filterGraph(this, expr)
  }

  async $populateGraph(graph, expr, trx) {
    return this.constructor.populateGraph(this, expr, trx)
  }

  static filterGraph(graph, expr) {
    return filterGraph(this, graph, expr)
  }

  static async populateGraph(graph, expr, trx) {
    return populateGraph(this, graph, expr, trx)
  }

  // @override
  static modifierNotFound(builder, modifier) {
    if (modifier[0] === '^') {
      // Apply the unknown scope eagerly, as it may still be known in
      // eager-loaded relations.
      builder.applyScope(modifier)
    } else {
      super.modifierNotFound(builder, modifier)
    }
  }

  // @override
  static createNotFoundError(ctx) {
    return new NotFoundError(ctx.byId
      ? `'${this.name}' model with id ${ctx.byId} not found`
      : `'${this.name}' model not found`)
  }

  // @override
  static createValidator() {
    // Use a shared validator per app, so model schema can reference each other.
    // NOTE: The Dito Validator class creates and manages this shared Objection
    // Validator instance for us, we just need to return it here:
    return this.app.validator
  }

  // @override
  static createValidationError({ type, message, errors, options }) {
    switch (type) {
    case 'ModelValidation':
      return this.app.createValidationError({
        type,
        message: message ||
          `The provided data for the ${this.name} model is not valid`,
        errors,
        options
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
        // values per key, see `definitionHandlers.scopes`.
        const values = []
        while (modelClass !== objection.Model) {
          // Only consider model classes that actually define `name` property.
          if (name in modelClass) {
            // Use reflection through getOwnPropertyDescriptor() to be able to
            // call the getter on `this` rather than on `modelClass`. This can
            // be used to provide abstract base-classes and have them create
            // their relations for `this` inside `get relations()` accessors.
            const desc = Object.getOwnPropertyDescriptor(modelClass, name)
            const value = desc?.get?.call(this) || desc?.value
            if (value) {
              values.push(value)
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
        const handler = definitionHandlers[name]
        const merged = handler
          ? handler.call(this, values)
          : mergeReversed(values)
        // Once calculated, override definition getter with final merged value.
        setDefinition(name, {
          configurable: false,
          value: merged
        })
        return merged
      }

      // If no definition object was defined yet, create one with accessors for
      // each entry in `definitionHandlers`. Each of these getters when called
      // merge definitions up the inheritance chain and store the merged result
      // in `modelClass.definition[name]` for further caching.
      for (const name in definitionHandlers) {
        setDefinition(name, {
          configurable: true,
          get: () => getDefinition(name)
        })
      }
      return definition
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
