import { asArray } from '@/utils'

export const _instanceof = {
  metaSchema: {
    anyOf: [
      { type: 'string' },
      {
        type: 'array',
        items: { type: 'string' }
      }
    ]
  },

  validate(schema, data) {
    if (this) {
      // Support instanceof for dito models. The trick is simple: If the
      // instance is a model, then we can access the models and check. If not,
      // then it's fine if it fails in case the check wants a model.
      const { $app } = this
      // eslint-disable-next-line
      const models = $app?.models
      for (const name of asArray(schema)) {
        const ctor = constructors[name] || models?.[name]
        if (data instanceof ctor) {
          return true
        }
      }
    }
    return false
  }
}

const constructors = {
  Object,
  Array,
  Function,
  Number,
  String,
  Date,
  RegExp,
  Buffer
}
