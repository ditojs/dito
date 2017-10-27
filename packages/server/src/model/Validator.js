import { AjvValidator } from 'objection'
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
        addKeywords(ajv, { ...schema.keywords, ...keywords })
        addFormats(ajv, { ...schema.formats, ...formats })
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

function addKeywords(ajv, keywords = {}) {
  for (const [keyword, schema] of Object.entries(keywords)) {
    // Ajv appears to not copy the schema before modifying it,
    // so let's make shallow clones here.
    ajv.addKeyword(keyword, { ...schema })
  }
}

function addFormats(ajv, formats = {}) {
  for (const [format, schema] of Object.entries(formats)) {
    ajv.addFormat(format, { ...schema })
  }
}

export default Validator
