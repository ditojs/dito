import objection from 'objection'
import dbErrors from 'db-errors'
import { QueryBuilder, QueryFilters } from '@/query'
import { KnexHelper } from '@/lib'
import { isObject, isFunction, asArray } from '@ditojs/utils'
import { mergeReversed, mergeAsArrays } from '@/utils'
import {
  convertSchema, expandSchemaShorthand, addRelationSchemas, convertRelations
} from '@/schema'
import {
  ResponseError, DatabaseError, GraphError, ModelError, NotFoundError,
  RelationError, WrappedError
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
    this.referenceValidator = null
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

  $is(model) {
    return model?.constructor === this.constructor && model?.id === this.id
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

  async $transaction(handler) {
    return this.constructor.transaction(handler)
  }

  static transaction(handler) {
    return objection.transaction(this.knex(), handler)
  }

  static isReference(data) {
    let validator = this.referenceValidator
    if (!validator) {
      const idProperty = this.getIdProperty()
      const { type } = this.definition.properties[idProperty]
      // For `data` to be considered a reference, it needs to hold only one
      // value that is either the target's id, or an Objection.js #ref value:
      validator = this.referenceValidator = this.app.compileValidator({
        oneOf: [
          {
            type: 'object',
            properties: {
              [idProperty]: {
                type
              }
            },
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
      })
    }
    return validator(data)
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
    // If the class name ends in 'Model', remove that from the table name.
    return this.name.match(/^(.*?)(?:Model|)$/)[1]
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
      const namedFilters = {}
      for (const [name, scope] of Object.entries(this.definition.scopes)) {
        if (isFunction(scope)) {
          namedFilters[name] = scope
        } else {
          throw new ModelError(this, `Invalid scope '${name}': ($}{scope}).`)
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
      const schema = convertSchema(this.definition.properties)
      addRelationSchemas(this, schema.properties)
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

  static async populateGraph(graph, expr) {
    expr = objection.RelationExpression.create(expr)
    // Convert RelationExpression to an array of paths, that themselves contain
    // path entries with relation names and modify settings.
    const collectPaths = expr => {
      const paths = []
      for (const key in expr) {
        if (expr.hasOwnProperty(key)) {
          const child = expr[key]
          if (isObject(child)) {
            const entry = {
              relation: child.$relation || key,
              modify: child.$modify
            }
            const subPaths = collectPaths(child)
            if (subPaths.length > 0) {
              // The child has itself children.
              for (const subPath of subPaths) {
                paths.push([entry, ...subPath])
              }
            } else {
              // The child is a leaf, add $modify
              paths.push([entry])
            }
          }
        }
      }
      return paths
    }

    const grouped = {}
    const addToGroup = (item, modelClass, modify, eager) => {
      // Group models by model-name + modify + eager, for faster loading:
      const key = `${modelClass.name}_${modify}_${eager || ''}`
      const group = grouped[key] || (grouped[key] = {
        modelClass,
        modify,
        eager,
        idProperty: modelClass.getIdProperty(),
        references: [],
        ids: [],
        modelsById: {}
      })
      // Filter out the items that aren't references,
      // and collect ids to be loaded for references.
      if (modify.length > 0 || modelClass.isReference(item)) {
        const id = item[group.idProperty]
        if (id != null) {
          group.references.push(item)
          group.ids.push(id)
        }
      }
    }

    for (const path of collectPaths(expr)) {
      let modelClass = this
      const modelClasses = []
      let modify
      for (const entry of path) {
        modelClasses.push(modelClass)
        modelClass = modelClass.getRelation(entry.relation).relatedModelClass
        modify = entry.modify
      }
      for (const model of asArray(graph)) {
        if (model) {
          let items = asArray(model)
          // Collect all graph items described by the current relation path in
          // one loop:
          for (let i = 0, l = path.length; i < l; i++) {
            const entry = path[i]
            if (items.length === 0) break
            const modelClass = modelClasses[i]
            items = items.reduce((items, item) => {
              if (modelClass.isReference(item)) {
                // Detected a reference item that isn't a leaf: We need to
                // eager-load the rest of the path, and respect modify settings:
                const eager = path.slice(i).map(
                  ({ relation, modify }) => modify.length > 0
                    ? `${relation}(${modify.join(', ')})`
                    : relation
                )
                addToGroup(item, modelClass, entry.modify, eager.join('.'))
              } else {
                const value = item[entry.relation]
                if (value != null) {
                  items.push(...asArray(value))
                }
              }
              return items
            }, [])
          }
          // Add all encountered leaf-references to groups to be loaded.
          for (const item of items) {
            addToGroup(item, modelClass, modify)
          }
        }
      }
    }

    const groups = Object.values(grouped).filter(({ ids }) => ids.length > 0)

    // Load all found models by ids asynchronously.
    await Promise.map(
      groups,
      async ({ modelClass, modify, eager, idProperty, ids, modelsById }) => {
        const query = modelClass.whereIn('id', ids)
        if (eager) {
          query.mergeEager(eager)
        }
        for (const mod of modify) {
          query.modify(mod)
        }
        const models = await query.execute()
        // Fill the group.modelsById lookup:
        for (const model of models) {
          modelsById[model[idProperty]] = model
        }
      }
    )

    // Finally populate the references with the loaded models.
    for (const { idProperty, references, modelsById } of groups) {
      for (const item of references) {
        const id = item[idProperty]
        const model = modelsById[id]
        if (model) {
          Object.assign(item, model)
        }
      }
    }

    return graph
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

  static createValidationError({ type, message, errors, options }) {
    switch (type) {
    case 'ModelValidation':
    case 'ControllerValidation':
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
        // Collect ancestor values for proper inheritance.
        // NOTE: values are collected in sequence of inheritance, from sub-class
        // to super-class, so when merging, `mergeReversed()` is used to prevent
        // wrong overrides. `mergeAsArrays()` can be used to keep arrays of
        // inherited values per key, see `definitionHandlers.scopes`.
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
    const properties = mergeReversed(values)
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

  // No special treatment needed for relations, but we still need to define it
  // so it will be recognized as a definition:
  relations: null,

  scopes(values) {
    // Use mergeAsArrays() to keep lists of filters to be inherited per scope,
    // so they can be called in sequence.
    const scopeArrays = mergeAsArrays(values)
    const scopes = {}
    for (const [name, array] of Object.entries(scopeArrays)) {
      // Convert array of inherited scope definitions to scope functions.
      const functions = array
        .reverse() // Reverse to go from super-class to sub-class.
        .map(
          value => {
            let func
            if (isFunction(value)) {
              func = value
            } else if (isObject(value)) {
              func = query => query.find(value)
            } else {
              throw new ModelError(this,
                `Invalid scope '${name}': Invalid scope type: ${value}.`
              )
            }
            return func
          }
        )
      // Now define the scope as a function that calls all inherited scope
      // functions.
      scopes[name] = query => {
        for (const func of functions) {
          func(query)
        }
        return query
      }
    }
    return scopes
  },

  filters(values) {
    // Use mergeAsArrays() to keep lists of filters to be inherited per scope,
    // so they can be called in sequence.
    const filterArrays = mergeAsArrays(values)
    const filters = {}
    for (const [name, array] of Object.entries(filterArrays)) {
      // Convert array of inherited filter definitions to filter functions,
      // including parameter validation.
      const functions = array
        .reverse() // Reverse to go from super-class to sub-class.
        .map(filter => {
          let func
          if (isFunction(filter)) {
            func = filter
          } else if (isObject(filter)) {
            // Convert QueryFilters to normal filter functions
            const queryFilter = QueryFilters.get(filter.filter)
            if (queryFilter) {
              const { properties } = filter
              func = properties
                ? (builder, ...args) => {
                  // When the filter provides multiple properties, match them
                  // all, but combine the expressions with OR.
                  for (const property of properties) {
                    builder.orWhere(function() {
                      queryFilter(this, property, ...args)
                    })
                  }
                }
                : (builder, ...args) => {
                  queryFilter(builder, name, ...args)
                }
              // Copy over @parameters() settings
              func.parameters = queryFilter.parameters
            } else {
              throw new ModelError(this,
                `Invalid filter '${name}': Unknown filter type '${
                  filter.filter}'.`
              )
            }
          }
          // If parameters are defined, wrap the function in a closure that
          // performs parameter validation...
          const validator = func && this.app.compileParametersValidator(
            func.parameters,
            func.options
          )
          if (validator) {
            return (query, ...args) => {
              // Convert args to object for validation:
              const object = {}
              let index = 0
              for (const { name } of validator.list) {
                // Use 'root' if no name is given, see:
                // Application.compileParametersValidator()
                object[name || 'root'] = args[index++]
              }
              const errors = validator.validate(object)
              if (errors) {
                throw this.app.createValidationError({
                  type: 'FilterValidation',
                  message:
                    `The provided data for query filter '${name}' is not valid`,
                  errors: this.app.validator.prefixDataPaths(
                    errors,
                    `.${name}`
                  )
                })
              }
              return func(query, ...args)
            }
          }
          // ...otherwise use the defined function unmodified.
          return func
        })
      // Now define the filter as a function that calls all inherited filter
      // functions.
      filters[name] = (query, ...args) => {
        for (const func of functions) {
          func(query, ...args)
        }
        return query
      }
    }
    return filters
  }
}
