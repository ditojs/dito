import objection from 'objection'
import dbErrors from 'db-errors'
import { QueryBuilder } from '@/query'
import { KnexHelper } from '@/lib'
import { isObject, isFunction, asArray } from '@ditojs/utils'
import { mergeWithoutOverride, mergeAsArrays } from '@/utils'
import {
  convertSchema, expandSchemaShorthand, addRelationSchemas, convertRelations
} from '@/schema'
import {
  ResponseError, DatabaseError, GraphError, ModelError, NotFoundError,
  RelationError, ValidationError, WrappedError
} from '@/errors'
import RelationAccessor from './RelationAccessor'

export class Model extends objection.Model {
  static initialize() {
    try {
      for (const relation of this.getRelationArray()) {
        this.initializeRelation(relation)
      }
    } catch (error) {
      throw error instanceof RelationError ? error : new RelationError(error)
    }
  }

  static initializeRelation(relation) {
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

  $initialize() {
    // Do nothing by default.
  }

  get $app() {
    return this.constructor.app
  }

  async $update(attributes) {
    if (await this.$query().update(attributes)) {
      this.$set(attributes)
    }
    return this
  }

  async $patch(attributes) {
    if (await this.$query().patch(attributes)) {
      this.$set(attributes)
    }
    return this
  }

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

  static get tableName() {
    return this.name
  }

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

  static getIdValues(id, obj = {}) {
    const ids = asArray(id)
    const { properties } = this.definition
    for (const [index, name] of this.getIdPropertyArray().entries()) {
      const property = properties[name]
      const id = ids[index]
      obj[name] = ['integer', 'number'].includes(property.type) ? +id : id
    }
    return obj
  }

  static hasScope(name) {
    return name in this.namedFilters
  }

  static get namedFilters() {
    // Convert Dito's scopes to Objection's namedFilters and cache result.
    return this.getCached('namedFilters', () => {
      const { scopes } = this.definition
      const namedFilters = {}
      for (const [name, scope] of Object.entries(scopes)) {
        if (isFunction(scope)) {
          namedFilters[name] = scope
        } else {
          throw new ModelError(this, `Invalid scope: '${name}'.`)
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
      const { properties } = this.definition
      const schema = addRelationSchemas(this, convertSchema(properties))
      return {
        $id: this.name,
        $schema: 'http://json-schema.org/draft-07/schema#',
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

  $setJson(json, options) {
    super.$setJson(json, options)
    this.$initialize()
    return this
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
    // Remove the computed properties so they don't attempt to get set.
    for (const key of this.constructor.computedAttributes) {
      delete json[key]
    }
    // NOTE: No need to normalize the identifiers in the JSON in case of
    // normalizeDbNames, as this already happens through
    // knex.config.wrapIdentifier(), see Application.js
    return super.$formatDatabaseJson(json)
  }

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
    // Now call $parseJson() to remove potential computed properties.
    return this.$parseJson(json)
  }

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

  static createNotFoundError(ctx) {
    return new NotFoundError(ctx.byId
      ? `'${this.name}' model with id ${ctx.byId} not found`
      : `'${this.name}' model not found`)
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

  static createValidationError({ type, message, errors, options }) {
    switch (type) {
    case 'ModelValidation':
    case 'ControllerValidation':
      return new ValidationError({
        type,
        message: message ||
          `The provided data for the ${this.name} model is not valid`,
        errors: this.app.validator.parseErrors(errors, options)
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

  static QueryBuilder = QueryBuilder

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
        // Collect ancestor values for proper inheritance. Note: values are
        // collected in sequence of inheritance, from sub-class to super-class,
        // so when merging, mergeWithoutOverride() needs to be used to prevent
        // overrides in the wrong direction. mergeAsArrays() can be used to keep
        // arrays of inherited values per key, see `definitionHandlers.scopes`.
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
          : mergeWithoutOverride({}, ...values)
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

KnexHelper.mixin(Model)
// Expose a selection of QueryBuilder methods as static methods on model classes
QueryBuilder.mixin(Model)

const metaMap = new WeakMap()

const getMeta = (modelClass, key, value) => {
  let meta = metaMap.get(modelClass)
  if (!meta) {
    metaMap.set(modelClass, meta = {})
  }
  if (!(key in meta)) {
    meta[key] = isFunction(value) ? value() : value
  }
  return meta[key]
}

const definitionHandlers = {
  properties(values) {
    const properties = mergeWithoutOverride({}, ...values)
    // Include auto-generated 'id' properties for models and relations.
    const addIdProperty = (name, schema) => {
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

    const addRelationProperties = (relation, propName) => {
      const modelClass = relation.ownerModelClass
      const { nullable } = modelClass.definition.relations[relation.name]
      for (const property of relation[propName].props) {
        addIdProperty(property, {
          unsigned: true,
          foreign: true,
          index: true,
          ...(nullable && { nullable })
        })
      }
    }

    for (const relation of this.getRelationArray()) {
      addRelationProperties(relation, 'ownerProp')
    }

    for (const relation of this.getRelatedRelations()) {
      addRelationProperties(relation, 'relatedProp')
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

  scopes(values) {
    // Use mergeAsArrays() to keep lists of filters to be inherited per scope,
    // so they can be called in sequence.
    const scopesArrays = mergeAsArrays({}, ...values)
    const scopes = {}
    for (const [name, array] of Object.entries(scopesArrays)) {
      // Convert array of filter to filter functions that all take a query and
      // return the query if the next filter should be called, `null` otherwise.
      const filters = array
        .map(filter =>
          isFunction(filter) ? filter
          : isObject(filter) ? query => query.find(filter)
          : () => filter)
        .reverse() // Reverse to go from super-class to sub-class.
      scopes[name] = query => {
        // Call all inherited filters per scope.
        for (const filter of filters) {
          filter(query)
        }
        return query
      }
    }
    return scopes
  },

  relations: null
}
