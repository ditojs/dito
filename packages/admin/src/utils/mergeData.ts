import { isArray, isObject, pickBy } from '@ditojs/utils'
import { isTemporaryId } from './data.js'
import {
  getItemId,
  getItemUid,
  deserializeData
} from './schema/data.js'
import { hasFormSchema, hasMultipleFormSchemas } from './schema/lookup.js'
import { hasNestedData, isSourceWithResource } from './schema/structure.js'
import {
  walkData,
  type DataEntry,
  type WalkedDataEntry
} from './schema/walk.js'
import type { Data, Schema } from './types.ts'

// The names of the values that are merged in place or kept, not replaced:
interface Merge {
  target: Data
  names: Set<string>
}

// Merge in place, so the objects of `target` keep their uids, stores and open
// forms. List items are matched by their ids, or by their uids if `source` is a
// copy of `target` that shares them, e.g. the draft of a nested form.
export function mergeData(
  schema: Schema,
  target: Data,
  source: Data,
  {
    services = null,
    shouldKeepSourcesWithResource = false,
    shouldMatchUids = false
  }: {
    services?: object | null
    shouldKeepSourcesWithResource?: boolean
    shouldMatchUids?: boolean
  } = {}
): Data {
  const mergesBySource = new Map<Data, Merge>()
  const addMerge = (source: Data, target: Data) => {
    mergesBySource.set(source, { target, names: new Set() })
  }
  addMerge(source, target)

  // 1. Match the objects of `source` with the ones of `target` and merge the
  // lists in place. The walk visits the fields before it walks the items:
  const mergeField = ({ data, name }: DataEntry, schema: Schema) => {
    const merge = mergesBySource.get(data)
    // New items have no target, and of several fields of the same value, e.g.
    // in several tabs, the first one that can merges it:
    if (merge && !merge.names.has(name)) {
      const sourceValue = data[name]
      const targetValue = merge.target[name]
      if (shouldKeepSourcesWithResource && isSourceWithResource(schema)) {
        merge.names.add(name)
      } else if (hasFormSchema(schema)) {
        if (isArray(sourceValue) && isArray(targetValue)) {
          mergeList(schema, targetValue, sourceValue, addMerge, shouldMatchUids)
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
  walkData(schema, source, {
    services,
    visit: entry => {
      for (const { schema } of entry.node.fields) {
        mergeField(entry, schema)
      }
    }
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

// Merge `values` from the server into `target` like `mergeData()`, but keep the
// values that they lack. We deserialize them as part of the whole item, which
// their callbacks see:
export function mergeValues(
  schema: Schema,
  target: Data,
  values: Data,
  {
    services,
    dataPath,
    rootData
  }: {
    services: object | null
    dataPath: string
    rootData: Data | null
  }
): Data {
  const item = { ...target, ...values }
  deserializeData(schema, item, {
    services,
    dataPath,
    rootData,
    // Walk the unnested components of the item, e.g. sections, but only the
    // values of `values`:
    shouldWalk: ({ schema, data, name }: WalkedDataEntry) => (
      data !== item || !hasNestedData(schema) || Object.hasOwn(values, name!)
    )
  })
  const isMerged = (_: unknown, key: PropertyKey) => Object.hasOwn(values, key)
  return Object.assign(
    target,
    mergeData(schema, pickBy(target, isMerged), pickBy(item, isMerged), {
      services
    })
  )
}

// Match the remaining items with the new items of `target` in order, as the
// server keeps the order of new items when it gives them their ids.
// Copies that share the uids of their items are matched by these only:
function mergeList(
  sourceSchema: Schema,
  target: any[],
  source: any[],
  addMerge: (source: Data, target: Data) => void,
  shouldMatchUids: boolean
) {
  const getKey = (item: any) =>
    isObject(item)
      ? shouldMatchUids
        ? getItemUid(sourceSchema, item)
        : getItemId(sourceSchema, item)
      : undefined
  const targetItemsByKey = new Map<string | undefined, Data>()
  const newTargetItems: Data[] = []
  for (const item of target) {
    const key = getKey(item)
    if (key !== undefined) {
      targetItemsByKey.set(key, item)
    }
    if (
      !shouldMatchUids &&
      isObject(item) &&
      (key === undefined || isTemporaryId(key))
    ) {
      newTargetItems.push(item)
    }
  }
  const matchedItems = source.map(item => targetItemsByKey.get(getKey(item)))
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

// Items of a different type have a different shape, and are replaced:
function hasSameFormSchema(sourceSchema: Schema, source: Data, target: Data) {
  return !hasMultipleFormSchemas(sourceSchema) || source.type === target.type
}
