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
    const ctx = this // The validator's ctx as passed to Ajv with passContext
    let result
    try {
      result = func({
        // TODO: Use the same naming as in the rest of Dito here
        data,
        dataPath,
        parentData,
        parentDataProperty,
        rootData,
        ctx,
        app: ctx.app,
        validator: ctx.validator,
        options: ctx.options
      })
    } catch (err) {
      result = err.message || err.toString()
    }
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
      validate.errors = this.validator.prefixDataPaths(result, dataPath)
      result = false
    }
    return result === undefined ? true : result
  },

  errors: 'full'
}
