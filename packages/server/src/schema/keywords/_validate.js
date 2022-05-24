import Ajv from 'ajv/dist/2020.js'
import { isNumber, isArray } from '@ditojs/utils'

export const validate = {
  metaSchema: {
    instanceof: 'Function'
  },
  errors: 'full',

  validate: function validate(func, data, parentSchema, dataCtx) {
    // The validator's `ctx` as passed to Ajv with passContext as `this`:
    const params = getParams(this, data, parentSchema, dataCtx)
    try {
      return func(params) ?? true
    } catch (error) {
      // In sync validation, we have to pass the errors back to Ajv through
      // `validate.errors`.
      validate.errors = getErrors(error, params)
      return false
    }
  }
}

// This is the async version of the above, to handle async `validate()`
// functions in schemas. See `Validator.processSchema()` for details.
export const validateAsync = {
  ...validate,
  async: true,

  async validate(func, data, parentSchema, dataCtx) {
    // The validator's `ctx` as passed to Ajv with passContext as `this`:
    const params = getParams(this, data, parentSchema, dataCtx)
    try {
      return (await func(params)) ?? true
    } catch (error) {
      // Async validate methods need to throw their errors.
      throw new Ajv.ValidationError(getErrors(error, params))
    }
  }
}

function getParams(ctx, data, parentSchema, dataCtx) {
  const { instancePath, parentData, parentDataProperty, rootData } = dataCtx
  return {
    data,
    parentData,
    rootData,
    instancePath,
    // NOTE: We rename parentDataProperty to parentKey / parentIndex:
    [isNumber(parentDataProperty) ? 'parentIndex' : 'parentKey']:
      parentDataProperty,
    ctx,
    app: ctx.app,
    validator: ctx.validator,
    options: ctx.options
  }
}

function getErrors(error, { validator, instancePath }) {
  const errors = isArray(error.errors)
    // Ajv errors array:
    ? error.errors
    // Convert string error message to errors array:
    : [{
      keyword: 'validate',
      message: error.message || error.toString(),
      params: {}
    }]
  // Return errors prefixed with the current instancePath:
  return validator.prefixInstancePaths(errors, instancePath)
}
