import { asArray, clone } from '@ditojs/utils'
import { createTemporaryId, isTemporaryId } from './data.js'
import { processSchemaData } from './schema/data.js'
import type { SchemaDataEntry } from './schema/data.js'
import { getSourceType } from './schema/types.js'
import { isSourceWithResource } from './schema/structure.js'
import type { Data, Schema } from './types.ts'

// Turns data that `processData()` copied for the clipboard back into data of
// new items for `schema`. Copied items have no ids, except the related ones,
// which `SchemaGraph` marked as temporary for their relations. We replace these
// with new ones, so pasting twice doesn't repeat them. Converted values, e.g.
// dates and related objects, keep their copied shape, the one of loaded data.
// Sources with their own resource are left out, as they save their own items.
export function fromClipboard(
  schema: Schema,
  clipboardData: Data,
  {
    dataPath = null,
    services = null,
    rootData = null
  }: {
    dataPath?: string | null
    services?: object | null
    rootData?: Data | null
  } = {}
): Data {
  const data = clone(clipboardData)
  const temporaryIds: Record<string, string> = {}
  const replaceTemporaryIds = (objects: any, idKey: string) => {
    for (const object of asArray(objects)) {
      const id = object?.[idKey]
      if (isTemporaryId(id)) {
        object[idKey] = temporaryIds[id] ??= createTemporaryId()
      }
    }
  }

  // Use the same id keys as `SchemaGraph.process()`:
  const before = ({ schema, data, name }: SchemaDataEntry) => {
    if (isSourceWithResource(schema)) {
      delete data[name]
    } else if (getSourceType(schema)) {
      replaceTemporaryIds(data[name], schema.idKey || 'id')
    } else if (schema.relate) {
      replaceTemporaryIds(data[name], schema.relateBy || 'id')
    }
  }
  processSchemaData(schema, data, {
    dataPath,
    before,
    options: { services, rootData: rootData ?? data }
  })
  return data
}
