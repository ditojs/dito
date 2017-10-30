import objection from 'objection'
import util from 'util'
import { isObject, isArray, isString, deepMerge } from '@/utils'
import { ValidationError } from '@/errors'
import { QueryBuilder } from '@/query'
import { EventEmitter } from '@/events'
import { convertSchema, convertRelations } from '@/schema'
import ModelRelation from './ModelRelation'

export default class Model extends objection.Model {
  static async count(...args) {
    const res = await this.query().count(...args).first()
    return res && +res[Object.keys(res)[0]] || 0
  }

  async $update(attributes) {
    const updated = await this.$query().update(attributes)
    // Clear the changes for the attributes that were just persisted and set.
    return clearChanges(this.$set(updated, true), updated)
  }

  async $patch(attributes) {
    const patched = await this.$query().patch(attributes)
    // Clear the changes for the attributes that were just persisted and set.
    return clearChanges(this.$set(patched, true), patched)
  }

  $setDatabaseJson(json) {
    // Clear all changes when setting data directly from the database.
    return clearChanges(super.$setDatabaseJson(json))
  }

  $getChanges() {
    const instance = instanceMap.get(this)
    return instance && Object.keys(instance.changes)
  }

  $isModified() {
    const changes = this.$getChanges()
    return changes ? changes.length > 0 : false
  }

  async $store() {
    const instance = instanceMap.get(this)
    const changes = instance && instance.changes
    if (changes) {
      // Collect all changed values in a patch object.
      const attributes = {}
      for (const name in changes) {
        attributes[name] = instance.values[name]
      }
      if (await this.$query().patch(attributes)) {
        instance.changes = {} // clear changes
        return true
      }
    }
    return false
  }

  get $app() {
    return this.constructor.app
  }

  static initialize() {
    for (const relation of Object.values(this.getRelations())) {
      this.checkRelation(relation)
      this.addRelationAccessor(relation)
    }
    // Install accessors with change-tracking for all database properties.
    const { properties } = this.definition
    for (const [name, { computed }] of Object.entries(properties)) {
      if (!computed) {
        this.addPropertyAccessor(name)
      }
    }
    this.getValidator().precompileModel(this)
    // Install all events listed in the static events object.
    this.installEvents(this.definition.events)
    console.log(`${this.name}:\n`,
      util.inspect(this.jsonSchema, {
        colors: true,
        depth: null,
        maxArrayLength: null
      }))
  }

  static addPropertyAccessor(name) {
    function get() {
      const instance = instanceMap.get(this)
      return instance && instance.values[name]
    }

    function set(value) {
      // We only need to create an instance object once actual values are
      // getting set. Until then, returning undefined is the expected behavior.
      let instance = instanceMap.get(this)
      if (!instance) {
        // Set up an instance object for this model, keeping track of values
        // as well as changes for this instance.
        instanceMap.set(this, instance = {
          values: {},
          changes: {}
        })
      }
      // Store the value and keep track of what changed.
      instance.values[name] = value
      instance.changes[name] = true
    }

    // At first, the accessor is defined on the prototype, so al instances
    // inherit them automatically. But once a value gets set, we need to set
    // the enumerable accessor property directly on the instance, so that its
    // value will get picked by the internal mechanisms.
    Object.defineProperty(this.prototype, name, {
      get() {}, // It isn't set, so no need to return anything yet
      set(value) {
        set.call(this, value)
        Object.defineProperty(this, name, {
          get,
          set,
          configurable: true,
          enumerable: true
        })
      },
      configurable: true,
      enumerable: true
    })
  }

  static addRelationAccessor(relation) {
    // Expose ModelRelation instances for each relation under short-cut $name,
    // for access to relations and implicit calls to $relatedQuery(name).
    const accessor = `$${relation.name}`
    if (accessor in this.prototype) {
      throw new Error(
        `Model "${this.name}" already defines a property with name ` +
        `"${accessor}" that clashes with the relation accessor.`)
    }
    // Define an accessor on the prototype that when first called creates the
    // modelRelation and defines another accessor on the instance that then
    // just returns the same modelRelation afterwards.
    Object.defineProperty(this.prototype, accessor, {
      get() {
        const modelRelation = new ModelRelation(this, relation)
        Object.defineProperty(this, accessor, {
          value: modelRelation,
          configurable: true,
          enumerable: true
        })
        return modelRelation
      },
      configurable: true,
      enumerable: true
    })
  }

  static installEvents(events = {}) {
    for (const [event, handler] of Object.entries(events)) {
      this.on(event, handler)
    }
  }

  static get tableName() {
    const knex = this.knex()
    return knex && knex.normalizeIdentifier
      ? knex.normalizeIdentifier(this.name)
      : this.name
  }

  static get idColumn() {
    const { properties = {} } = this.definition
    const ids = []
    for (const [name, property] of Object.entries(properties)) {
      if (property.primary) {
        ids.push(this.propertyNameToColumnName(name))
      }
    }
    const { length } = ids
    return length > 1 ? ids : length > 0 ? ids[0] : super.idColumn
  }

  static get namedFilters() {
    return this.definition.scopes
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
      const { properties } = this.definition
      return properties ? {
        id: this.name,
        $schema: 'http://json-schema.org/draft-06/schema#',
        ...convertSchema(properties)
      } : null
    })
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

  static getAttributes(filter) {
    const attributes = []
    const { properties = {} } = this.definition
    for (const [name, property] of Object.entries(properties)) {
      if (filter(property)) {
        attributes.push(name)
      }
    }
    return attributes
  }

  static getCached(identifier, calculate, empty = {}) {
    if (!cacheMap.has(this)) {
      cacheMap.set(this, {})
    }
    let cache = cacheMap.get(this)
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
    if (entry && entry.value === undefined) {
      // Temporarily set cache to an empty object to prevent endless
      // recursion with interdependent jsonSchema related calls...
      entry.value = empty
      entry.value = calculate()
      // Clear child dependencies once parent value has changed:
      entry.cache = {}
    }
    return entry && entry.value
  }

  static checkRelation(relation) {
    // Make sure all relations are defined correctly, with back-references.
    const { relatedModelClass } = relation
    const relatedProperties = relatedModelClass.definition.properties || {}
    for (const property of relation.relatedProp.props) {
      if (!(property in relatedProperties)) {
        throw new Error(
          `Model "${relatedModelClass.name}" is missing back-reference ` +
          `"${property}" for relation "${this.name}.${relation.name}"`)
      }
    }
    // TODO: Check `through` settings also
  }

  // Override propertyNameToColumnName() / columnNameToPropertyName() to not
  // rely on $formatDatabaseJson() /  $parseDatabaseJson() do detect naming
  // conventions but instead rely directly on our added infrastructure in
  // normalizeIdentifier() / denormalizeIdentifier().
  // This is only necessary to avoid problems of circular referencing when
  // handling definitions, because $formatDatabaseJson accesses dateAttributes,
  // booleanAttributes and co, which in turn access jsonSchema, which in turn
  // access getRelations(), which my trigger calls to propertyNameToColumnName()
  // on other model classes when resolving references.

  static propertyNameToColumnName(propertyName) {
    const knex = this.knex()
    return knex && knex.normalizeIdentifier
      ? knex.normalizeIdentifier(propertyName)
      : propertyName
  }

  static columnNameToPropertyName(columnName) {
    const knex = this.knex()
    return knex && knex.denormalizeIdentifier
      ? knex.denormalizeIdentifier(columnName)
      : columnName
  }

  $formatDatabaseJson(json) {
    const { constructor } = this
    const knex = constructor.knex()
    for (const key of constructor.dateAttributes) {
      const date = json[key]
      if (date !== undefined) {
        json[key] = date && date.toISOString ? date.toISOString() : date
      }
    }
    if (knex && knex.isSQLite) {
      //  SQLite needs boolean conversion...
      for (const key of constructor.booleanAttributes) {
        const bool = json[key]
        if (bool !== undefined) {
          json[key] = bool ? 1 : 0
        }
      }
    }
    // NOTE: No need to normalize the identifiers in the JSON in case of
    // normalizeDbNames, as this already happens through
    // knex.config.wrapIdentifier(), see App.js
    return super.$formatDatabaseJson(json)
  }

  $parseDatabaseJson(json) {
    json = super.$parseDatabaseJson(json)
    const { constructor } = this
    const knex = constructor.knex()
    // NOTE: Demoralization of identifiers is still our own business:
    if (knex && knex.denormalizeIdentifier) {
      const converted = {}
      for (const key in json) {
        converted[knex.denormalizeIdentifier(key)] = json[key]
      }
      json = converted
    }
    for (const key of constructor.dateAttributes) {
      const date = json[key]
      if (date !== undefined) {
        json[key] = date ? new Date(date) : date
      }
    }
    if (knex && knex.isSQLite) {
      //  SQLite needs boolean conversion...
      for (const key of constructor.booleanAttributes) {
        const bool = json[key]
        if (bool !== undefined) {
          json[key] = !!bool
        }
      }
    }
    return this.$parseJson(json)
  }

  $parseJson(json) {
    // Remove the computed properties so they don't get set.
    for (const key of this.constructor.computedAttributes) {
      delete json[key]
    }
    return json
  }

  $formatJson(json) {
    json = super.$formatJson(json)
    const { constructor } = this
    // Calculate and set the computed properties.
    for (const key of constructor.computedAttributes) {
      json[key] = this[key]
    }
    for (const key of constructor.definition.hidden || []) {
      delete json[key]
    }
    return json
  }

  static createValidator() {
    // Use a shared validator per app, so model schema can reference each other.
    return this.app.validator
  }

  static compileValidator(jsonSchema, skipRequired) {
    return this.getValidator().compileValidator(jsonSchema, skipRequired)
  }

  static createValidationError(errors,
    message = `The provided data for the ${this.name} instance is not valid`
  ) {
    return new this.ValidationError({ message, errors })
  }

  static ValidationError = ValidationError
  static QueryBuilder = QueryBuilder

  // Only pick properties for database JSON that is mentioned in the schema.
  static pickJsonSchemaProperties = true

  static get definition() {
    // Check if we already have a definition object for this class and return it
    let definition = definitionMap.get(this)
    if (definition) return definition
    definitionMap.set(this, definition = {})

    // If no definition object was defined yet, create one with accessors for
    // each entry in `definitionHandlers`. Each of these getters when called
    // merge definitions up the inheritance chain and store the merged result
    // in `modelClass.definition[name]` for further caching.
    const getDefinition = name => {
      let merged
      let modelClass = this
      const handler = definitionHandlers[name]
      // Collect ancestors in reverse sequence for correct inheritance.
      const sequence = []
      while (modelClass !== objection.Model) {
        // Only consider model classes that actually define `name` property.
        if (name in modelClass) {
          sequence.unshift(modelClass)
        }
        modelClass = Object.getPrototypeOf(modelClass)
      }
      for (const modelClass of sequence) {
        // Use reflection through getOwnPropertyDescriptor() to be able to
        // call the getter on `this` rather than on `modelClass`. This can be
        // used to provide abstract base-classes and have them create their
        // relations for `this` inside `get relations`.
        const { get, value } = Object.getOwnPropertyDescriptor(
          modelClass, name) || {}
        const val = get ? get.call(this) : value
        if (val) {
          merged = deepMerge(merged || (name === 'hidden' ? [] : {}), val)
        }
      }
      // Once calculated, override definition getter with merged value
      if (handler && merged) {
        // Override definition before calling handler(), to prevent endless
        // recursion with interdependent definition related calls...
        setDefinition(name, { value: merged }, true)
        merged = handler.call(this, merged) || merged
        // NOTE: Now that it changed, setDefinition() is called once more below.
      }
      if (merged) {
        setDefinition(name, { value: merged }, false)
      } else {
        delete definition[name]
      }
      return merged
    }

    const setDefinition = (name, property, configurable) => {
      Object.defineProperty(definition, name, {
        ...property,
        configurable,
        enumerable: true
      })
    }

    for (const name in definitionHandlers) {
      setDefinition(name, { get: () => getDefinition(name) }, true)
    }
    return definition
  }
}

EventEmitter.deferred(Model)
// Expose a selection of QueryBuilder methods as static methods on model classes
QueryBuilder.mixin(Model)

const definitionMap = new WeakMap()
const instanceMap = new WeakMap()
const cacheMap = new WeakMap()

function clearChanges(model, changes) {
  const instance = instanceMap.get(model)
  if (instance) {
    if (changes) {
      for (const name in changes) {
        delete instance.changes[name]
      }
    } else {
      // clear all changes
      instance.changes = {}
    }
  }
  return model
}

const definitionHandlers = {
  properties(properties) {
    // Convert root-level short-forms, for easier properties handling in
    // getAttributes() and createMigration():
    // - `name: type` to `name: { type }`
    // - `name: [...items]` to `name: { type: 'array', items }
    // NOTE: Substitutions on all other levels happen in convertSchema()
    for (const [name, property] of Object.entries(properties)) {
      if (isString(property)) {
        properties[name] = { type: property }
      } else if (isArray(property)) {
        properties[name] = {
          type: 'array',
          items: property.length > 1 ? property : property[0]
        }
      }
    }
    // Include auto-generated 'id' properties for models and relations.
    const missing = {}
    function addIdProperty(name, primary) {
      if (!(name in properties || name in missing)) {
        const type = 'integer'
        missing[name] = primary ? { type, primary } : { type }
      }
    }

    addIdProperty(this.getIdProperty(), true)
    for (const relation of Object.values(this.getRelations())) {
      for (const property of relation.ownerProp.props) {
        addIdProperty(property)
      }
    }
    return {
      ...missing,
      ...properties
    }
  },

  scopes(scopes) {
    for (const [name, scope] of Object.entries(scopes)) {
      if (isObject(scope)) {
        // Convert find()-style filter object to filter function,
        // see QueryBuilder#find()
        scopes[name] = builder => builder.find(scope)
      }
    }
  },

  relations: null,
  methods: null,
  hidden: null,
  routes: null,
  events: null
}
