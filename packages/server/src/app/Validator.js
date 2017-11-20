import { AjvValidator } from 'objection'
import Ajv from 'ajv'
import { mapValues } from '@/utils'
import * as schema from '@/schema'

export default class Validator {
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

    // Create a shared AjvValidator to be used by all Objection models.
    // See Model.createValidator()
    this.modelValidator = new AjvValidator({ options, onCreateAjv })
    // Also create a local shared ajv validator instance that will compile all
    // model definitions as well, and is used for validation in remote methods.
    this.ajv = onCreateAjv(new Ajv(options))

    this.options = options
    // Also keep the merged definitions for getKeyword() and getFormat()
    this.formats = {
      ...schema.formats,
      ...formats
    }
    this.keywords = {
      ...schema.keywords,
      ...keywords
    }
  }

  compile(jsonSchema) {
    return this.ajv.compile(jsonSchema)
  }

  getKeyword(keyword) {
    return this.keywords[keyword]
  }

  getFormat(format) {
    return this.formats[format]
  }

  precompileModel(modelClass) {
    const jsonSchema = modelClass.getJsonSchema()
    // Precompile validator to make sure the model is visible in all Ajv
    // instances for use of `$ref`.
    precompileValidator(this.modelValidator, modelClass, jsonSchema, true)
    precompileValidator(this.modelValidator, modelClass, jsonSchema, false)
    // Also compile it in the local Ajv instance, so remote methods can
    // reference model schema as well through $ref:
    this.compile(jsonSchema)
  }
}

function precompileValidator(modelValidator, modelClass, jsonSchema, patch) {
  try {
    // We could easily just call `AjvValidator.getValidator()`, but that's
    // not part of the public API, so some trickery is needed instead:
    // modelValidator.getValidator(modelClass, jsonSchema, false)
    modelValidator.validate({
      json: {}, // Empty data will do just fine to rigger validator caching.
      model: modelClass.prototype, // This is fine to get to the constructor.
      options: { patch },
      ctx: { jsonSchema }
    })
  } catch (err) {
    // Since there is no actual data provided above, this will most likely
    // trigger a validation error. But that's fine, all we want is for
    // AjvValidator to compile and cache the validator for this modelClass.
  }
}

function addKeywords(ajv, keywords = {}) {
  for (const [keyword, schema] of Object.entries(keywords)) {
    if (schema) {
      // Ajv appears to not copy the schema before modifying it,
      // so let's make shallow clones here.
      ajv.addKeyword(keyword, { ...schema })
    }
  }
}

function addFormats(ajv, formats = {}) {
  for (const [format, schema] of Object.entries(formats)) {
    if (schema) {
      // See addKeywords() for explanation of copying here:
      ajv.addFormat(format, { ...schema })
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
