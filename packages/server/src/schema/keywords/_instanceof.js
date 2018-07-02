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
    // Support instanceof for dito models. The trick is simple: If the
    // instance is a model, then we can access the models and check. If not,
    // then it's fine if it fails in case the check wants a model.
    const models = this.$app?.models
    for (const entry of asArray(schema)) {
      const ctor = isString(entry)
        ? constructors[entry] || models?.[entry]
        : isFunction(entry)
          ? entry
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
