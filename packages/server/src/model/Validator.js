import { AjvValidator } from 'objection'
import * as coreValidators from '../validators'

class Validator extends AjvValidator {
  constructor({ options, validators } = {}) {
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
        for (const { keyword, format, ...schema } of Object.values({
          ...coreValidators,
          ...validators
        })) {
          if (keyword) {
            ajv.addKeyword(keyword, schema)
          } else if (format) {
            ajv.addFormat(format, schema)
          } else if (Object.keys(schema).length) {
            console.warn(
              `Unable to register validator: ${JSON.stringify(schema)}`)
          }
        }
        return ajv
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

export default Validator
