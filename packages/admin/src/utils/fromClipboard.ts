import { asArray, clone } from '@ditojs/utils'
import { createTemporaryId, isTemporaryId } from './data.js'
import { processSchemaData } from './schema/data.js'
import { getSourceType } from './schema/types.ts'
import { isSourceWithResource } from './schema/structure.js'
import type { Data, Schema, SchemaDataEntry } from './types.ts'

// Copied items have no ids, except the related ones, which `SchemaGraph` marked
// as temporary. We replace these with new ones, so pasting twice doesn't repeat
// them. Sources with their own resource are left out, as they save their items.
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
