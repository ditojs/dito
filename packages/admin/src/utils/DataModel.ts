import {
  effectScope,
  computed,
  watch,
  nextTick,
  ref,
  shallowReactive,
  toRaw,
  isProxy,
  isReadonly,
  type ComputedRef,
  type Ref
} from 'vue'
import {
  isArray,
  isPlainObject,
  isFunction,
  isString,
  equals
} from '@ditojs/utils'
import {
  editableDataTargets,
  toModelData,
  appendDataPath,
  getParentDataPath,
  getRelativeDataPath
} from './data.js'
import { mergeData, mergeValues } from './mergeData.ts'
import {
  isEmptySchema,
  hasSubmitButton
} from './schema/lookup.js'
import { isListSource } from './schema/structure.js'
import {
  initializeData,
  isDataPathExcluded,
  serializeData,
  deserializeData,
  hasItemsNumberedByOrderKey,
  updateOrder
} from './schema/data.js'
import { callOrLog } from './schema/value.js'
import {
  walkData,
  getSchemaSource,
  type DataEntry,
  type DataSource
} from './schema/walk.js'
import { EntryMap, type FieldKey } from './EntryMap.ts'
import { DataErrors } from './DataErrors.ts'
import {
  FieldRecords,
  shouldSetDefaultValue,
  setDefaultValue,
  type RecordedEntry
} from './FieldRecords.ts'
import type { Services } from './services.ts'
import type { Data, Schema } from './types.ts'

export interface DataModelOptions {
  schema: () => Schema | null
  // The data that the model starts with, see `replace()`:
  data?: Data | null
  // The data that `dataPath` is relative to, e.g. the root of the parent's data
  // with the draft in place of the item, in nested forms:
  rootData?: (data: Data | null) => Data | null
  dataPath?: () => string
  // The schema of the source of the data's item, for its serialized data:
  sourceSchema?: () => Schema | null
  // The model of the parent's data, which serializes the root data of nested
  // forms:
  parent?: () => DataModel | null
  // Edits are unsaved only where they can be saved, by default through a
  // submit button of the schema:
  canSave?: () => boolean
  // The services of the contexts that the model creates for callbacks:
  services?: Services | null
}

// Changes of lists in sources with their own resource belong to these sources,
// which their data path tells:
export interface ListEntry {
  schema: Schema
  list: any[]
  dataPath: string
}

interface DataEntries {
  recordedEntries: EntryMap<RecordedEntry>
  entriesWithMissingValues: DataEntry[]
  // Their items aren't walked, but they save the changes of the lists that
  // they hold, unless they're sent with the data:
  sourceEntriesWithResource: DataEntry[]
}

// The state of the data that a form, view, dialog or panel edits, derived from
// its schema and data independently of what is rendered.
export class DataModel {
  readonly errors = new DataErrors(this)
  readonly fields = new FieldRecords(this)
  readonly #pendingLoads = new Set<Promise<unknown>>()
  readonly #pendingSubmits = new Set<Promise<unknown>>()
  // The owners of edits by data path: '' for the container, else the data
  // paths of sources with their own resource, which can't be inlined, with
  // their sources:
  readonly #editedOwners = shallowReactive(new Map<string, DataSource | null>())
  // Data from the server, whose values are deserialized when it is set up:
  readonly #dataToDeserialize = new WeakSet<Data>()
  // New data, which gets all defaults when it is set up:
  readonly #newData = new WeakSet<Data>()
  // The editable data that contexts hand out by the data that they wrap, e.g.
  // each root of drafts, and the getters of the data paths through which they
  // last reached the raw data:
  readonly #editableData = new WeakMap<object, any>()
  readonly #editableDataPaths = new WeakMap<object, () => string>()
  readonly #data: Ref<Data | null>
  readonly #options: Required<Omit<DataModelOptions, 'data'>>
  readonly scope = effectScope(true)
  dataEntries!: ComputedRef<DataEntries>
  #rootData!: ComputedRef<Data | null>
  serializedData!: ComputedRef<Data | null>
  serializedRootData!: ComputedRef<Data | null>

  constructor({ data = null, ...options }: DataModelOptions) {
    // Deeply reactive, as components and callbacks write it directly too:
    this.#data = ref(data)
    this.#options = {
      rootData: data => data,
      dataPath: () => '',
      sourceSchema: () => null,
      parent: () => null,
      canSave: () => hasSubmitButton(this.schema?.buttons),
      services: null,
      ...options
    }
    this.scope.run(() => {
      // Computed, as the root data of drafts is created:
      this.#rootData = computed(() => this.#options.rootData(this.data))
      // Computed, so watchers can check synchronously if records are current:
      this.dataEntries = computed(() => this.#getDataEntries())
      // Built only when read, e.g. by `context.serializedItem`:
      this.serializedData = computed(() => this.#getSerializedData())
      this.serializedRootData = computed(() =>
        this.#getSerializedRootData(this.rootData)
      )
      // Set up data right away, so that edits never land before its computed
      // values, whose watchers run after rendering:
      watch(
        [() => this.schema, () => this.data],
        ([schema, data], previousValues) => {
          if (data && this.#dataToDeserialize.delete(toRaw(data))) {
            this.#deserializeData(schema, data)
          }
          this.#initializeData(schema, data, {
            isNew: !!data && this.#newData.delete(toRaw(data))
          })
          this.fields.writeComputedValues()
          if (data !== previousValues?.[1]) {
            this.#resetState()
          }
        },
        { immediate: true, flush: 'sync' }
      )
      watch(
        () => this.dataEntries.value.recordedEntries,
        entries => this.fields.update(entries),
        modelSetupWatchOptions
      )
      // Values that go missing later, e.g. of fields that `fields()` creates,
      // get defaults too. Only created and loaded data has its `null` replaced:
      watch(
        () => this.dataEntries.value.entriesWithMissingValues,
        entries => entries.forEach(setDefaultValue),
        modelSetupWatchOptions
      )
    })
  }

  // Forms resolve their schema from their data, which they may not have yet:
  get schema(): Schema | null {
    return this.data ? this.#options.schema() : null
  }

  get data(): Data | null {
    return this.#data.value
  }

  get rootData(): Data | null {
    return this.#rootData.value
  }

  get dataPath(): string {
    return this.#options.dataPath()
  }

  get parent(): DataModel | null {
    return this.#options.parent()
  }

  get isDirty(): boolean {
    return [...this.#editedOwners.values()].some(source =>
      source ? source.hasSubmitButton : this.#options.canSave()
    )
  }

  get isEdited(): boolean {
    return this.#editedOwners.size > 0
  }

  markEdited() {
    this.#markEdited('')
  }

  // Edits of data in sources with their own resource belong to these sources,
  // e.g. a tree whose children change, all other edits to the container:
  #markEdited(dataPath: string) {
    const sourceEntry = this.dataEntries.value.sourceEntriesWithResource.find(
      entry => getRelativeDataPath(dataPath, entry.dataPath) !== null
    )
    this.#editedOwners.set(
      sourceEntry?.dataPath ?? '',
      sourceEntry?.node.source ?? null
    )
  }

  // Writes are edits only if they change values of components that aren't
  // excluded:
  #markWriteEdited(dataPath: string) {
    if (!this.#isDataPathExcluded(dataPath)) {
      this.#markEdited(dataPath)
    }
  }

  // Like an `if` that fails, an `exclude()` that fails counts as included.
  #isDataPathExcluded(dataPath: string): boolean {
    return callOrLog(
      () =>
        isDataPathExcluded(this.schema!, this.data!, dataPath, {
          ...this.walkOptions,
          dataPath: this.dataPath
        }),
      false
    )
  }

  // Clean the edits of the source at `dataPath`, or of all owners:
  markClean({ dataPath = null }: { dataPath?: string | null } = {}) {
    if (dataPath === null) {
      this.#editedOwners.clear()
    } else {
      this.#editedOwners.delete(dataPath)
    }
  }

  // Replace the data, e.g. with a new item or a draft, which isn't an edit:
  replace(data: Data | null) {
    this.#data.value = data
  }

  // Replace the data with a new item, which is initialized in its place:
  replaceWithNewData(data: Data) {
    this.#newData.add(toRaw(data))
    this.replace(data)
  }

  // Replace the data with data from the server, e.g. loaded data, once its
  // schema can be resolved from it:
  replaceFromServer(data: Data | null) {
    if (data) {
      this.#dataToDeserialize.add(toRaw(data))
    }
    this.replace(data)
  }

  // Merge data from the server into the data, to keep the identity of its
  // objects. Save responses leave sources with their own resource their data
  // and their edits, while resets result in the same data as a replace.
  // Partial merges only replace the values in `data` and clear their errors,
  // which isn't an edit. Forms that edit the item of their parent in place
  // merge into `item`, whose state the parent holds, and only clear its errors:
  mergeFromServer(
    data: Data | null,
    {
      isReset = false,
      isPartial = false,
      item = null
    }: { isReset?: boolean; isPartial?: boolean; item?: Data | null } = {}
  ): Data | null {
    const target = item ?? this.data
    if (target && data) {
      // Resolve the schema also for `item`, without data of the model's own,
      // and again after the merge, which may change the type of the data:
      const getSchema = () => this.#options.schema()!
      if (isPartial) {
        mergeValues(getSchema(), target, data, {
          ...this.walkOptions,
          dataPath: this.dataPath
        })
      } else {
        this.#deserializeData(getSchema(), data)
        mergeData(getSchema(), target, data, {
          services: this.#options.services,
          shouldKeepSourcesWithResource: !isReset
        })
      }
      this.#initializeData(getSchema(), target)
      if (!item) {
        this.fields.writeComputedValues()
      }
      const model = item ? this.parent! : this
      if (isPartial) {
        for (const key of Object.keys(data)) {
          model.errors.clear(appendDataPath(this.dataPath, key))
        }
      } else if (item) {
        model.errors.clear(this.dataPath)
      } else if (isReset) {
        this.#resetState()
      } else {
        this.markClean({ dataPath: '' })
      }
    } else if (!isPartial) {
      // Without data on either side, partial merges have nothing to do:
      this.replaceFromServer(data)
    }
    return item ?? this.data
  }

  // Data that is replaced or reset, e.g. loaded or applied, isn't edited, and
  // its errors go with it:
  #resetState() {
    this.markClean()
    this.errors.reset()
  }

  // Set the value that a source loaded or deleted through its own resource,
  // which replaces the source's edits:
  setLoaded(
    {
      schema,
      data,
      name,
      dataPath
    }: FieldKey & {
      schema: Schema
      dataPath: string
    },
    value: any
  ) {
    data[name] = deserializeData(
      { fields: { [name]: schema } },
      { [name]: value },
      { ...this.walkOptions, dataPath: getParentDataPath(dataPath) }
    )[name]
    this.markClean({ dataPath })
  }

  set({ data, name, dataPath }: FieldKey & { dataPath: string }, value: any) {
    // Writes that don't change the value aren't edits, and keep its identity:
    if (!equals(data[name], value)) {
      this.#markWriteEdited(dataPath)
      data[name] = toModelData(value)
    }
  }

  // Wrap the data that contexts hand out, so that writes of app code through it
  // are edits, as if the user made them, e.g. in handlers. Methods run on the
  // editable data, as Vue's array methods would hand out the reactive items.
  // The data paths are only read on writes, so that reading the data doesn't
  // depend on the position of moving items:
  toEditable(value: any, getDataPath: () => string): any {
    if (isProxy(value) && (isPlainObject(value) || isArray(value))) {
      const data: any = toRaw(value)
      this.#editableDataPaths.set(data, getDataPath)
      let editable = this.#editableData.get(value)
      if (!editable) {
        editable = new Proxy<any>(value, {
          get: (target, key) => {
            const value = target[key]
            // Only wrap the values of the data, not Vue's flags like `__v_raw`
            // of proxies around the data, e.g. the root of drafts:
            return isFunction(value)
              ? data[key]
              : isString(key) && isProxy(value) && Object.hasOwn(data, key)
                ? this.toEditable(value, () =>
                    appendDataPath(this.#editableDataPaths.get(data)!(), key)
                  )
                : value
          },

          set: (target, key, value) => {
            const dataPath = this.#getEditableDataPath(data, key)
            const model = this.#getEditableDataModel(target, dataPath)
            if (model) {
              model.set(
                { data: target, name: key as string, dataPath: dataPath! },
                value
              )
            } else {
              target[key] = value
            }
            return true
          },

          deleteProperty: (target, key) => {
            const dataPath = this.#getEditableDataPath(data, key)
            const model = this.#getEditableDataModel(target, dataPath)
            if (model && key in target) {
              model.#markWriteEdited(dataPath!)
            }
            return Reflect.deleteProperty(target, key)
          }
        })
        this.#editableData.set(value, editable)
        editableDataTargets.set(editable, value)
      }
      return editable
    }
    return value
  }

  #getEditableDataPath(data: object, key: string | symbol): string | null {
    return isString(key)
      ? appendDataPath(this.#editableDataPaths.get(data)!(), key)
      : null
  }

  // Writes outside of the model's data are edits of the parent's data, e.g. of
  // panels with their own data. The read-only parent data of drafts rejects
  // them, and data outside of all models isn't edited:
  #getEditableDataModel(
    target: object,
    dataPath: string | null
  ): DataModel | null {
    let model: DataModel | null = isReadonly(target) ? null : this
    while (model && getRelativeDataPath(dataPath, model.dataPath) === null) {
      model = model.parent
    }
    return model
  }

  // Merge `item`, e.g. the draft of a nested form, into `data[name]` in place.
  merge(
    { data, name, dataPath }: FieldKey & { dataPath: string },
    item: Data,
    sourceSchema: Schema
  ) {
    const changedDataPaths = getChangedDataPaths(data[name], item, dataPath)
    if (changedDataPaths.length > 0) {
      if (changedDataPaths.some(path => !this.#isDataPathExcluded(path))) {
        this.#markEdited(dataPath)
      }
      // Merge it through its source, e.g. with tree item children. The items
      // of lists are merged as the only item of their list, matching the uids
      // that drafts share with them, as lists only walk the items of arrays:
      const value = data[name]
      const isListItem = isListSource(sourceSchema)
      const merged = mergeData(
        { fields: { [name]: sourceSchema } },
        { [name]: isListItem ? [value] : value },
        { [name]: isListItem ? [item] : item },
        { services: this.#options.services, shouldMatchUids: true }
      )[name]
      data[name] = isListItem ? merged[0] : merged
      // The item takes over the computed values of the draft, which may hold
      // references to the draft:
      this.fields.writeComputedValues()
    }
  }

  insert(entry: ListEntry, index: number, item: any) {
    this.#changeList(entry, list => list.splice(index, 0, item))
  }

  remove(entry: ListEntry, index: number) {
    this.#changeList(entry, list => list.splice(index, 1))
  }

  // Remove the item that a source deleted through its own resource, which
  // isn't an edit, like `setLoaded()`:
  removeDeleted(entry: ListEntry, index: number) {
    this.#changeList(entry, list => list.splice(index, 1), { isEdit: false })
  }

  move(entry: ListEntry, from: number, to: number) {
    this.#changeList(entry, list => list.splice(to, 0, ...list.splice(from, 1)))
  }

  // Number the items from the order of the first one, which keeps the offset
  // of loaded pages.
  #changeList(
    { schema, list, dataPath }: ListEntry,
    change: (list: any[]) => void,
    { isEdit = true }: { isEdit?: boolean } = {}
  ) {
    if (isEdit) {
      this.#markWriteEdited(dataPath)
    }
    const isNumbered = hasItemsNumberedByOrderKey(getSchemaSource(schema))
    const offset = isNumbered ? (list[0]?.[schema.orderKey] ?? 0) : 0
    change(list)
    if (isNumbered) {
      updateOrder(schema, list, offset)
    }
  }

  stop() {
    this.scope.stop()
    this.errors.stop()
    this.fields.records.clear()
    this.#pendingLoads.clear()
    this.#pendingSubmits.clear()
  }

  get hasPendingLoads(): boolean {
    return this.#pendingLoads.size > 0
  }

  // We wait without a limit, as `api.timeout` bounds the requests:
  async waitUntilSettled() {
    while (this.hasPendingLoads) {
      await Promise.all(this.#pendingLoads)
      await nextTick()
    }
  }

  trackPendingLoad(promise: Promise<unknown>) {
    this.#pendingLoads.add(promise)
    promise.finally(() => this.#pendingLoads.delete(promise))
  }

  // The data stays dirty until its submits succeed, which leaving the route
  // waits for, see `useLeaveGuard()`.
  get hasPendingSubmits(): boolean {
    return this.#pendingSubmits.size > 0
  }

  async waitUntilSubmitted() {
    await Promise.allSettled(this.#pendingSubmits)
  }

  trackPendingSubmit<T>(promise: Promise<T>): Promise<T> {
    this.#pendingSubmits.add(promise)
    const remove = () => this.#pendingSubmits.delete(promise)
    promise.then(remove, remove)
    return promise
  }

  get walkOptions() {
    return { services: this.#options.services, rootData: this.rootData }
  }

  #initializeData(
    schema: Schema | null,
    data: Data | null,
    { isNew = false }: { isNew?: boolean } = {}
  ) {
    if (data && !isEmptySchema(schema)) {
      initializeData(schema!, data, this.#options.services, {
        dataPath: this.dataPath,
        rootData: this.rootData,
        shouldSkipSourcesWithResource: !isNew,
        // New data starts with all defaults for `computeValue()` to rely on,
        // else the model writes the values of components with `computeValue()`
        // including their defaults:
        shouldSetDefaultsOfComputedValues: isNew
      })
    }
  }

  #deserializeData(schema: Schema | null, data: Data) {
    if (!isEmptySchema(schema)) {
      deserializeData(schema!, data, {
        ...this.walkOptions,
        dataPath: this.dataPath
      })
    }
  }

  #getSerializedData(data = this.data, rootData = this.rootData): Data | null {
    const { schema } = this
    return data && !isEmptySchema(schema)
      ? serializeData(
          schema,
          this.#options.sourceSchema(),
          data,
          this.dataPath,
          {
            services: this.#options.services,
            rootData,
            target: 'server'
          }
        )
      : null
  }

  // Process `rootData` in the model that holds the root: its own cached root
  // data, or the root of a nested form with the draft in place of the item, see
  // `createDraftRoot()`.
  #getSerializedRootData(rootData: Data | null): Data | null {
    const parent = this.dataPath ? this.parent : null
    return parent
      ? parent.#getSerializedRootData(rootData)
      : rootData === this.rootData
        ? this.serializedData.value
        : this.#getSerializedData(rootData, rootData)
  }

  #getDataEntries(): DataEntries {
    const { schema, data } = this
    const recordedEntries = new EntryMap<RecordedEntry>()
    const entriesWithMissingValues: DataEntry[] = []
    const sourceEntriesWithResource: DataEntry[] = []
    if (data && !isEmptySchema(schema)) {
      walkData(schema!, data, {
        ...this.walkOptions,
        dataPath: this.dataPath,
        shouldSkipIrrelevant: true,
        shouldWalk: ({ node }) => !node.source?.hasResource,
        visit: entry => {
          const { node } = entry
          if (node.source?.hasResource) {
            // Like an `if` that fails, an `exclude()` that fails counts as
            // included:
            if (
              callOrLog(
                () => node.getPropertyNode(entry)?.isExcluded(entry),
                false
              )
            ) {
              sourceEntriesWithResource.push(entry)
            }
          } else {
            const recordedSchema = node.getRecordedSchema(entry)
            if (recordedSchema) {
              recordedEntries.set(entry, { ...entry, ...recordedSchema })
            }
            if (
              !(entry.name in entry.data) &&
              shouldSetDefaultValue(entry)
            ) {
              entriesWithMissingValues.push(entry)
            }
          }
        }
      })
    }
    return {
      recordedEntries,
      entriesWithMissingValues,
      sourceEntriesWithResource
    }
  }
}

// Set up before rendering, so new data renders with its defaults right away:
const modelSetupWatchOptions = { immediate: true, flush: 'pre' } as const

// Collect the data paths at which `value` and `other` differ, down to values
// that aren't objects, or arrays of the same length:
function getChangedDataPaths(
  value: any,
  other: any,
  dataPath: string
): string[] {
  const dataPaths: string[] = []
  // Computed values can hold their ancestors, e.g. `parentItem`:
  const visited = new Set()
  const compare = (value: any, other: any, dataPath: string) => {
    if (
      isPlainObject(value) && isPlainObject(other) ||
      isArray(value) && isArray(other) && value.length === other.length
    ) {
      if (!visited.has(value)) {
        visited.add(value)
        const keys = new Set([...Object.keys(value), ...Object.keys(other)])
        for (const key of keys) {
          compare(
            (value as Data)[key],
            (other as Data)[key],
            appendDataPath(dataPath, key)
          )
        }
      }
    } else if (!equals(value, other)) {
      dataPaths.push(dataPath)
    }
  }
  compare(value, other, dataPath)
  return dataPaths
}
