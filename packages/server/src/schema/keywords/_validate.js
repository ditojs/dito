import { isString, isArray } from '@ditojs/utils'

export const validate = {
  metaSchema: {
    instanceof: 'Function'
  },

  validate: function validate(
    func,
    data,
    parentSchema,
    dataPath,
    parentData,
    parentDataProperty,
    rootData
  ) {
    let result = func.call(this, {
      // TODO: Use the same naming as in the rest of Dito here
      data,
      dataPath,
      parentData,
      parentDataProperty,
      rootData
    })
    if (isString(result)) {
      result = [{
        keyword: 'validate',
        message: result,
        params: {}
      }]
    }
    if (isArray(result)) {
      // An array of error was returned. Prefix them with the current dataPath,
      // and pass them through:
      validate.errors = this.prefixDataPaths(result, dataPath)
      result = false
    }
    return result
  },

  errors: 'full'
}
