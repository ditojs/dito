import { isString, isFunction, asArray } from '@ditojs/utils'

export const _instanceof = {
  metaSchema: {
    anyOf: [
      { type: 'string' },
      {
        type: 'array',
        items: {
          type: ['string', 'object']
        }
      }
    ]
  },

  validate(schema, data) {
    // Support instanceof for basic JS types and Dito.js models. If `this` is
    // the validator's ctx (see passContext), then we can access the models and
    // check.
    const models = this?.app?.models
    for (const type of asArray(schema)) {
      const ctor = isString(type)
        ? constructors[type] || models?.[type]
        : isFunction(type)
          ? type
          : null
      if (ctor && data instanceof ctor) {
        return true
      }
    }
    return false
  }
}

const constructors = {
  Object,
  Array,
  Function,
  String,
  Number,
  Boolean,
  Date,
  RegExp,
  Buffer
}
