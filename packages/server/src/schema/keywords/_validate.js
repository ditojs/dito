import { isArray } from '@ditojs/utils'

export const validate = {
  metaSchema: {
    instanceof: 'Function'
  },

  validate: function validate(
    schema,
    data,
    parentSchema,
    dataPath,
    parentData,
    property,
    rootData
  ) {
    let result = schema.call(this, {
      data,
      parentSchema,
      dataPath,
      parentData,
      property,
      rootData
    })
    if (isArray(result)) {
      // An array of error was returned. Prefix them with the current dataPath,
      // and pass them through:
      validate.errors = this.prefixDataPaths(result, dataPath)
      result = false
    }
    return result
  }
}
