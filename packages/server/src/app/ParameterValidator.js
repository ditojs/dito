import { isString, isObject, asArray } from '@ditojs/utils'

// Validates parameters, as defined by action and filter handlers, and coerces
// them where Ajv doesn't, e.g. to dates, objects and model instances.
export class ParameterValidator {
  constructor(app, parameters, options = {}) {
    this.app = app
    const { list, schema, asObject, dataName, validate, hasModelRefs } =
      app.compileParametersValidator(parameters, options)
    this.list = list
    this.schema = schema
    this.asObject = asObject
    this.dataName = dataName
    this.validate = validate
    // The schema doesn't change, so determine this once and not per request.
    this.hasModelRefs = hasModelRefs
  }

  getParameterKey({ name }) {
    // Use `dataName` if no name is given, see:
    // `Application.compileParametersValidator()`
    return name || this.dataName
  }

  /**
   * Coerces and validates the parameters in `params`, keyed by
   * `getParameterKey()`. Coerced values replace the original ones in `params`.
   *
   * @param {Object} params the parameters to coerce and validate
   * @return {Object[]|Promise<Object[]>} the validation errors, returned as a
   *   promise if the validator is asynchronous
   */
  validateParameters(params) {
    const errors = this.coerceParameters(params)
    const addErrors = error => {
      if (!error.errors) throw error
      errors.push(...error.errors)
      return errors
    }
    try {
      const result = this.validate?.(params)
      if (result instanceof Promise) {
        return result.then(() => errors, addErrors)
      }
    } catch (error) {
      addErrors(error)
    }
    return errors
  }

  coerceParameters(params) {
    const errors = []
    for (const parameter of this.list) {
      // Member parameters are resolved separately, see `MemberAction`.
      if (parameter.from === 'member') continue
      const { type } = parameter
      const key = this.getParameterKey(parameter)
      try {
        const value = params[key]
        // `validate()` coerces data to the required formats, according to the
        // rules specified here:
        // https://github.com/epoberezkin/ajv/blob/master/COERCION.md
        // Coercion isn't currently offered for 'object' and 'date' types,
        // so handle these cases prior to the call of `validate()`:
        const coerced = this.coerceValue(type, value, {
          // The model validation is handled separately through `$ref`.
          skipValidation: true
        })
        // If coercion happened, replace value in params with coerced one:
        if (coerced !== value) {
          params[key] = coerced
        }
      } catch (err) {
        // Convert error to Ajv validation error format:
        errors.push({
          instancePath: `/${key}`,
          keyword: 'type',
          message: err.message || err.toString(),
          params: { type }
        })
      }
    }
    return errors
  }

  coerceValue(type, value, modelOptions) {
    // See if param needs additional coercion:
    if (value && ['date', 'datetime', 'timestamp'].includes(type)) {
      return new Date(value)
    }
    const { models } = this.app
    // See if the defined type(s) require coercion to objects:
    const objectType = asArray(type).find(
      // Coerce to object if type is 'object' or a known model name.
      type => type === 'object' || type in models
    )
    if (objectType) {
      if (value && isString(value)) {
        value = parseObjectNotation(value)
      }
      if (objectType !== 'object' && isObject(value)) {
        // Convert the Pojo to the desired Dito.js model:
        const modelClass = models[objectType]
        if (modelClass && !(value instanceof modelClass)) {
          value = modelClass.fromJson(value, modelOptions)
        }
      }
    }
    return value
  }
}

function parseObjectNotation(value) {
  if (/^\{.*\}$/.test(value)) {
    return JSON.parse(value)
  }
  // Convert simplified Dito.js object notation to JSON, supporting:
  // - `"key1":X, "key2":Y` (curly braces are added and parsed through
  //   `JSON.parse()`)
  // - `key1:X,key2:Y` (a simple parser is applied, splitting into entries and
  //   key/value pairs, values are parsed with `JSON.parse()`, falling back to
  //   string.
  if (/"/.test(value)) {
    // Just add the curly braces and parse as JSON
    return JSON.parse(`{${value}}`)
  }
  // A simple version of named key/value pairs, values can be strings or
  // numbers.
  return Object.fromEntries(
    value.split(/\s*,\s*/g).map(entry => {
      let [key, val] = entry.split(/\s*:\s*/)
      try {
        // Try parsing basic types, but fall back to unquoted string.
        val = JSON.parse(val)
      } catch {}
      return [key, val]
    })
  )
}
