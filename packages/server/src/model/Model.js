import objection from 'objection'
import util from 'util'
import { isObject, isArray, isString, deepMergeUnshift } from '@/utils'
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
    const updated = await this.$query().updateAndFetch(attributes)
    return this.$set(updated)
  }

  async $patch(attributes) {
    const patched = await this.$query().patchAndFetch(attributes)
    return this.$set(patched)
  }

  get $app() {
    return this.constructor.app
  }

  static initialize() {
    for (const relation of Object.values(this.getRelations())) {
      this.checkRelation(relation)
      this.addRelationAccessor(relation)
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
      // Collect sources values from ancestors in reverse sequence for correct
      // inheritance.
      const sources = []
      while (modelClass !== objection.Model) {
        // Only consider model classes that actually define `name` property.
        if (name in modelClass) {
          // Use reflection through getOwnPropertyDescriptor() to be able to
          // call the getter on `this` rather than on `modelClass`. This can be
          // used to provide abstract base-classes and have them create their
          // relations for `this` inside `get relations`.
          const { get, value } = Object.getOwnPropertyDescriptor(
            modelClass, name) || {}
          const source = get ? get.call(this) : value
          if (source) {
            sources.unshift(source)
          }
        }
        modelClass = Object.getPrototypeOf(modelClass)
      }
      merged = deepMergeUnshift(name === 'hidden' ? [] : {}, ...sources)
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
const cacheMap = new WeakMap()

const definitionHandlers = {
  properties(properties) {
    // Include auto-generated 'id' properties for models and relations.
    function addIdProperty(name, schema) {
      if (!(name in properties)) {
        properties[name] = {
          type: 'integer',
          ...schema
        }
      }
    }

    addIdProperty(this.getIdProperty(), { primary: true })
    for (const relation of Object.values(this.getRelations())) {
      for (const property of relation.ownerProp.props) {
        addIdProperty(property, { foreign: true })
      }
    }

    // Convert root-level short-forms, for easier properties handling in
    // getAttributes() and createMigration():
    // - `name: type` to `name: { type }`
    // - `name: [...items]` to `name: { type: 'array', items }
    // NOTE: Substitutions on all other levels happen in convertSchema()
    const ids = []
    const rest = []
    for (let [name, property] of Object.entries(properties)) {
      if (isString(property)) {
        property = { type: property }
      } else if (isArray(property)) {
        property = {
          type: 'array',
          items: property.length > 1 ? property : property[0]
        }
      }
      // Also sort properties by kind: primary id > foreign id > rest:
      const entry = [name, property]
      if (property.primary) {
        ids.unshift(entry)
      } else if (property.foreign) {
        ids.push(entry)
      } else {
        rest.push(entry)
      }
    }
    // Finally recompile a new properties object out of the sorted properties.
    return [...ids, ...rest].reduce((merged, [name, property]) => {
      merged[name] = property
      return merged
    }, {})
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
