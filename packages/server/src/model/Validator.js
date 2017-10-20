import { AjvValidator } from 'objection'
import Ajv from 'ajv'
import * as coreValidators from './validators'

class Validator extends AjvValidator {
  constructor({ options, validators } = {}) {
    validators = {
      ...coreValidators,
      ...validators
    }
    options = {
      allErrors: true,
      validateSchema: false,
      jsonPointers: true,
      ownProperties: true,
      passContext: true,
      extendRefs: 'fail',
      format: 'full',
      ...options
    }

    super({ options, onCreateAjv })

    this.ajvCoerceTypes = onCreateAjv(new Ajv({
      ...this.ajvOptions,
      coerceTypes: true
    }))

    function onCreateAjv(ajv) {
      for (const { keyword, format, ...schema } of Object.values(validators)) {
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
  }

  precompileModel(modelClass) {
    const jsonSchema = modelClass.getJsonSchema()
    // We need to make sure that the model is visible in all different Ajv
    // instances, the added ajvCoerceTypes included!
    this.getValidator(modelClass, jsonSchema, true)
    this.getValidator(modelClass, jsonSchema, false)
    let required
    try {
      required = jsonSchema.required
      jsonSchema.required = []
      this.ajvCoerceTypes.compile(jsonSchema)
    } finally {
      jsonSchema.required = required
    }
  }

  compileWithDefaults(schema) {
    return this.ajv.compile(schema)
  }

  compileWithoutDefaults(schema) {
    return this.ajvNoDefaults.compile(schema)
  }

  compileWithCoercing(schema) {
    return this.ajvCoerceTypes.compile(schema)
  }
}

export default Validator
