import { isArray, isObject, equals } from '@ditojs/utils'
import type { Data } from './types.ts'

// For deltas, member responses send the relations of the record in
// `Dito-Record-Graph`, like `{ chapters: { pages: {} } }`. Patches of deltas
// hold `'#delta': true`, the changed values whole, the changed rows of lists by
// id with only their changed values, and removed rows as
// `{ id, '#removed': true }`.
export interface RecordGraph {
  [name: string]: RecordGraph
}

// The id key of the rows of the list at a data path without indexes:
export type GetIdKey = (path: string) => string

// Apps can replace `api.request()` with one whose responses have no headers:
export function getRecordGraph(response: Response): RecordGraph | null {
  const graph = response?.headers?.get('Dito-Record-Graph')
  try {
    return graph ? JSON.parse(graph) : null
  } catch {
    return null
  }
}

// Both `base` and `data` are serialized:
export function getDelta(
  base: Data,
  data: Data,
  graph: RecordGraph,
  getIdKey: GetIdKey = () => 'id',
  path = ''
): Data {
  const delta: Data = {}
  for (const [key, value] of Object.entries(data)) {
    const change = Object.hasOwn(graph, key)
      ? getRelationDelta(
          base[key],
          value,
          graph[key],
          getIdKey,
          path ? `${path}/${key}` : key
        )
      : equals(value, base[key])
        ? undefined
        : value
    if (change !== undefined) {
      delta[key] = change
    }
  }
  return delta
}

// Return `undefined` if the relation didn't change:
function getRelationDelta(
  base: any,
  value: any,
  graph: RecordGraph,
  getIdKey: GetIdKey,
  path: string
): any {
  const idKey = getIdKey(path)
  const getId = (row: Data) => (row[idKey] != null ? String(row[idKey]) : null)
  if (isArray(value)) {
    const baseRows = new Map(
      (isArray(base) ? base : []).map(row => [getId(row), row])
    )
    const rows = []
    for (const row of value) {
      const id = getId(row)
      const baseRow = id !== null ? baseRows.get(id) : undefined
      if (baseRow) {
        baseRows.delete(id)
        const change = getRowDelta(baseRow, row, graph, getIdKey, path, idKey)
        if (change) {
          rows.push(change)
        }
      } else {
        // New rows, and rows that the list relates, go whole:
        rows.push(row)
      }
    }
    for (const row of baseRows.values()) {
      rows.push({ [idKey]: row[idKey], '#removed': true })
    }
    return rows.length > 0 ? rows : undefined
  } else if (isObject(value) && isObject(base) && getId(value) !== null) {
    // To-one values are complete, so other records go whole:
    return getId(value) === getId(base)
      ? getRowDelta(base, value, graph, getIdKey, path, idKey)
      : value
  }
  return equals(value, base) ? undefined : value
}

function getRowDelta(
  base: Data,
  row: Data,
  graph: RecordGraph,
  getIdKey: GetIdKey,
  path: string,
  idKey: string
) {
  // The ids matched already, also when one of them is a string:
  const { [idKey]: id, ...delta } = getDelta(base, row, graph, getIdKey, path)
  return Object.keys(delta).length > 0
    ? { [idKey]: row[idKey], ...delta }
    : undefined
}
