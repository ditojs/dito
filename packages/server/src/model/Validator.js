import { AjvValidator } from 'objection'
import { mapValues } from '@/utils'
import * as schema from '../schema'

class Validator extends AjvValidator {
  constructor({ options, keywords, formats } = {}) {
    super({
      options: {
        allErrors: true,
        validateSchema: false,
        // NOTE: coerceTypes is recommended to be used with the REST method
        // interface, and hopefully is OK with for the rest also...
        coerceTypes: true,
        jsonPointers: true,
        ownProperties: true,
        passContext: true,
        extendRefs: 'fail',
        format: 'full',
        ...options
      },

      onCreateAjv(ajv) {
        addKeywords(ajv, clearOverrides(schema.keywords, keywords))
        addFormats(ajv, clearOverrides(schema.formats, formats))
        addKeywords(ajv, keywords)
        addFormats(ajv, formats)
      }
    })
  }

  precompileModel(modelClass) {
    const jsonSchema = modelClass.getJsonSchema()
    // We need to make sure that the model is visible in all Ajv instances by
    // forcing compilation and caching right away.
    this.getValidator(modelClass, jsonSchema, true)
    this.getValidator(modelClass, jsonSchema, false)
  }
}

function clearOverrides(defaults, overrides) {
  // Create a new version of `defaults` where all values defined in `overrides`
  // are set to null, so they can be redefined after without caussing errors.
  // This allows apps to override default keywords and formats with their own
  // definitions, while still use the not-touched default formats and keywords
  // in their metaSchema definitions.
  return {
    ...defaults,
    ...mapValues(overrides, () => null)
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
      ajv.addFormat(format, { ...schema })
    }
  }
}

export default Validator
