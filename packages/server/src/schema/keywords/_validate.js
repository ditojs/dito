import Ajv from 'ajv'
import { isString, isArray } from '@ditojs/utils'

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
      result = getErrorResult(error)
    }
    const errors = getErrorsArray(result, params)
    if (errors) {
      result = false
      validate.errors = errors
    }
    return result
  }
}

// This is the async version of the above, to handle async `validate()`
// functions in schemas. See `Validator.processSchema()` for details.
export const validateAsync = {
  ...validate,
  async: true,

  validate: async function validate(func, ...args) {
    // The validator's `ctx` as passed to Ajv with passContext as `this`:
    const params = getParams(this, ...args)
    let result
    try {
      result = (await func(params)) ?? true
    } catch (error) {
      result = getErrorResult(error)
    }
    const errors = getErrorsArray(result, params)
    if (errors) {
      // Async validate methods need to throw their errors.
      throw new Ajv.ValidationError(errors)
    }
    return result
  }
}

function getParams(
  ctx,
  data,
  parentSchema,
  dataPath,
  parentData,
  parentDataProperty,
  rootData
) {
  return {
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
  }
}

function getErrorResult(error) {
  return isArray(error.errors)
    // Ajv errors array:
    ? error.errors
    // String error messages:
    : error.message || error.toString()
}

function getErrorsArray(result, { validator, dataPath }) {
  if (isString(result)) {
    // Convert string error message to errors array:
    result = [{
      keyword: 'validate',
      message: result,
      params: {}
    }]
  }
  if (isArray(result)) {
    // Prefix errors with the current dataPath and pass through:
    return validator.prefixDataPaths(result, dataPath)
  }
}
