import { AjvValidator } from 'objection'
import { mapValues } from '@/utils'
import * as schema from '../schema'

export default class Validator extends AjvValidator {
  constructor({ options, keywords, formats } = {}) {
    const _keywords = {}
    const _formats = {}

    // We need to declare these methods inside the constructor to modify local
    // `_keywords` and `_formats`, because they're called from the `onCreateAjv`
    // callback that is triggered from `super`, before `this` is available.
    function addKeywords(ajv, keywords = {}) {
      for (const [keyword, schema] of Object.entries(keywords)) {
        if (schema) {
          _keywords[keyword] = schema
          // Ajv appears to not copy the schema before modifying it,
          // so let's make shallow clones here.
          ajv.addKeyword(keyword, { ...schema })
        }
      }
    }

    function addFormats(ajv, formats = {}) {
      for (const [format, schema] of Object.entries(formats)) {
        if (schema) {
          _formats[format] = schema
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

    // Now that `this` is available, we can finally copy these over:
    this._keywords = _keywords
    this._formats = _formats
  }

  getKeyword(keyword) {
    return this._keywords[keyword]
  }

  getFormat(format) {
    return this._formats[format]
  }

  precompileModel(modelClass) {
    const jsonSchema = modelClass.getJsonSchema()
    // We need to make sure that the model is visible in all Ajv instances for
    // use of `$ref` by forcing compilation and caching right away.
    this.getValidator(modelClass, jsonSchema, true)
    this.getValidator(modelClass, jsonSchema, false)
  }

  createValidationError(modelClass, errors) {
    return modelClass.createValidationError(errors)
  }
}
