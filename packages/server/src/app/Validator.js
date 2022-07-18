import objection from 'objection'
import Ajv from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { isArray, isObject, clone, isAsync, isPromise } from '@ditojs/utils'
import { formatJson } from '../utils/index.js'
import * as schema from '../schema/index.js'

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
      ...defaultOptions,
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
  }

  createAjv(options) {
    // Split options into native Ajv options and our additions (async, patch):
    const { async, patch, ...opts } = options
    const ajv = new Ajv({
      ...this.options,
      ...opts,
      // Patch-validators don't use default values:
      ...(patch && { useDefaults: false })
    })
    addFormats(ajv, { mode: 'full' })

    const addSchemas = (schemas, callback) => {
      for (const [name, schema] of Object.entries(schemas)) {
        if (schema) {
          // Remove leading '_' to simplify special keywords (e.g. instanceof)
          callback(name.replace(/^_/, ''), schema)
        }
      }
    }

    addSchemas(this.keywords, (keyword, schema) => ajv.addKeyword({
      keyword,
      ...schema
    }))
    addSchemas(this.formats, (format, schema) => ajv.addFormat(format, {
      ...schema
    }))

    // Also add all model schemas that were already compiled so far.
    for (const schema of this.schemas) {
      ajv.addSchema(this.processSchema(schema, options))
    }

    return ajv
  }

  getAjv(options = {}) {
    // Cache Ajv instances by keys that represent their options. For improved
    // matching, convert options to a version with all default values missing:
    const opts = Object.entries(options).reduce((opts, [key, value]) => {
      if (key in validatorOptions && value !== validatorOptions[key]) {
        opts[key] = value
      }
      return opts
    }, {})
    const cacheKey = formatJson(opts, false)
    const { ajv } = this.ajvCache[cacheKey] || (this.ajvCache[cacheKey] = {
      ajv: this.createAjv(opts),
      options
    })
    return ajv
  }

  compile(jsonSchema, options = {}) {
    const ajv = this.getAjv(options)
    const validator = ajv.compile(this.processSchema(jsonSchema, options))
    // Assume `options.throw = true` as the default.
    const dontThrow = options.throw === false
    return options.async
      // For async:
      ? dontThrow
        ? async function validate(data) {
          // Emulate `options.throw == false` behavior for async validation:
          // Return `true` or `false`, and store errors on `validate.errors`
          // if validation failed.
          let result
          try {
            // Use `call()` to pass `this` as context to Ajv, see passContext:
            result = await validator.call(this, data)
          } catch (error) {
            if (error.errors) {
              validate.errors = error.errors
              result = false
            } else {
              throw error
            }
          }
          return result
        }
        : validator // The default for async is to throw.
      // For sync:
      : dontThrow
        ? validator // The default for sync is to not throw.
        : function(data) {
          // Emulate `options.throw == true` behavior for sync validation:
          // Return `true` if successful, throw `Ajv.ValidationError` otherwise.
          // Use `call()` to pass `this` as context to Ajv, see passContext:
          const result = validator.call(this, data)
          if (!result) {
            throw new Ajv.ValidationError(validator.errors)
          }
          return result
        }
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
      ajv.addSchema(this.processSchema(jsonSchema, options))
    }
  }

  processSchema(jsonSchema, options = {}) {
    const { patch, async } = options
    const schema = clone(jsonSchema, value => {
      if (isObject(value)) {
        if (patch) {
          // Remove all required keywords and formats from schema for patch
          // validation.
          delete value.required
          if (value.format === 'required') {
            delete value.format
          }
        }
        // Convert async `validate()` keywords to `validateAsync()`:
        if (isAsync(value.validate)) {
          value.validateAsync = value.validate
          delete value.validate
        }
        if (!async) {
          // Remove all async keywords for synchronous validation.
          for (const key in value) {
            const keyword = this.getKeyword(key)
            if (keyword?.async) {
              delete value[key]
            }
          }
        }
      }
    })
    if (async) {
      schema.$async = true
    }
    return schema
  }

  parseErrors(errors, options = {}) {
    // Convert from Ajv errors array to Objection-style errorHash,
    // with additional parsing and processing.
    const errorHash = {}
    const duplicates = {}
    for (const error of errors) {
      // Adjust dataPaths to reflect nested validation in Objection.
      // NOTE: As of Ajv 8, `error.dataPath` is now called `error.instancePath`,
      // but we stick to `error.dataPath` in Dito.js, and support both in errors
      // passed in here.
      const instancePath = (error.instancePath ?? error.dataPath) || ''
      const dataPath = `${options?.dataPath || ''}${instancePath}`
      // Unknown properties are reported in `['propertyName']` notation,
      // so replace those with dot-notation, see:
      // https://github.com/epoberezkin/ajv/issues/671
      const key = dataPath.replace(/\['([^']*)'\]/g, '/$1').slice(1)
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

  prefixInstancePaths(errors, instancePathPrefix) {
    // As of Ajv 8, `error.dataPath` is now called `error.instancePath`. In
    // Dito.js we stick to `error.dataPath`, but until the errors pass through
    // `parseErrors()`, we stick to `error.instancePath` for consistency.
    return errors.map(error => ({
      ...error,
      instancePath: error.instancePath
        ? `${instancePathPrefix}${error.instancePath}`
        : instancePathPrefix
    }))
  }

  // @override
  beforeValidate({ json, model, ctx, options }) {
    // Add validator instance, app and options to context
    ctx.validator = this
    ctx.app = this.app
    ctx.options = options
    ctx.jsonSchema = model.constructor.getJsonSchema()
    const { $beforeValidate } = model
    if ($beforeValidate !== objection.Model.prototype.$beforeValidate) {
      // TODO: Consider adding hooks for 'before:validate' and 'after:validate',
      // and if so, decide what to do about modifying / returning json-schema.
      // Probably we shouldn't allow it there.

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

  // @override
  validate({ json, model, ctx, options }) {
    const { jsonSchema } = ctx
    if (jsonSchema) {
      // We need to clone the input json if we are about to set default values.
      if (
        !options.mutable &&
        !options.patch &&
        hasDefaults(jsonSchema.properties)
      ) {
        json = clone(json)
      }
      // Get the right Ajv instance for the given patch and async options
      const validate = this.getAjv(options).getSchema(jsonSchema.$id)
      // Use `call()` to pass ctx as context to Ajv, see passContext:
      const res = validate.call(ctx, json)
      const handleErrors = errors => {
        if (errors) {
          // NOTE: The conversion from Ajv errors to Objection errors happen in
          // Model.createValidationError(), which calls Validator.parseError()
          throw model.constructor.createValidationError({
            type: 'ModelValidation',
            errors,
            options,
            json
          })
        }
      }
      // Handle both async and sync validation here:
      if (isPromise(res)) {
        return res
          .catch(error => handleErrors(error.errors))
          .then(() => json)
      } else {
        handleErrors(validate.errors)
        return json
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

const defaultOptions = {
  strict: false,
  allErrors: true,
  ownProperties: true,
  passContext: true,
  useDefaults: true,
  validateSchema: true
}

// Options that are allowed to be passed on to the created Ajv instances, with
// their default settings (some defaults are from Ajv, some from defaultOptions)
const validatorOptions = {
  // Our extensions:
  async: false,
  patch: false,
  // Ajv Options:
  $data: false,
  $comment: false,
  coerceTypes: false,
  discriminator: true,
  multipleOfPrecision: false,
  ownProperties: true,
  removeAdditional: false,
  uniqueItems: true,
  useDefaults: true,
  verbose: false
}
