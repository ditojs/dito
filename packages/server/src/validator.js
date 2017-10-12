import {AjvValidator} from 'objection'
import setupMergePatch from 'ajv-merge-patch'
import validators from './validators'

const validator = new AjvValidator({
  onCreateAjv: ajv => {
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
  },

  options: {
    allErrors: true,
    validateSchema: false,
    jsonPointers: true,
    ownProperties: true,
    passContext: true,
    extendRefs: 'fail',
    format: 'full'
  }
})

validator.getKeyword = function (keyword) {
  return this.ajv.getKeyword(keyword)
}

validator.isKeyword = function (keyword) {
  return !!this.getKeyword(keyword)
}

export default validator
