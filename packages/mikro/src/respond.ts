import { isArray, isPlainObject } from '@ditojs/utils'
import { serialize } from '@mikro-orm/core'
import type { ModelRequest } from './model-request.ts'
import { serializeResult } from './serialize.ts'

// Turns the result of the handlers into the response. Writes flush here, also
// for results that aren't rows, such as the count of a delete. Then the records
// go through `beforeSerialize` and `serialize`, and other entities through
// `serializeResult()`.
export async function respond(request: ModelRequest, result: unknown) {
  const { c, entity, definition } = request
  const isRecord = (value: unknown) => value instanceof entity
  const records = findRecords(result, isRecord)
  let reloaded = new Map<object, object>()
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    await request.em.flush()
    reloaded = await reload(request, records)
    if (c.var.action === 'post' && isRecord(result)) {
      setLocation(request, result)
    }
  }
  const getRow = (row: object) => reloaded.get(row) ?? row
  if (records.length) {
    for (const beforeSerialize of definition.beforeSerializers) {
      await beforeSerialize(c, records.map(getRow))
    }
  }
  return serializeResult(result, isRecord, async record => {
    const output = request.output ?? (await request.query()).output
    const row = getRow(record as object)
    let json: unknown = serialize(row, output)
    for (const layer of definition.serializers) {
      json = await layer(c, row, json)
    }
    return json
  })
}

// Loads the rows again in one query, in their shape, for formulas and values
// that triggers set. A fork of `em` does it, in the same transaction, since a
// refresh in `em` would leave the columns outside of the shape out of its
// snapshots, and the next flush would write them. Returns the new row of each
// record.
async function reload(request: ModelRequest, records: object[]) {
  const reloaded = new Map<object, object>()
  if (!records.length) return reloaded
  const { em, entity, key } = request
  const { options } = await request.query()
  const getId = (row: object) => (row as Record<string, unknown>)[key.name]
  const rows = await em
    .fork({ keepTransactionContext: true })
    .find(entity, { [key.name]: { $in: records.map(getId) } } as never, options)
  const rowsById = new Map(rows.map(row => [getId(row), row]))
  for (const record of records) {
    const row = rowsById.get(getId(record))
    if (row) reloaded.set(record, row)
  }
  return reloaded
}

function setLocation({ c, key }: ModelRequest, row: unknown) {
  const id = (row as Record<string, unknown>)[key.name]
  const path = new URL(c.req.url).pathname.replace(/\/$/, '')
  c.status(201)
  c.header('Location', `${path}/${id}`)
}

// The records in a result: the result itself, or the records in its arrays and
// plain objects, such as the `results` of a page, each once.
function findRecords(value: unknown, isRecord: (value: unknown) => boolean) {
  const records = new Set<object>()
  const find = (value: unknown) => {
    if (isRecord(value)) records.add(value as object)
    else if (isArray(value)) value.forEach(find)
    else if (isPlainObject(value)) Object.values(value).forEach(find)
  }
  find(value)
  return [...records]
}
