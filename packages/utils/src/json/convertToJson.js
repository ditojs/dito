import { isArray, isPlainObject } from '../base/index.js'

export function convertToJson(arg) {
  return arg?.toJSON
    ? arg.toJSON()
    : isPlainObject(arg)
      ? convertToJsonObject(arg)
      : isArray(arg)
        ? convertToJsonArray(arg)
        : arg
}

function convertToJsonObject(arg) {
  const json = {}
  for (const key of Object.keys(arg)) {
    json[key] = convertToJson(arg[key])
  }
  return json
}

function convertToJsonArray(arg) {
  const ret = new Array(arg.length)
  for (let i = 0, l = arg.length; i < l; ++i) {
    ret[i] = convertToJson(arg[i])
  }
  return ret
}
