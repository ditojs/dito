import { isArray, isPlainObject } from '@ditojs/utils'

/**
 * Converts Models to their external representation by calling the `$toJson()`
 * method. It does not create a JSON string, but a plain object. It is necessary
 * to do this before the validation is performed, otherwise different properties
 * might end up in the Json response. This is done recursively, so that nested
 * models are also converted. Streams, Buffers and other non plain objects are
 * left as-is, so this can directly be used on any results.
 */
export function convertModelsToJson(value) {
  return value?.$isObjectionModel
    ? value.$toJson()
    : isPlainObject(value)
      ? convertToJsonObject(value)
      : isArray(value)
        ? convertToJsonArray(value)
        : value
}

function convertToJsonObject(value) {
  const object = {}
  for (const key of Object.keys(value)) {
    object[key] = convertModelsToJson(value[key])
  }
  return object
}

function convertToJsonArray(value) {
  const array = new Array(value.length)
  for (let i = 0, l = value.length; i < l; ++i) {
    array[i] = convertModelsToJson(value[i])
  }
  return array
}
