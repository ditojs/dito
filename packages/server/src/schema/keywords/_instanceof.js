import { isString, isFunction, asArray } from '@ditojs/utils'

// A type is either the name of a basic JS type or Dito.js model, or a
// constructor function:
const typeSchema = {
  anyOf: [
    { type: 'string' },
    { instanceof: 'Function' }
  ]
}

export const _instanceof = {
  metaSchema: {
    anyOf: [
      typeSchema,
      {
        type: 'array',
        items: {
          anyOf: [
            typeSchema,
            { type: 'object' }
          ]
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
