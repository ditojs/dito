import { isArray, isPlainObject } from '@ditojs/utils'

/**
 * Converts Objection Models to their external representation by calling the
 * `$toJson` method. It does not create a Json string, but a plain object. It is
 * necessary to do this before the validation is performed, otherwise different
 * properties might end up in the Json response. This is done recursively, so
 * that nested models are also converted. Streams, Buffers and other non plain
 * objects are left as-is, so this can directly be used on any results.
 */
export function convertModelsToJsonObjects(arg) {
  return arg.$isObjectionModel
    ? arg.$toJson()
    : isPlainObject(arg)
      ? toJsonObject(arg)
      : isArray(arg)
        ? toJsonArray(arg)
        : arg
}

function toJsonObject(arg) {
  const json = {}
  const keys = Object.keys(arg)
  for (let i = 0, l = keys.length; i < l; ++i) {
    const key = keys[i]
    const value = arg[key]
    const jsonValue = convertModelsToJsonObjects(value)
    json[key] = jsonValue
  }
  return json
}

function toJsonArray(arg) {
  const ret = new Array(arg.length)
  for (let i = 0, l = ret.length; i < l; ++i) {
    const item = arg[i]
    ret[i] = convertModelsToJsonObjects(item)
  }
  return ret
}
