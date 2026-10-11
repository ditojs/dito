import { isArray, isObject } from '@ditojs/utils'
import { isTemporaryId } from './data.js'
import { getItemId, processSchemaData } from './schema/data.js'
import type { SchemaDataEntry } from './schema/data.js'
import { hasFormSchema, hasMultipleFormSchemas } from './schema/lookup.js'
import { isSourceWithResource } from './schema/structure.js'

type Schema = Record<string, any>
type Data = Record<string, any>

// A target object with the names of its values that are merged in place or
// kept, which aren't replaced by the values of the source object:
interface Merge {
  target: Data
  names: Set<string>
}

// Merges `source` into `target` in place along the components of `schema`, so
// that the objects of `target` keep their uids, stores and open forms. Values
// missing in `source` are removed, except the kept data of sources with their
// own resource, which responses don't contain.
export function mergeData(
  schema: Schema,
  target: Data,
  source: Data,
  {
    component = null,
    shouldKeepSourcesWithResource = false
  }: {
    component?: object | null
    shouldKeepSourcesWithResource?: boolean
  } = {}
): Data {
  const mergesBySource = new Map<Data, Merge>()
  const addMerge = (source: Data, target: Data) => {
    mergesBySource.set(source, { target, names: new Set() })
  }
  addMerge(source, target)

  // 1. Match the objects of `source` with the ones of `target` and merge the
  // lists in place. The walk calls `before()` before it walks the items:
  const before = ({ schema, data, name }: SchemaDataEntry) => {
    const merge = mergesBySource.get(data)
    // New items have no target, and components of the same name, e.g. in
    // several tabs, are merged only once:
    if (merge && !merge.names.has(name)) {
      const sourceValue = data[name]
      const targetValue = merge.target[name]
      if (shouldKeepSourcesWithResource && isSourceWithResource(schema)) {
        merge.names.add(name)
      } else if (hasFormSchema(schema)) {
        if (isArray(sourceValue) && isArray(targetValue)) {
          mergeList(schema, targetValue, sourceValue, addMerge)
          merge.names.add(name)
        } else if (
          isObject(sourceValue) &&
          isObject(targetValue) &&
          hasSameFormSchema(schema, sourceValue, targetValue)
        ) {
          addMerge(sourceValue, targetValue)
          merge.names.add(name)
        }
      }
    }
  }
  processSchemaData(schema, source, {
    before,
    options: { component, rootData: source }
  })

  // 2. Replace all other values of the matched objects:
  for (const [source, { target, names }] of mergesBySource) {
    for (const key of Object.keys(target)) {
      if (!(key in source) && !names.has(key)) {
        delete target[key]
      }
    }
    for (const [key, value] of Object.entries(source)) {
      if (!names.has(key)) {
        target[key] = value
      }
    }
  }
  return target
}

// Matches the items of the lists by the ids of `sourceSchema`. The remaining
// items are matched with the new items of `target` in order, as the server
// keeps the order of new items when it gives them their ids.
function mergeList(
  sourceSchema: Schema,
  target: any[],
  source: any[],
  addMerge: (source: Data, target: Data) => void
) {
  const getId = (item: any) =>
    isObject(item) ? getItemId(sourceSchema, item) : undefined
  const targetItemsById = new Map<string | undefined, Data>()
  const newTargetItems: Data[] = []
  for (const item of target) {
    const id = getId(item)
    if (id !== undefined) {
      targetItemsById.set(id, item)
    }
    if (isObject(item) && (id === undefined || isTemporaryId(id))) {
      newTargetItems.push(item)
    }
  }
  const matchedItems = source.map(item => targetItemsById.get(getId(item)))
  const matchedItemSet = new Set(matchedItems)
  const unmatchedNewTargetItems = newTargetItems.filter(
    item => !matchedItemSet.has(item)
  )
  const items = source.map((item, index) => {
    const targetItem = (
      matchedItems[index] ??
      (isObject(item) ? unmatchedNewTargetItems.shift() : undefined)
    )
    if (targetItem && hasSameFormSchema(sourceSchema, item, targetItem)) {
      addMerge(item, targetItem)
      return targetItem
    }
    return item
  })
  target.splice(0, target.length, ...items)
}

// Items of sources with several forms are only merged if they have the same
// type, which selects their form. Otherwise, they're replaced, as they have a
// different shape.
function hasSameFormSchema(sourceSchema: Schema, source: Data, target: Data) {
  return !hasMultipleFormSchemas(sourceSchema) || source.type === target.type
}
