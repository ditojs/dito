import objection from 'objection'
import Ajv from 'ajv'
import { isArray, isObject, clone } from '@ditojs/utils'
import { mapValues } from '@/utils'
import * as schema from '@/schema'

// Dito does not rely on objection.AjvValidator but instead implements its own
// validator instance that is shared across the whole app and  handles schema
// compilation and caching differently:
// It relies on AJV's addSchema() / getSchema() pattern in conjunction with the
// `schemaId: '$id'` option, and each schema is assigned an $id based on the
// model class name. That way, schemas can reference each other, and they can
// easily validate nested structures.

export default class Validator extends objection.Validator {
  constructor({ options, keywords, formats } = {}) {
    super()

    this.options = {
      allErrors: true,
      errorDataPath: 'property',
      validateSchema: true,
      ownProperties: true,
      passContext: true,
      schemaId: '$id',
      missingRefs: true,
      extendRefs: 'fail',
      format: 'full',
      ...options
    }

    const createAjv = options => {
      const ajv = new Ajv(options)
      addKeywords(ajv, clearOverrides(schema.keywords, keywords))
      addFormats(ajv, clearOverrides(schema.formats, formats))
      addKeywords(ajv, keywords)
      addFormats(ajv, formats)
      return ajv
    }

    // Create a shared Ajv validator instance that is used for validation in
    // remote methods and other validations outside Objection.
    // NOTE: Use `coerceTypes: true` option for remote methods & REST interface.
    this.ajv = createAjv({
      ...this.options,
      coerceTypes: true
    })

    // Create a Ajv instance that sets default values.
    this.ajvDefaults = createAjv({
      ...this.options,
      useDefaults: true
    })

    // Create an Ajv instance that doesn't set default values. We need this one
    // to validate `patch` objects (objects that have a subset of properties).
    this.ajvNoDefaults = createAjv({
      ...this.options,
      useDefaults: false
    })

    // Also keep the merged format definitions for getFormat()
    this.formats = {
      ...schema.formats,
      ...formats
    }
  }

  compile(jsonSchema) {
    return this.ajv.compile(jsonSchema)
  }

  getKeyword(keyword) {
    return this.ajv.getKeyword(keyword)
  }

  getFormat(format) {
    return this.formats[format]
  }

  addSchema(jsonSchema) {
    this.ajv.addSchema(jsonSchema)
    this.ajvDefaults.addSchema(jsonSchema)
    // Remove required fields from schema.
    this.ajvNoDefaults.addSchema({ ...jsonSchema, required: [] })
  }

  parseErrors(errors, options) {
    // Convert from Ajv errors array to Objection-style errorHash,
    // with additional parsing and processing.
    const errorHash = {}
    // Ajv produces duplicate validation errors sometimes, filter them out here.
    const duplicates = {}
    for (const error of errors) {
      // Adjust dataPaths to reflect nested validation in Objection.
      const dataPath = `${options?.dataPath || ''}${error.dataPath}`
      // Unknown properties are reported in `['propertyName']` notation,
      // so replace those with dot-notation, see:
      // https://github.com/epoberezkin/ajv/issues/671
      const key = dataPath.replace(/\['([^']*)'\]/g, '.$1').substring(1)
      let { message, keyword, params } = error
      // Allow custom formats and keywords to override error messages
      const definition = keyword === 'format'
        ? this.getFormat(params.format)
        : this.getKeyword(keyword)
      if (definition?.macro) {
        // Skip keywords that are only delegating to other keywords.
        continue
      }
      message = definition?.message || message
      const identifier = `${key}_${keyword}`
      if (!duplicates[identifier]) {
        const array = errorHash[key] || (errorHash[key] = [])
        array.push({ message, keyword, params })
        duplicates[identifier] = true
      }
    }
    return errorHash
  }

  // @override
  validate(args) {
    let { json, model, options, ctx } = args
    if (ctx.jsonSchema) {
      // We need to clone the input json if we are about to set default values.
      if (!options.mutable && !options.patch &&
        hasDefaults(ctx.jsonSchema.properties)) {
        json = clone(json)
      }
      // Decide which validator to use based on options.patch:
      const ajv = options.patch ? this.ajvNoDefaults : this.ajvDefaults
      const validator = ajv.getSchema(ctx.jsonSchema.$id)
      validator.call(model, json)
      const { errors } = validator
      if (errors) {
        // NOTE: The conversion from Ajv errors to Objection errors happen in
        // Model.createValidationError(), through Validator.parseError()
        throw model.constructor.createValidationError({
          type: 'ModelValidation',
          errors,
          options
        })
      }
    }
    return json
  }

  // @override
  beforeValidate(args) {
    const { json, model, options, ctx } = args
    ctx.jsonSchema = model.constructor.getJsonSchema()
    const { $beforeValidate } = model
    if ($beforeValidate !== objection.Model.prototype.$beforeValidate) {
      // Only clone jsonSchema if the handler actually receives it.
      if ($beforeValidate.length > 0) {
        ctx.jsonSchema = clone(ctx.jsonSchema)
      }
      const ret = model.$beforeValidate(ctx.jsonSchema, json, options)
      if (ret !== undefined) {
        ctx.jsonSchema = ret
      }
    }
  }
}

function hasDefaults(obj) {
  if (isArray(obj)) {
    for (const val of obj) {
      if (val && hasDefaults(val)) {
        return true
      }
    }
  } else if (isObject(obj)) {
    for (const [key, val] of Object.entries(obj)) {
      if (key === 'default' || val && hasDefaults(val)) {
        return true
      }
    }
  }
  return false
}

function addKeywords(ajv, keywords = {}) {
  for (const [keyword, schema] of Object.entries(keywords)) {
    if (schema) {
      // Ajv appears to not copy the schema before modifying it,
      // so let's make shallow clones here.
      // Remove leading '_' to simplify special keywords (e.g. instanceof)
      ajv.addKeyword(keyword.replace(/^_/, ''), { ...schema })
    }
  }
}

function addFormats(ajv, formats = {}) {
  for (const [format, schema] of Object.entries(formats)) {
    if (schema) {
      // See addKeywords() for explanation of regexp and copying here:
      ajv.addFormat(format.replace(/^_/, ''), { ...schema })
    }
  }
}

function clearOverrides(defaults, overrides) {
  // Create a new version of `defaults` where all values defined in
  // `overrides` are set to null, so they can be redefined after without
  // causing errors. This allows apps to override default keywords and
  // formats with their own definitions, while still use the not-touched
  // default formats and keywords in their metaSchema definitions.
  return {
    ...defaults,
    ...mapValues(overrides, () => null)
  }
}
