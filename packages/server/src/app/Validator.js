import objection from 'objection'
import Ajv from 'ajv'
import ajvMergePatch from 'ajv-merge-patch'
import { isArray, isObject, clone } from '@ditojs/utils'
import * as schema from '@/schema'

// Dito does not rely on objection.AjvValidator but instead implements its own
// validator instance that is shared across the whole app and handles schema
// compilation and caching differently:
// It relies on Ajv's addSchema() / getSchema() pattern in conjunction with the
// `schemaId: '$id'` option, and each schema is assigned an $id based on the
// model class name. That way, schemas can reference each other, and they can
// easily validate nested structures.

export class Validator extends objection.Validator {
  constructor({ options, keywords, formats } = {}) {
    super()

    this.options = {
      useDefaults: true,
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

    this.keywords = {
      ...schema.keywords,
      ...keywords
    }

    this.formats = {
      ...schema.formats,
      ...formats
    }

    this.schemas = []

    // Dictionary to hold all created Ajv instances, using the stringified
    // options with which they were created as their keys.
    this.ajvCache = Object.create(null)
    // Default Ajv instance used for most model validation.
    this.ajvFull = this.getAjv()
    // Default Ajv instance use to validate `patch` objects.
    this.ajvPatch = this.getAjv({ patch: true })
  }

  createAjv(options) {
    const { patch, ...opts } = options
    const ajv = new Ajv({
      ...this.options,
      ...opts,
      // Patch-validators don't use default values:
      ...(patch && { useDefaults: false })
    })
    ajvMergePatch(ajv)

    const add = (schemas, method) => {
      for (const [name, schema] of Object.entries(schemas)) {
        if (schema) {
          // Ajv appears to not copy the schema before modifying it,
          // so let's make shallow clones here.
          // Remove leading '_' to simplify special keywords (e.g. instanceof)
          ajv[method](name.replace(/^_/, ''), { ...schema })
        }
      }
    }

    add(this.keywords, 'addKeyword')
    add(this.formats, 'addFormat')

    // Also add all model schemas that were already compiled so far.
    for (const schema of this.schemas) {
      addSchema(ajv, schema, options)
    }

    return ajv
  }

  getAjv(options = {}) {
    const key = JSON.stringify(options)
    const { ajv } = this.ajvCache[key] || (this.ajvCache[key] = {
      ajv: this.createAjv(options),
      options
    })
    return ajv
  }

  compile(jsonSchema, options) {
    return this.getAjv(options).compile(jsonSchema)
  }

  getKeyword(keyword) {
    return this.keywords[keyword]
  }

  getFormat(format) {
    return this.formats[format]
  }

  addSchema(jsonSchema) {
    this.schemas.push(jsonSchema)
    // Add schema to all previously created Ajv instances, so they can reference
    // the models.
    for (const { ajv, options } of Object.values(this.ajvCache)) {
      addSchema(ajv, jsonSchema, options)
    }
  }

  parseErrors(errors, options) {
    // Convert from Ajv errors array to Objection-style errorHash,
    // with additional parsing and processing.
    const errorHash = {}
    const duplicates = {}
    for (const error of errors) {
      // Adjust dataPaths to reflect nested validation in Objection.
      const dataPath = `${options?.dataPath || ''}${error.dataPath}`
      // Unknown properties are reported in `['propertyName']` notation,
      // so replace those with dot-notation, see:
      // https://github.com/epoberezkin/ajv/issues/671
      const key = dataPath.replace(/\['([^']*)'\]/g, '.$1').substring(1)
      const { message, keyword, params } = error
      const definition = keyword === 'format'
        ? this.getFormat(params.format)
        : this.getKeyword(keyword)
      const identifier = `${key}_${keyword}`
      if (
        // Ajv produces duplicate validation errors sometimes, filter them out.
        !duplicates[identifier] &&
        // Skip keywords that start with $ such as $merge and $patch.
        !/^\$/.test(keyword) &&
        // Skip macro keywords that are only delegating to other keywords.
        !definition?.macro &&
        // Filter out all custom keywords and formats that want to be silent.
        !definition?.silent
      ) {
        const array = errorHash[key] || (errorHash[key] = [])
        array.push({
          // Allow custom formats and keywords to override error messages.
          message: definition?.message || message,
          keyword,
          params
        })
        duplicates[identifier] = true
      }
    }
    // Now filter through the resulting errors and perform some post-processing:
    for (const [dataPath, errors] of Object.entries(errorHash)) {
      // When we get these errors (caused by `nullable: true`), it means that we
      // have data that isn't null and is causing other errors, and we shouldn't
      // display the 'null' path:
      // [dataPath]: [
      //   {
      //     message: 'should be null',
      //     keyword: 'type',
      //     params: { type: 'null' }
      //   },
      //   {
      //     message: 'should match exactly one schema in oneOf',
      //     keyword: 'oneOf'
      //   }
      // ]
      if (errors.length === 2) {
        const [error1, error2] = errors
        if (
          error1.keyword === 'type' && error1.params.type === 'null' &&
          error2.keyword === 'oneOf'
        ) {
          delete errorHash[dataPath]
        }
      }
    }
    return errorHash
  }

  prefixDataPaths(errors, dataPathPrefix) {
    return errors.map(error => ({
      ...error,
      dataPath: error.dataPath
        ? `${dataPathPrefix}${error.dataPath}`
        : dataPathPrefix
    }))
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
      const ajv = options.patch ? this.ajvPatch : this.ajvFull
      const validate = ajv.getSchema(ctx.jsonSchema.$id)
      // Use `call()` to pass validator as context to Ajv, see passContext:
      validate.call(this, json)
      const { errors } = validate
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

function addSchema(ajv, jsonSchema, options) {
  ajv.addSchema(
    options.patch
      // Remove all required keywords from schema for patch validation.
      ? clone(jsonSchema, value => {
        if (isObject(value)) {
          delete value.required
        }
      })
      : jsonSchema
  )
}
