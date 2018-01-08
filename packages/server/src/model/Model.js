import objection from 'objection'
import util from 'util'
import { ValidationError, QueryError, WrappedError } from '@/errors'
import { QueryBuilder } from '@/query'
import { EventEmitter, KnexHelper } from '@/mixins'
import { isObject, isArray, isFunction, deepMergeUnshift } from '@/utils'
import {
  convertSchema, expandSchemaShorthand, addRelationSchemas, convertRelations
} from '@/schema'
import ModelRelation from './ModelRelation'

export default class Model extends objection.Model {
  static initialize() {
    try {
      for (const relation of Object.values(this.getRelations())) {
        this.checkRelation(relation)
        this.addRelationAccessor(relation)
      }
    } catch (error) {
      // Adjust objection.js error messages to point to the right property.
      throw new WrappedError(error,
        str => str.replace(/\brelationMappings\b/g, 'relations'))
    }
    // Install all events listed in the static events object.
    const { events } = this.definition
    for (const [event, handler] of Object.entries(events || {})) {
      this.on(event, handler)
    }
    if (this.app.config.log.schema) {
      console.log(`${this.name}:\n`,
        util.inspect(this.jsonSchema, {
          colors: true,
          depth: null,
          maxArrayLength: null
        })
      )
    }
  }

  get $app() {
    return this.constructor.app
  }

  async $update(attributes) {
    const updated = await this.$query().updateAndFetch(attributes)
    return this.$set(updated)
  }

  async $patch(attributes) {
    const patched = await this.$query().patchAndFetch(attributes)
    return this.$set(patched)
  }

  static async count(...args) {
    const res = await this.query().count(...args).first()
    return res && +res[Object.keys(res)[0]] || 0
  }

  static relatedQuery(relationName, trx) {
    return this.getRelation(relationName).relatedModelClass.query(trx)
  }

  static get tableName() {
    return this.name
  }

  static get idColumn() {
    // Try extracting id column name from properties definition, with fall-back
    // onto default Objection.js behavior.
    const { properties = {} } = this.definition
    const ids = []
    for (const [name, property] of Object.entries(properties)) {
      if (property.primary) {
        ids.push(name)
      }
    }
    const { length } = ids
    return length > 1 ? ids : length > 0 ? ids[0] : super.idColumn
  }

  static get namedFilters() {
    // Convert Dito's scopes to Objection's namedFilters and cache result.
    return this.getCached('namedFilters', () => {
      const { scopes = {}, default: _default = {} } = this.definition
      const namedFilters = {}
      for (const [name, scope] of Object.entries(scopes)) {
        const filter = namedFilters[name] = isFunction(scope)
          ? scope
          : isObject(scope)
            ? builder => builder.find(scope)
            : null
        if (!filter) {
          throw new QueryError(`Invalid scope: '${scope}'.`)
        }
      }
      // Add a special 'default.eager' filter that does nothing else than
      // handle the default eager chaining. See: `definitionHandlers.default`
      namedFilters['default.eager'] = builder => {
        const { eager } = _default
        if (eager) {
          builder.mergeEager(eager)
        }
      }
      return namedFilters
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
      const { properties = {} } = this.definition
      const schema = addRelationSchemas(this, convertSchema(properties))
      return {
        $id: this.name,
        $schema: 'http://json-schema.org/draft-06/schema#',
        ...schema
      }
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

  static get hiddenAttributes() {
    return this.getCached('jsonSchema:hiddenAttributes', () => (
      this.getAttributes(({ hidden }) => hidden)
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
          enumerable: false
        })
        return modelRelation
      },
      configurable: true,
      enumerable: false
    })
  }

  // Override propertyNameToColumnName() / columnNameToPropertyName() to not
  // rely on $formatDatabaseJson() /  $parseDatabaseJson() do detect naming
  // conventions but assume simply that they're always the same.
  // This is fine since we can now change naming at Knex level.
  // See knexSnakeCaseMappers()
  static propertyNameToColumnName(propertyName) {
    return propertyName
  }

  static columnNameToPropertyName(columnName) {
    return columnName
  }

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
    // NOTE: No need to normalize the identifiers in the JSON in case of
    // normalizeDbNames, as this already happens through
    // knex.config.wrapIdentifier(), see App.js
    return super.$formatDatabaseJson(json)
  }

  $parseDatabaseJson(json) {
    const { constructor } = this
    json = super.$parseDatabaseJson(json)
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
    // Now call $parseJson() to remove potential computed properties.
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
    // Remove hidden attributes.
    for (const key of constructor.hiddenAttributes) {
      delete json[key]
    }
    return json
  }

  static createValidator() {
    // Use a shared validator per app, so model schema can reference each other.
    // NOTE: The Dito Validator class creates and manages this shared Objection
    // Validator instance for us, we just need to return it here:
    return this.app.validator
  }

  static compileValidator(jsonSchema) {
    return this.app.compileValidator(jsonSchema)
  }

  static createValidationError(errors, message, options = {}) {
    const isValidationError = this.isValidationError(errors)
    message = message || isValidationError
      ? `The provided data for the ${this.name} instance is not valid`
      : 'Query error'
    const error = { message, errors }
    return isValidationError
      ? new this.ValidationError(this, error, options)
      : new this.QueryError(error)
  }

  static isValidationError(errors) {
    // Unfortunately, Objection.js currently uses createValidationError() for
    // very different types of errors, so we have to look at the nature of the
    // error to filter out actual validation errors and use different
    // Error constructors, see createValidationError()

    // First detect native AJV validation errors, which are arrays of error
    // objects of which each defines a schemaPath.
    if (isArray(errors)) {
      return !!errors?.[0].schemaPath
    }

    // Now detect parsed Objection validation errors, which are the only ones to
    // hold array properties.
    for (const key in errors) {
      // Only if the first found key has an array value than we're dealing with
      // real validation errors.
      return isArray(errors[key])
    }

    return false
  }

  static ValidationError = ValidationError
  static QueryError = QueryError
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
      merged = deepMergeUnshift({}, ...sources)
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
KnexHelper.mixin(Model)
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

    addIdProperty(this.getIdProperty(), {
      primary: true
    })

    const { relations } = this.definition
    for (const relation of Object.values(this.getRelations())) {
      const { nullable } = relations[relation.name]
      for (const property of relation.ownerProp.props) {
        addIdProperty(property, {
          unsigned: true,
          foreign: true,
          index: true,
          nullable
        })
      }
    }

    // Convert root-level short-forms, for easier properties handling in
    // getAttributes() and idColumn() & co:
    // - `name: type` to `name: { type }`
    // - `name: [...items]` to `name: { type: 'array', items }
    // NOTE: Substitutions on all other levels happen in convertSchema()
    const ids = []
    const rest = []
    for (let [name, property] of Object.entries(properties)) {
      property = expandSchemaShorthand(property)
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

  default(_default) {
    // Parse default.eager expression and add the 'default.eager' args to all
    // child expressions, so they can recursively load their own default.eager
    // expressions. This allows for eager chaining across multiple nested models
    // in a way that each model only needs to specify its own eager relations.
    // See namedFilter() for the definition of 'default.eager'.
    const addEager = (node, isRoot) => {
      if (!isRoot) {
        // Use unshift instead of push so it's applied fist, not last, and other
        // scopes can be applied after.
        node.args.unshift('default.eager')
      }
      if (node.numChildren > 0) {
        for (const child of Object.values(node.children)) {
          addEager(child, false)
        }
      }
      return node
    }
    const { eager } = _default
    if (eager) {
      const node = objection.RelationExpression.parse(eager)
      _default.eager = addEager(node, true)
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
  routes: null,
  events: null
}
