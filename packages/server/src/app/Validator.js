import { AjvValidator } from 'objection'
import Ajv from 'ajv'
import { mapValues } from '@/utils'
import * as schema from '@/schema'

export default class Validator extends AjvValidator {
  constructor({ options, keywords, formats } = {}) {
    options = {
      allErrors: true,
      validateSchema: true,
      // NOTE: `coerceTypes` is recommended to be used with the REST method
      // interface, and hopefully is OK with for the rest also...
      coerceTypes: true,
      jsonPointers: true,
      ownProperties: true,
      passContext: true,
      schemaId: '$id',
      extendRefs: 'fail',
      format: 'full',
      ...options
    }

    function onCreateAjv(ajv) {
      addKeywords(ajv, clearOverrides(schema.keywords, keywords))
      addFormats(ajv, clearOverrides(schema.formats, formats))
      addKeywords(ajv, keywords)
      addFormats(ajv, formats)
      return ajv
    }

    super({ options, onCreateAjv })

    // Also create a local shared ajv validator instance that will compile all
    // model definitions as well, and is used for validation in remote methods.
    this.ajv = onCreateAjv(new Ajv(options))

    this.options = options
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
    this.ajvNoDefaults.addSchema({ ...jsonSchema, required: [] })
  }

  // @override
  getValidator(ModelClass, jsonSchema, isPatchObject) {
    const createCacheKey = this.ajvOptions.serialize || JSON.stringify
    const cacheKey = jsonSchema === ModelClass.getJsonSchema()
      ? ModelClass.name || ModelClass.uniqueTag()
      : createCacheKey(jsonSchema)
    let validators = this.cache.get(cacheKey)
    if (!validators) {
      validators = {
        patchValidator: null,
        normalValidator: null
      }
      this.cache.set(cacheKey, validators)
    }
    const validatorKey = isPatchObject ? 'patchValidator' : 'normalValidator'
    let validator = validators[validatorKey]
    if (!validator) {
      const ajv = isPatchObject ? this.ajvNoDefaults : this.ajv
      validator = validators[validatorKey] = ajv.getSchema(jsonSchema.$id)
    }
    return validator
  }
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
