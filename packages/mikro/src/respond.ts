import { isArray, isPlainObject } from '@ditojs/utils'
import { serialize } from '@mikro-orm/core'
import type { ModelRequest } from './ModelRequest.ts'
import { serializeResult } from './serialize.ts'

export async function respond(request: ModelRequest, result: unknown) {
  const { c, entity } = request
  const isRecord = (value: unknown) => value instanceof entity
  const records = findRecords(result, isRecord)
  let reloaded = new Map<object, object>()
  // Flush writes also for results that aren't rows, such as the count of a
  // delete:
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    await request.em.flush()
    reloaded = await reload(request, records)
    if (c.var.action === 'post' && isRecord(result)) {
      request.setRecord(result)
      setLocation(request, result)
    }
  }
  const { beforeSerializers, serializers } = request.definition
  const getRow = (row: object) => reloaded.get(row) ?? row
  const rows = records.map(getRow)
  const jsonByRow = new Map<object, unknown>()
  const getOutput = async () => (
    request.output ?? (await request.getResolvedFind()).output
  )
  if (rows.length) {
    for (const beforeSerialize of beforeSerializers) {
      await beforeSerialize({ ...c.var, c, records: rows })
    }
    const items = serialize(rows, await getOutput())
    rows.forEach((row, index) => jsonByRow.set(row, items[index]))
  }
  // After `beforeSerialize`, so that `serialize` gets the variables it sets:
  const context = { ...c.var, c }
  return serializeResult(result, isRecord, async record => {
    const row = getRow(record as object)
    // Entities in the result can hold records that `findRecords()` can't reach:
    let json: unknown = (
      jsonByRow.get(row) ??
      serialize(row, await getOutput())
    )
    for (const layer of serializers) {
      json = await layer({ ...context, record: row, json })
    }
    return json
  })
}

// Load the rows again in one query, in their shape, for formulas and values
// that triggers set:
async function reload(request: ModelRequest, records: object[]) {
  const reloaded = new Map<object, object>()
  if (records.length) {
    const { em, entity, key } = request
    const { options } = await request.getResolvedFind()
    const getId = (row: object) => (row as Record<string, unknown>)[key.name]
    const where = { [key.name]: { $in: records.map(getId) } }
    // A refresh in `em` would leave the columns outside of the shape out of its
    // snapshots, and the next flush would write them:
    const rows = await em
      .fork({ keepTransactionContext: true })
      .find(entity, where as never, options)
    const rowsById = new Map(rows.map(row => [getId(row), row]))
    for (const record of records) {
      const row = rowsById.get(getId(record))
      if (row) reloaded.set(record, row)
    }
  }
  return reloaded
}

function setLocation({ c, key }: ModelRequest, row: unknown) {
  const id = (row as Record<string, unknown>)[key.name]
  const path = new URL(c.req.url).pathname.replace(/\/$/, '')
  c.status(201)
  c.header('Location', `${path}/${id}`)
}

// Find records also in arrays and plain objects, such as the `results` of a
// page:
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
