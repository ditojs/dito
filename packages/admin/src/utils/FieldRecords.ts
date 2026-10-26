import {
  effectScope,
  computed,
  watch,
  watchEffect,
  shallowRef,
  toRaw,
  isProxy,
  type EffectScope,
  type ShallowRef
} from 'vue'
import { isArray, isPlainObject, equals } from '@ditojs/utils'
import SchemaContext from '../SchemaContext.js'
import { DataSchemaResolver } from './DataSchemaResolver.js'
import { toModelData, getParentDataPath, getRelativeDataPath } from './data.js'
import { getOptionsDataSchema } from './schema/types.ts'
import { getComputedValue } from './schema/data.js'
import {
  hasComputedValueSource,
  getMultipleValue,
  getEditedValue,
  parseEditedValue
} from './schema/value.js'
import { walkData, type DataEntry } from './schema/walk.js'
import { getOptionsSettings, getReplacedValue } from './schema/options.ts'
import { EntryMap } from './EntryMap.ts'
import type { DataModel } from './DataModel.ts'
import type { Schema } from './types.ts'

// The records of components with computed values or options:
interface FieldRecord {
  entry: FieldEntry
  // Reactive, as items that move keep their records:
  dataPath: ShallowRef<string>
  itemDataPath: ShallowRef<string | null>
  computedValueScope: EffectScope | null
  writeComputedValue: (() => void) | null
  optionsResolver: DataSchemaResolver | null
  optionsSchema: Schema | null
  optionsScope: EffectScope | null
}

// Only the walked entries bring along the `itemDataPath`, which differs from
// the derived one for wrapped values:
type FieldEntry = Pick<DataEntry, 'data' | 'name' | 'dataPath'> & {
  schema: Schema
  itemDataPath?: string | null
}

// The walked entries of the values with records, with the schema that records
// them, and a form of its own for the defaults of its computed values:
export type RecordedEntry = DataEntry & { schema: Schema; form: Schema }

// The records of the components in the data of a model, which write their
// computed values and resolve their options.
export class FieldRecords {
  readonly model: DataModel
  records = new EntryMap<FieldRecord>()
  #computedValueWriteCounts: Map<string | null, number> | null = null

  constructor(model: DataModel) {
    this.model = model
  }

  update(entries: EntryMap<RecordedEntry>) {
    const previousRecords = this.records
    this.records = new EntryMap()
    for (const entry of entries.values()) {
      const record = previousRecords.get(entry) ?? createFieldRecord(entry)
      previousRecords.delete(entry)
      if (record.entry.schema !== entry.schema) {
        record.computedValueScope?.stop()
        record.computedValueScope = null
        record.writeComputedValue = null
      }
      record.entry = entry
      record.dataPath.value = entry.dataPath!
      record.itemDataPath.value = entry.itemDataPath
      // Add the record first, as its watchers may read its options right away:
      this.records.set(entry, record)
      if (hasComputedValueSource(entry.schema)) {
        record.computedValueScope ??= this.#createComputedValueScope(record)
      }
    }
    for (const {
      computedValueScope,
      optionsScope
    } of previousRecords.values()) {
      computedValueScope?.stop()
      optionsScope?.stop()
    }
  }

  // Write the computed values of the current data right away, also of records
  // that the update of the data entries hasn't created yet.
  writeComputedValues() {
    const { dataEntries } = this.model
    let entries = dataEntries.value.recordedEntries
    this.update(entries)
    for (const record of this.records.values()) {
      record.writeComputedValue?.()
    }
    // The written values may hold items with computed values of their own,
    // e.g. lists that `computeValue()` creates, which their new records write:
    while (entries !== dataEntries.value.recordedEntries) {
      entries = dataEntries.value.recordedEntries
      this.update(entries)
    }
  }

  // Computes and components share the resolver, so they get the same options.
  getOptionsResolver(entry: FieldEntry): DataSchemaResolver {
    const record = this.#getRecord(entry)
    const options = getOptionsDataSchema(entry.schema)
    if (!record.optionsResolver || record.optionsSchema !== options) {
      record.optionsScope?.stop()
      record.optionsSchema = options
      record.optionsResolver = this.#createDataSchemaResolver(options, record)
      record.optionsScope = this.#createOptionsScope(record)
    }
    return record.optionsResolver
  }

  #getRecord(entry: FieldEntry): FieldRecord {
    let record = this.records.get(entry)
    if (!record) {
      record = createFieldRecord(entry)
      this.records.set(entry, record)
    }
    return record
  }

  // Records stop being current before their scope is stopped, as watchers
  // outside of components run in the order in which they're triggered.
  #createComputedValueScope(record: FieldRecord): EffectScope {
    const { schema } = record.entry
    const scope = this.model.scope.run(() => effectScope())!
    scope.run(() => {
      const isRecordCurrent = computed(() =>
        this.#isRecordCurrent(record, schema)
      )
      const dataSchemaResolver = schema.computeValue
        ? null
        : this.#createDataSchemaResolver(schema, record)
      // Return a new object each time, so that the value is also written when
      // only the value in the data changed, e.g. through user input:
      const currentResult = computed(() =>
        !isRecordCurrent.value
          ? null
          : schema.computeValue
            ? this.#getComputedValueResult(record)
            : dataSchemaResolver!.isLoading
              ? null
              : { value: dataSchemaResolver!.value }
      )
      const write = (result: { value: any } | null) => {
        if (result) {
          this.#writeComputedValue(
            record.entry as RecordedEntry,
            result.value
          )
        }
      }
      record.writeComputedValue = () => write(currentResult.value)
      watch(currentResult, write, modelWatchOptions)
      record.writeComputedValue()
    })
    return scope
  }

  #isRecordCurrent(record: FieldRecord, schema: Schema): boolean {
    const currentEntry = this.model.dataEntries.value.recordedEntries.get(
      record.entry
    )
    return currentEntry?.schema === schema
  }

  // Return `null` while `computeValue()` reads options that aren't loaded yet,
  // to keep the current value until they are.
  #getComputedValueResult(record: FieldRecord): { value: any } | null {
    const entry = record.entry as RecordedEntry
    const { node, schema, data, name } = entry
    try {
      const value = getComputedValue(
        schema,
        data,
        name,
        // Read the data paths through the record, so that only computes that
        // read their position run again when their items move:
        () => record.dataPath.value,
        {
          ...this.model.walkOptions,
          itemDataPath: () => record.itemDataPath.value,
          getOptions: getOptionsDataSchema(schema)
            ? () => this.#getLoadedOptions(entry)
            : null
        }
      )
      // Values that aren't computed stay, or get their defaults when missing:
      if (value !== undefined) {
        return { value }
      } else {
        const propertyNode = node.getPropertyNode(entry)
        return {
          value: propertyNode
            ? propertyNode.getValueOrDefault(entry)
            : data[name]
        }
      }
    } catch (error) {
      if (error === optionsNotLoaded) {
        return null
      }
      throw error
    }
  }

  // Options that resolve to `undefined` aren't loading, e.g. failed loads.
  #getLoadedOptions(entry: FieldEntry) {
    const resolver = this.getOptionsResolver(entry)
    if (resolver.isLoading) {
      throw optionsNotLoaded
    }
    return resolver.value
  }

  // Show the errors of the loads of the options, and replace the value once
  // they're loaded, see `getReplacedValue()`. The replaced value is derived
  // from the options, not an edit, so it's written directly.
  #createOptionsScope(record: FieldRecord): EffectScope {
    const resolver = record.optionsResolver!
    const scope = this.model.scope.run(() => effectScope())!
    scope.run(() => {
      // The error of the last load replaces the one of the previous load, e.g.
      // when the options load again after the data is replaced:
      watch(
        () => resolver.lastLoadError,
        (error, previousError) => {
          const dataPath = record.dataPath.value
          if (previousError) {
            this.model.errors.remove(dataPath, getErrorMessage(previousError))
          }
          if (error) {
            this.model.errors.add(dataPath, getErrorMessage(error))
          }
        }
      )
      // The options are requested while rendering, so write after it:
      watchEffect(() => {
        const options = resolver.value
        if (isArray(options)) {
          const { entry } = record
          const { schema, data, name } = entry
          const context = this.#createEntryContext(entry)
          // Replace the value that the component displays, like it would:
          const settings = getOptionsSettings(schema, options, {
            multiple: getMultipleValue(schema, context),
            isGrouped: false,
            createContext: values => context.extend({ options, ...values })
          })
          const replaced = getReplacedValue(
            settings,
            options,
            getEditedValue(schema, data[name], context)
          )
          if (replaced) {
            data[name] = toModelData(
              parseEditedValue(schema, replaced.value, value =>
                context.extend({ value })
              )
            )
          }
        }
      }, modelWatchOptions)
    })
    return scope
  }

  #createDataSchemaResolver(
    dataSchema: Schema,
    record: FieldRecord
  ): DataSchemaResolver {
    return new DataSchemaResolver(dataSchema, {
      createContext: () => this.#createEntryContext(record.entry),
      onLoadStart: (promise: Promise<unknown>) =>
        this.model.trackPendingLoad(promise)
    })
  }

  #writeComputedValue(entry: RecordedEntry, computedValue: any) {
    const { data, name } = entry
    const value = this.#getValueWithNestedDefaultValues(entry, computedValue)
    const dataPath = getRelativeDataPath(entry.dataPath, this.model.dataPath)
    if (
      // Values from the reactive data are references, e.g. `parentItem`, which
      // may equal stale copies like applied drafts. Values that
      // `computeValue()` creates anew each time are compared by content:
      (
        isProxy(value)
          ? toRaw(value) !== toRaw(data[name])
          : !equals(value, data[name])
      ) &&
      !this.#isWriteLoop(dataPath)
    ) {
      // Write `data[name]` directly, without calling `parseValue()`:
      data[name] = toModelData(value)
    }
  }

  // Add the defaults that `setDefaultValues()` would add once it's written, or
  // the two keep replacing each other's writes. We copy only what holds missing
  // values, as the value may be shared, e.g. a constant.
  #getValueWithNestedDefaultValues(entry: RecordedEntry, value: any) {
    const { data, name } = entry
    if (
      !isPlainObject(value) && !isArray(value) ||
      // The current value gets its defaults from `setDefaultValues()`:
      toRaw(value) === toRaw(data[name])
    ) {
      return value
    }
    const dataWithMissingValues = new Set<object>()
    this.#walkNestedEntries(entry, value, nestedEntry => {
      if (shouldSetDefaultValue(nestedEntry)) {
        dataWithMissingValues.add(nestedEntry.data)
      }
    })
    if (dataWithMissingValues.size === 0) {
      return value
    }
    const valueWithDefaults = copyContainersHolding(
      value,
      dataWithMissingValues
    )
    // Defaults may hold values with defaults of their own, which the walk
    // visits after setting them:
    this.#walkNestedEntries(entry, valueWithDefaults, nestedEntry =>
      setDefaultValue(nestedEntry)
    )
    return valueWithDefaults
  }

  #walkNestedEntries(
    entry: RecordedEntry,
    value: any,
    handleNestedEntry: (entry: DataEntry) => void
  ) {
    const { form, data, name, dataPath } = entry
    const valueData = { ...data, [name]: value }
    walkData(form, valueData, {
      ...this.model.walkOptions,
      dataPath: getParentDataPath(dataPath),
      shouldSkipIrrelevant: true,
      shouldSkipSourcesWithResource: true,
      visit: nestedEntry => {
        if (nestedEntry.data !== valueData) {
          handleNestedEntry(nestedEntry)
        }
      }
    })
  }

  // Sources of a value may keep disagreeing on it, e.g. two computes, so we
  // report it once instead of letting the writes loop endlessly.
  #isWriteLoop(dataPath: string | null): boolean {
    if (!this.#computedValueWriteCounts) {
      this.#computedValueWriteCounts = new Map()
      queueMicrotask(() => {
        this.#computedValueWriteCounts = null
      })
    }
    const count = (this.#computedValueWriteCounts.get(dataPath) ?? 0) + 1
    this.#computedValueWriteCounts.set(dataPath, count)
    if (count === maxComputedValueWrites + 1) {
      console.error(
        new Error(
          `The computed value at '${dataPath}' keeps changing, as its ` +
          `sources disagree on it. It isn't written anymore in this update.`
        )
      )
    }
    return count > maxComputedValueWrites
  }

  #createEntryContext({
    schema,
    data,
    name,
    dataPath,
    itemDataPath
  }: FieldEntry) {
    const { services, rootData } = this.model.walkOptions
    return SchemaContext.createForSchema(services, {
      schema,
      name,
      data,
      dataPath,
      itemDataPath,
      rootData
    })
  }
}

// The model writes the values of components with `computeValue()` including
// their defaults:
export function shouldSetDefaultValue(entry: DataEntry): boolean {
  return !!entry.node.getPropertyNode(entry)?.shouldSetDefaultValue(entry, {
    shouldSetDefaultsOfComputedValues: false
  })
}

export function setDefaultValue(entry: DataEntry) {
  entry.node.getPropertyNode(entry)?.setDefaultValue(entry, {
    shouldSetDefaultsOfComputedValues: false
  })
}

// Copy the objects and arrays that are or hold one of `objects` shallowly, at
// each occurrence, so that defaults set in copies never reach the originals.
function copyContainersHolding(
  value: any,
  objects: Set<object>,
  ancestorValues = new Set<object>()
): any {
  if (
    !isPlainObject(value) && !isArray(value) ||
    ancestorValues.has(value)
  ) {
    return value
  }
  ancestorValues.add(value)
  const copyValue = () => (isArray(value) ? [...value] : { ...value })
  let copy: any = objects.has(value) ? copyValue() : null
  for (const [key, entry] of Object.entries(value)) {
    const entryCopy = copyContainersHolding(entry, objects, ancestorValues)
    if (entryCopy !== entry) {
      copy ??= copyValue()
      copy[key] = entryCopy
    }
  }
  ancestorValues.delete(value)
  return copy ?? value
}

// Write derived values after mounting, or the `mounted` hooks of `v-model`
// restore the values that inputs had then (vuejs/core#15774):
const modelWatchOptions = { flush: 'post' } as const

const optionsNotLoaded = Symbol('optionsNotLoaded')

const maxComputedValueWrites = 10

function createFieldRecord(entry: FieldEntry): FieldRecord {
  return {
    entry,
    dataPath: shallowRef(entry.dataPath!),
    itemDataPath: shallowRef(entry.itemDataPath ?? null),
    computedValueScope: null,
    writeComputedValue: null,
    optionsResolver: null,
    optionsSchema: null,
    optionsScope: null
  }
}

function getErrorMessage(error: any): string {
  return error.message || error
}
