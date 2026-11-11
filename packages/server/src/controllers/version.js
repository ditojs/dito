import { isDate, isNumber, isString } from '@ditojs/utils'
import { ResponseError } from '../errors/index.js'

// Models mark one property with `version: true`. Member actions that return
// such a model send its version in the `Dito-Record-Version` header, and saves
// that send it back fail with status 412 if the record's version differs. Only
// the version of the record that the request addresses counts. These saves
// read it with a lock until their transaction ends, and write the next version,
// also when they only change relations. The version is opaque to clients.
export const versionHeader = 'Dito-Record-Version'

export function formatVersion(value) {
  return JSON.stringify(value instanceof Date ? value.toISOString() : value)
}

// The version of a returned model. Read it when the model holds none, as when
// a scope leaves out the version property, or when an instance patch leaves
// the expression that counts it up. Then also put it on the model:
export async function getModelVersion(model, transaction) {
  const { constructor: modelClass } = model
  const name = modelClass.versionProperty
  const value = model[name]
  if (
    value === null ||
    isNumber(value) ||
    isString(value) ||
    isDate(value)
  ) {
    return formatVersion(value)
  }
  const record = await modelClass
    .query(transaction)
    .ignoreScope()
    .findById(model.$id())
    .select(name)
  if (!record) return null
  if (name in model) {
    model[name] = record[name]
  }
  return formatVersion(record[name])
}

// Read the version of the addressed record with a lock, and fail if it differs
// from the one in the request. Missing records respond with 404. The scopes of
// relations still apply, as they pick their members. The lock names the
// model's table, so that it leaves the pivot rows of relations alone:
export async function checkVersion(ctx, controller) {
  const { modelClass } = controller
  const name = modelClass.versionProperty
  const record = await controller.execute(ctx, (query, transaction) =>
    query
      .clearWithScope()
      .ignoreScope('default')
      .findById(ctx.memberId)
      .select(name)
      .throwIfNotFound()
      .modify(
        query => transaction && query.forUpdate(query.tableRefFor(modelClass))
      )
  )
  if (ctx.get(versionHeader) !== formatVersion(record[name])) {
    throw new ResponseError({
      message: (
        'The record changed since it was loaded. Copy your unsaved ' +
        'changes, then reload it.'
      ),
      status: 412
    })
  }
  return record[name]
}

// Checked saves write the next version, never one from the body, also when
// they only change relations. Other saves write it when the record changes:
export function addNextVersion(ctx, modelClass, body) {
  const name = modelClass.versionProperty
  return name && body && ctx.memberVersion !== undefined
    ? { ...body, [name]: modelClass.getNextVersion(ctx.memberVersion) }
    : body
}
