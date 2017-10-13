import { AjvValidator } from 'objection'
import Ajv from 'ajv'
import setupMergePatch from 'ajv-merge-patch'
// import validators from '../validators'

class Validator extends AjvValidator {
  constructor({ options } = {}) {
    super({
      options: {
        allErrors: true,
        validateSchema: false,
        jsonPointers: true,
        ownProperties: true,
        passContext: true,
        extendRefs: 'fail',
        format: 'full',
        ...options
      },
      onCreateAjv: ajv => setupAjv(ajv)
    })

    this.ajvCoerceTypes = new Ajv({
      ...this.ajvOptions,
      coerceTypes: true

    })
    setupAjv(this.ajvCoerceTypes)
  }

  getKeyword(keyword) {
    return this.ajv.getKeyword(keyword)
  }

  isKeyword(keyword) {
    return !!this.getKeyword(keyword)
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

function setupAjv(ajv) {
  setupMergePatch(ajv)
  ajv.addFormat('required', {
    validate: value => !!value,
    message: 'is required'
  })
  ajv.addKeyword('range', {
    type: ['number', 'integer'],
    metaSchema: {
      type: 'array',
      items: [
        { type: 'number' },
        { type: 'number' }
      ],
      additionalItems: false
    },
    macro(config) {
      return {
        minimum: config[0],
        maximum: config[1]
      }
    }
  })
}

export default Validator
