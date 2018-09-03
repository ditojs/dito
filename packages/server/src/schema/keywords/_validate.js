import Ajv from 'ajv'
import { isNumber, isArray } from '@ditojs/utils'

export const validate = {
  metaSchema: {
    instanceof: 'Function'
  },
  errors: 'full',

  validate: function validate(func, ...args) {
    // The validator's `ctx` as passed to Ajv with passContext as `this`:
    const params = getParams(this, ...args)
    let result
    try {
      result = func(params) ?? true
    } catch (error) {
      // In sync validation, we have to pass the errors back to Ajv through
      // `validate.errors`.
      validate.errors = getErrors(error, params)
      result = false
    }
    return result
  }
}

// This is the async version of the above, to handle async `validate()`
// functions in schemas. See `Validator.processSchema()` for details.
export const validateAsync = {
  ...validate,
  async: true,

  async validate(func, ...args) {
    // The validator's `ctx` as passed to Ajv with passContext as `this`:
    const params = getParams(this, ...args)
    let result
    try {
      result = (await func(params)) ?? true
    } catch (error) {
      // Async validate methods need to throw their errors.
      throw new Ajv.ValidationError(getErrors(error, params))
    }
    return result
  }
}

function getParams(
  ctx,
  // This is the sequence by which these parameters are received from Ajv.
  data,
  parentSchema,
  dataPath,
  parentData,
  parentDataProperty,
  rootData
) {
  return {
    data,
    parentData,
    rootData,
    dataPath,
    // NOTE: We rename parentDataProperty to parentKey / parentIndex:
    [isNumber(parentDataProperty) ? 'parentIndex' : 'parentKey']:
      parentDataProperty,
    ctx,
    app: ctx.app,
    validator: ctx.validator,
    options: ctx.options
  }
}

function getErrors(error, { validator, dataPath }) {
  const errors = isArray(error.errors)
    // Ajv errors array:
    ? error.errors
    // Convert string error message to errors array:
    : [{
      keyword: 'validate',
      message: error.message || error.toString(),
      params: {}
    }]
  // Return errors prefixed with the current dataPath:
  return validator.prefixDataPaths(errors, dataPath)
}
