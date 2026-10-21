import { asArray, clone, isArray, isObject } from '@ditojs/utils'
import SchemaContext from '../SchemaContext.js'
import { createTemporaryId, isTemporaryId } from './data.js'
import { getText } from './html.js'
import { deserializeData, getLabel } from './schema/data.js'
import { findOptionsForLabel, getRelateKey } from './schema/options.ts'
import { walkData, type FieldEntry } from './schema/walk.js'
import type { Services } from './services.ts'
import type { Data, Schema } from './types.ts'

// Copied items have no ids, except the related ones, which `SchemaGraph`
// replaced with temporary ones. We replace these with new ones, so pasting
// twice doesn't repeat them. Sources with their own resource are left out, as
// they save their items. Relations to records outside of the copy hold labels,
// which resolve to the option that matches them, or else are left out.
export async function fromClipboard(
  schema: Schema,
  clipboardData: Data,
  {
    dataPath = null,
    services = null,
    rootData = null
  }: {
    dataPath?: string | null
    services?: Services | null
    rootData?: Data | null
  } = {}
): Promise<{ data: Data; unresolvedLabels: string[] }> {
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

  // Use the same id keys as `SchemaGraph.serialize()`:
  const labeledEntries: FieldEntry[] = []
  const handleEntry = (entry: FieldEntry) => {
    const { schema, data, name } = entry
    if (schema.relate) {
      replaceTemporaryIds(data[name], getRelateKey(schema)!)
      if (asArray(data[name]).some(isLabel)) {
        labeledEntries.push(entry)
      }
    }
  }
  const walkOptions = { services, rootData: rootData ?? data }
  walkData(schema, data, {
    dataPath,
    ...walkOptions,
    visit: entry => {
      const { node, data, name } = entry
      if (node.source?.hasResource) {
        delete data[name]
      } else if (node.source?.isSource) {
        replaceTemporaryIds(data[name], node.source.idKey)
      } else {
        for (const { schema } of node.fields) {
          handleEntry({ ...entry, schema })
        }
      }
    }
  })
  deserializeData(schema, data, { dataPath, ...walkOptions })

  const resolveLabels = async (entry: FieldEntry) => {
    const { schema, data, name } = entry
    // The options of the pasted values, loaded like the ones of fields:
    const options = (await services!
      .dataContext!.model.getOptionsResolver(entry)
      .waitForValue()) ?? []
    const context = SchemaContext.createForSchema(services, {
      ...entry,
      rootData: walkOptions.rootData
    })
    const fieldLabel = getText(getLabel(schema, context, name))
    const unresolvedLabels: string[] = []
    const resolve = (value: any) => {
      if (isLabel(value)) {
        const { $label: label } = value
        const found = findOptionsForLabel(schema, options, label, context)
        if (found.length === 1) {
          return found[0]
        }
        unresolvedLabels.push(`${fieldLabel} '${label}'`)
        return null
      }
      return value
    }
    const value = data[name]
    data[name] = isArray(value)
      ? value.map(resolve).filter(value => value !== null)
      : resolve(value)
    return unresolvedLabels
  }

  const unresolvedLabels = await Promise.all(labeledEntries.map(resolveLabels))
  return { data, unresolvedLabels: unresolvedLabels.flat() }
}

function isLabel(value: any) {
  return isObject(value) && '$label' in value
}
