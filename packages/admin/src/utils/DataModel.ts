import {
  effectScope,
  computed,
  watch,
  watchEffect,
  nextTick,
  ref,
  shallowRef,
  shallowReactive,
  toRaw,
  isProxy,
  isReadonly,
  triggerRef,
  type ComputedRef,
  type EffectScope,
  type Ref,
  type ShallowRef
} from 'vue'
import {
  isArray,
  isPlainObject,
  isFunction,
  isString,
  isEmpty,
  equals,
  parseDataPath,
  getValueAtDataPath
} from '@ditojs/utils'
import SchemaContext from '../SchemaContext.js'
import { DataSchemaResolver } from './DataSchemaResolver.js'
import {
  editableDataTargets,
  toModelData,
  appendDataPath,
  getParentDataPath,
  getRelativeDataPath
} from './data.js'
import { FieldRegistry } from './FieldRegistry.ts'
import { mergeData, mergeValues } from './mergeData.ts'
import { getOriginal } from './uid.js'
import {
  isEmptySchema,
  hasSubmitButton
} from './schema/lookup.js'
import { isListSource, isSourceWithResource } from './schema/structure.js'
import { getOptionsDataSchema } from './schema/types.ts'
import {
  getSchemaValue,
  shouldSetDefaultValue,
  setDefaultValue,
  initializeData,
  isDataPathExcluded,
  shouldExcludeValue,
  getComputedValue,
  hasValueFromDataSchema,
  walkSchemaData,
  serializeData,
  deserializeData,
  hasItemsNumberedByOrderKey,
  updateOrder,
  getMultipleValue
} from './schema/data.js'
import { getOptionsSettings, getReplacedValue } from './schema/options.ts'
import type { Services } from './services.ts'
import type {
  Data,
  Schema,
  SchemaDataEntry,
  WalkedEntry
} from './types.ts'

type Key = string | number

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
  // Containers whose components are the fields that register in them:
  hasFieldRegistry?: boolean
}

// The data that holds a value at `name`, which errors and records are keyed by,
// as it stays with list items that move, unlike data paths:
interface FieldKey {
  data: Data
  name: Key
}

// Changes of lists in sources with their own resource belong to these sources,
// which their data path tells:
export interface ListEntry {
  schema: Schema
  list: any[]
  dataPath: string
}

interface ValueError {
  message: string
  // The path of the error inside the value, if no deeper field displays it:
  path?: string
}

interface ValueErrors {
  validation: ValueError[]
  server: ValueError[]
  // Any change of the value clears its errors for good:
  stopWatching?: () => void
}

// The records of components with computed values or options:
interface ComponentRecord {
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
type FieldEntry = Pick<
  SchemaDataEntry,
  'schema' | 'data' | 'name' | 'dataPath'
> & { itemDataPath?: string | null }

interface DataEntries {
  recordedEntries: EntryMap<SchemaDataEntry>
  entriesWithMissingValues: SchemaDataEntry[]
  // Not walked, but they save the changes of the lists that they hold, unless
  // they're sent with the data:
  sourceEntriesWithResource: WalkedEntry[]
}

// The state of the data that a form, view, dialog or panel edits, derived from
// its schema and data independently of what is rendered.
export class DataModel {
  componentRecords = new EntryMap<ComponentRecord>()
  readonly #pendingLoads = new Set<Promise<unknown>>()
  readonly #pendingSubmits = new Set<Promise<unknown>>()
  // The owners of edits by data path: '' for the container, else the data
  // paths of sources with their own resource, which can't be inlined, with
  // their schemas:
  readonly #editedOwners = shallowReactive(new Map<string, Schema | null>())
  readonly #errors = shallowRef(new WeakEntryMap<ValueErrors>())
  readonly #fieldErrors = shallowRef(new WeakEntryMap<string[]>())
  #computedValueWriteCounts: Map<string | null, number> | null = null
  // Data from the server, whose values are deserialized when it is set up, and
  // with a field registry also for each field that registers later, once:
  readonly #dataToDeserialize = new WeakSet<Data>()
  readonly #deserializedValues = new WeakEntryMap<boolean>()
  // New data, which gets all defaults when it is set up:
  readonly #newData = new WeakSet<Data>()
  // The editable data that contexts hand out by the data that they wrap, e.g.
  // each root of drafts, and the getters of the data paths through which they
  // last reached the raw data:
  readonly #editableData = new WeakMap<object, any>()
  readonly #editableDataPaths = new WeakMap<object, () => string>()
  readonly #data: Ref<Data | null>
  readonly #options: Required<Omit<DataModelOptions, 'data'>>
  readonly #scope = effectScope(true)
  readonly fieldRegistry: FieldRegistry | null
  // The watchers that clear the errors of values, which the data holds:
  #errorScope!: EffectScope
  #dataEntries!: ComputedRef<DataEntries>
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
      hasFieldRegistry: false,
      ...options
    }
    this.fieldRegistry = this.#options.hasFieldRegistry
      ? this.#scope.run(() => new FieldRegistry(this, this.#options))!
      : null
    this.#scope.run(() => {
      // Computed, as the root data of drafts is created:
      this.#rootData = computed(() => this.#options.rootData(this.data))
      // Computed, so watchers can check synchronously if records are current:
      this.#dataEntries = computed(() => this.#getDataEntries())
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
          if (data && this.#dataToDeserialize.has(toRaw(data))) {
            if (!this.fieldRegistry) {
              this.#dataToDeserialize.delete(toRaw(data))
            }
            this.#deserializeData(schema, data)
          }
          this.#initializeData(schema, data, {
            isNew: !!data && this.#newData.delete(toRaw(data))
          })
          this.#writeComputedValues()
          if (data !== previousValues?.[1]) {
            this.#resetState()
          }
        },
        { immediate: true, flush: 'sync' }
      )
      watch(
        () => this.#dataEntries.value.recordedEntries,
        entries => this.#updateComponentRecords(entries),
        modelSetupWatchOptions
      )
      // Values that go missing later, e.g. in added items, get defaults too:
      watch(
        () => this.#dataEntries.value.entriesWithMissingValues,
        entries => this.#setDefaultValues(entries),
        modelSetupWatchOptions
      )
    })
  }

  // Forms resolve their schema from their data, which they may not have yet:
  get schema(): Schema | null {
    return this.data
      ? (this.fieldRegistry?.schema ?? this.#options.schema())
      : null
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
    return [...this.#editedOwners.values()].some(sourceSchema =>
      sourceSchema
        ? hasSubmitButton(sourceSchema.buttons)
        : this.#options.canSave()
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
    const sourceEntry = this.#dataEntries.value.sourceEntriesWithResource.find(
      entry => getRelativeDataPath(dataPath, entry.dataPath) !== null
    )
    this.#editedOwners.set(
      sourceEntry?.dataPath ?? '',
      sourceEntry?.schema ?? null
    )
  }

  // Writes are edits only if they change values of components that aren't
  // excluded:
  #markWriteEdited(dataPath: string) {
    if (!this.#isDataPathExcluded(dataPath)) {
      this.#markEdited(dataPath)
    }
  }

  // Like `#shouldRenderEntry()`, an `exclude()` that fails counts as included.
  #isDataPathExcluded(dataPath: string): boolean {
    try {
      return isDataPathExcluded(this.schema!, this.data!, dataPath, {
        ...this.#walkOptions,
        dataPath: this.dataPath
      })
    } catch (error) {
      console.error(error)
      return false
    }
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
  // which isn't an edit:
  mergeFromServer(
    data: Data | null,
    {
      isReset = false,
      isPartial = false
    }: { isReset?: boolean; isPartial?: boolean } = {}
  ): Data | null {
    if (this.data && data) {
      if (isPartial) {
        mergeValues(this.schema!, this.data, data, {
          ...this.#walkOptions,
          dataPath: this.dataPath
        })
      } else {
        this.#deserializeData(this.schema, data)
        mergeData(this.schema!, this.data, data, {
          services: this.#options.services,
          shouldKeepSourcesWithResource: !isReset
        })
      }
      this.#initializeData(this.schema, this.data)
      this.#writeComputedValues()
      if (isReset) {
        this.#resetState()
      } else if (isPartial) {
        for (const key of Object.keys(data)) {
          this.clearErrors(appendDataPath(this.dataPath, key))
        }
      } else {
        this.markClean({ dataPath: '' })
      }
    } else if (!isPartial) {
      // Without data on either side, partial merges have nothing to do:
      this.replaceFromServer(data)
    }
    return this.data
  }

  // Data that is replaced or reset, e.g. loaded or applied, isn't edited, and
  // its errors go with it:
  #resetState() {
    this.fieldRegistry?.forgetUnmountedFields()
    this.markClean()
    this.#errorScope?.stop()
    this.#errorScope = effectScope(true)
    this.#errors.value = new WeakEntryMap()
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
    data[name] = this.#deserializeData(
      { components: { [name]: schema } },
      { [name]: value },
      getParentDataPath(dataPath)
    )[name]
    this.markClean({ dataPath })
  }

  // Write the computed values of the current data right away, also of records
  // that the update of the data entries hasn't created yet.
  #writeComputedValues() {
    this.#updateComponentRecords(this.#dataEntries.value.recordedEntries)
    for (const record of this.componentRecords.values()) {
      record.writeComputedValue?.()
    }
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
        { components: { [name]: sourceSchema } },
        { [name]: isListItem ? [value] : value },
        { [name]: isListItem ? [item] : item },
        { services: this.#options.services, shouldMatchUids: true }
      )[name]
      data[name] = isListItem ? merged[0] : merged
      // The item takes over the computed values of the draft, which may hold
      // references to the draft:
      this.#writeComputedValues()
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

  replaceItems(entry: ListEntry, items: any[]) {
    this.#changeList(entry, list => list.splice(0, list.length, ...items))
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
    const isNumbered = hasItemsNumberedByOrderKey(schema)
    const offset = isNumbered ? (list[0]?.[schema.orderKey] ?? 0) : 0
    change(list)
    if (isNumbered) {
      updateOrder(schema, list, offset)
    }
  }

  #getFieldKey(dataPath: string): FieldKey {
    const path = parseDataPath(getRelativeDataPath(dataPath, this.dataPath)!)
    const name = path.pop()!
    return { data: getValueAtDataPath(this.data, path, () => null), name }
  }

  getErrors(dataPath: string): ValueError[] | null {
    const { data, name } = this.#getFieldKey(dataPath)
    const errors = this.#errors.value.get({ data, name })
    return errors ? [...errors.validation, ...errors.server] : null
  }

  // The errors of the field itself, e.g. of options that failed to load:
  getFieldErrors(dataPath: string): string[] | null {
    return this.#fieldErrors.value.get(this.#getFieldKey(dataPath)) ?? null
  }

  setErrors(dataPath: string, errors: ValueError[] | null) {
    this.#setErrors(this.#getFieldKey(dataPath), 'validation', errors)
  }

  addError(dataPath: string, message: string) {
    const key = this.#getFieldKey(dataPath)
    const messages = this.#fieldErrors.value.get(key) ?? []
    if (!messages.includes(message)) {
      this.#fieldErrors.value.set(key, [...messages, message])
      triggerRef(this.#fieldErrors)
    }
  }

  removeError(dataPath: string, message: string) {
    const key = this.#getFieldKey(dataPath)
    const messages = this.#fieldErrors.value.get(key) ?? []
    if (messages.includes(message)) {
      if (messages.length > 1) {
        this.#fieldErrors.value.set(
          key,
          messages.filter(error => error !== message)
        )
      } else {
        this.#fieldErrors.value.delete(key)
      }
      triggerRef(this.#fieldErrors)
    }
  }

  // Errors inside values that no deeper field displays go to the field of the
  // value, with their path in it, e.g. of objects edited as code. With
  // `isMatchingDataPath()`, only the errors of the matching fields are
  // replaced. Return the errors that no field displays, or `null`.
  replaceErrors(
    errors: Record<string, ValueError[]>,
    {
      dataPath = this.dataPath,
      server = false,
      isMatchingDataPath = null
    }: {
      dataPath?: string
      server?: boolean
      isMatchingDataPath?: ((dataPath: string) => boolean) | null
    } = {}
  ): Record<string, ValueError[]> | null {
    const entries: SchemaDataEntry[] = []
    this.#walkFieldEntries(dataPath, entry => entries.push(entry))
    const errorsByDataPath: Record<string, ValueError[]> = {}
    const unmatchedErrors: Record<string, ValueError[]> = {}
    for (const [errorDataPath, valueErrors] of Object.entries(errors)) {
      // The deepest field that displays the value or contains it:
      let field: { dataPath: string; path: string } | null = null
      for (const { dataPath } of entries) {
        const path = getRelativeDataPath(errorDataPath, dataPath)
        if (
          path !== null &&
          dataPath!.length > (field?.dataPath.length ?? -1)
        ) {
          field = { dataPath: dataPath!, path }
        }
      }
      if (field) {
        const { dataPath, path } = field
        errorsByDataPath[dataPath] = [
          ...(errorsByDataPath[dataPath] ?? []),
          ...valueErrors.map(error => (path ? { ...error, path } : error))
        ]
      } else {
        unmatchedErrors[errorDataPath] = valueErrors
      }
    }
    for (const { dataPath } of entries) {
      const errors = errorsByDataPath[dataPath!] ?? null
      if (errors || !isMatchingDataPath || isMatchingDataPath(dataPath!)) {
        this.#setErrors(
          this.#getFieldKey(dataPath!),
          server ? 'server' : 'validation',
          errors
        )
      }
    }
    return isEmpty(unmatchedErrors) ? null : unmatchedErrors
  }

  // The errors of the fields stay until their sources remove them.
  clearErrors(dataPath = this.dataPath) {
    this.#walkFieldEntries(dataPath, entry => {
      this.#setValueErrors(this.#getFieldKey(entry.dataPath!), null)
    })
  }

  getErrorDataPaths(dataPath = this.dataPath): string[] {
    const dataPaths: string[] = []
    this.#walkFieldEntries(dataPath, entry => {
      if (
        this.getErrors(entry.dataPath!) ||
        this.getFieldErrors(entry.dataPath!)
      ) {
        dataPaths.push(entry.dataPath!)
      }
    })
    return dataPaths
  }

  // Return whether `data` or the data nested in it hold fields with errors,
  // also where they aren't displayed, e.g. in the items of nested forms.
  hasErrorsWithin(data: any): boolean {
    // Computed values can hold their ancestors, e.g. `parentItem`:
    const visited = new Set()
    const hasErrors = (data: any): boolean => {
      if ((isPlainObject(data) || isArray(data)) && !visited.has(data)) {
        visited.add(data)
        return (
          this.#errors.value.hasEntriesOf(data) ||
          this.#fieldErrors.value.hasEntriesOf(data) ||
          Object.values(data).some(hasErrors)
        )
      }
      return false
    }
    return hasErrors(data)
  }

  // Copy the errors of the originals of `data` and of the data nested in it,
  // e.g. from the parent's model to the draft of a nested form.
  copyErrors(model: DataModel, data: any) {
    const visited = new Set()
    const copy = (data: any) => {
      if ((isPlainObject(data) || isArray(data)) && !visited.has(data)) {
        visited.add(data)
        const original = getOriginal(data)
        for (const [name, errors] of model.#errors.value.entriesOf(original)) {
          const { validation, server } = errors
          this.#setValueErrors({ data, name }, { validation, server })
        }
        Object.values(data).forEach(copy)
      }
    }
    copy(data)
  }

  // Take over the errors of the value at `dataPath` in `model` as the ones of
  // `key`, e.g. of a primitive that a draft wraps:
  copyValueErrors(model: DataModel, dataPath: string, key: FieldKey) {
    const errors = model.#errors.value.get(model.#getFieldKey(dataPath))
    if (errors) {
      const { validation, server } = errors
      this.#setValueErrors(key, { validation, server })
    }
  }

  #setErrors(
    key: FieldKey,
    kind: 'validation' | 'server',
    errors: ValueError[] | null
  ) {
    const valueErrors = {
      ...(this.#errors.value.get(key) ?? { validation: [], server: [] }),
      [kind]: errors ?? []
    }
    this.#setValueErrors(
      key,
      valueErrors.validation.length > 0 || valueErrors.server.length > 0
        ? valueErrors
        : null
    )
  }

  #setValueErrors(key: FieldKey, errors: ValueErrors | null) {
    const { data, name } = key
    const currentErrors = this.#errors.value.get(key)
    if (errors) {
      // Watch synchronously and deeply, as values also change in place and
      // through direct writes, e.g. of `change` handlers:
      errors.stopWatching = (
        currentErrors?.stopWatching ??
        this.#errorScope.run(() =>
          watch(
            () => data[name],
            () => this.#setValueErrors(key, null),
            { deep: true, flush: 'sync' }
          )
        )
      )
      this.#errors.value.set(key, errors)
    } else if (currentErrors) {
      currentErrors.stopWatching?.()
      this.#errors.value.delete(key)
    }
    triggerRef(this.#errors)
  }

  #walkFieldEntries(
    dataPath: string,
    handleEntry: (entry: SchemaDataEntry) => void
  ) {
    const { schema, data } = this
    const isWithin = (entry: WalkedEntry) => (
      getRelativeDataPath(entry.dataPath, dataPath) !== null
    )
    if (data && !isEmptySchema(schema)) {
      walkSchemaData(schema!, data, {
        dataPath: this.dataPath,
        // Walk the components within `dataPath`, and the ones that contain it:
        shouldWalk: entry => (
          (
            isWithin(entry) ||
            getRelativeDataPath(dataPath, entry.dataPath) !== null
          ) &&
          this.#shouldRenderEntry(entry)
        ),
        shouldSkipSourcesWithResource: true,
        before: entry => {
          if (isWithin(entry)) {
            handleEntry(entry)
          }
        },
        options: this.#walkOptions
      })
    }
  }

  stop() {
    this.#scope.stop()
    this.#errorScope.stop()
    this.componentRecords.clear()
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

  get #walkOptions() {
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
        shouldSetDefaultsOfComponentsWithCompute: isNew
      })
    }
  }

  #deserializeData(
    schema: Schema | null,
    data: Data,
    dataPath = this.dataPath
  ): Data {
    return isEmptySchema(schema)
      ? data
      : deserializeData(schema!, data, {
          ...this.#walkOptions,
          dataPath,
          ...(this.fieldRegistry && {
            isDeserialized: (entry: FieldKey) =>
              !!this.#deserializedValues.get(entry),
            markDeserialized: (entry: FieldKey) =>
              this.#deserializedValues.set(entry, true)
          })
        })
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
    const recordedEntries = new EntryMap<SchemaDataEntry>()
    const entriesWithMissingValues: SchemaDataEntry[] = []
    const sourceEntriesWithResource: WalkedEntry[] = []
    if (data && !isEmptySchema(schema)) {
      walkSchemaData(schema!, data, {
        dataPath: this.dataPath,
        shouldWalk: entry => {
          const shouldRender = this.#shouldRenderEntry(entry)
          if (
            shouldRender &&
            isSourceWithResource(entry.schema) &&
            this.#shouldExcludeEntry(entry)
          ) {
            sourceEntriesWithResource.push(entry)
          }
          return shouldRender
        },
        shouldSkipSourcesWithResource: true,
        before: entry => {
          if (
            hasComputedValueSource(entry.schema) ||
            getOptionsDataSchema(entry.schema)
          ) {
            recordedEntries.set(entry, entry)
          }
          if (this.#shouldSetDefaultValue(entry)) {
            entriesWithMissingValues.push(entry)
          }
        },
        options: this.#walkOptions
      })
    }
    return {
      recordedEntries,
      entriesWithMissingValues,
      sourceEntriesWithResource
    }
  }

  // An `if` that fails only affects its own component, which counts as shown.
  #shouldRenderEntry(entry: WalkedEntry): boolean {
    if (entry.schema.if === undefined) {
      return true
    }
    try {
      return getSchemaValue('if', {
        type: Boolean,
        schema: entry.schema,
        context: this.#createEntryContext(entry),
        default: true
      })
    } catch (error) {
      console.error(error)
      return true
    }
  }

  // Like `#shouldRenderEntry()`, an `exclude()` that fails counts as included.
  #shouldExcludeEntry(entry: WalkedEntry): boolean {
    try {
      return shouldExcludeValue(entry.schema, () =>
        this.#createEntryContext(entry)
      )
    } catch (error) {
      console.error(error)
      return false
    }
  }

  #shouldSetDefaultValue(entry: SchemaDataEntry): boolean {
    const { schema, data, name } = entry
    return shouldSetDefaultValue(
      schema,
      data,
      name,
      () => this.#createEntryContext(entry),
      { shouldSetDefaultsOfComponentsWithCompute: false }
    )
  }

  #setDefaultValues(entries: SchemaDataEntry[]) {
    for (const entry of entries) {
      if (this.#shouldSetDefaultValue(entry)) {
        const { schema, data, name } = entry
        setDefaultValue(schema, data, name, () =>
          this.#createEntryContext(entry)
        )
      }
    }
  }

  #updateComponentRecords(entries: EntryMap<SchemaDataEntry>) {
    const previousRecords = this.componentRecords
    this.componentRecords = new EntryMap()
    for (const entry of entries.values()) {
      const record = previousRecords.get(entry) ?? createComponentRecord(entry)
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
      this.componentRecords.set(entry, record)
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

  #getComponentRecord(entry: FieldEntry): ComponentRecord {
    let record = this.componentRecords.get(entry)
    if (!record) {
      record = createComponentRecord(entry)
      this.componentRecords.set(entry, record)
    }
    return record
  }

  // Records stop being current before their scope is stopped, as watchers
  // outside of components run in the order in which they're triggered.
  #createComputedValueScope(record: ComponentRecord): EffectScope {
    const { schema } = record.entry
    const scope = this.#scope.run(() => effectScope())!
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
          this.#writeComputedValue(record.entry, result.value)
        }
      }
      record.writeComputedValue = () => write(currentResult.value)
      watch(currentResult, write, modelWatchOptions)
      record.writeComputedValue()
    })
    return scope
  }

  #isRecordCurrent(record: ComponentRecord, schema: Schema): boolean {
    const currentEntry = this.#dataEntries.value.recordedEntries.get(
      record.entry
    )
    return currentEntry?.schema === schema
  }

  // Return `null` while `computeValue()` reads options that aren't loaded yet,
  // to keep the current value until they are.
  #getComputedValueResult(record: ComponentRecord): { value: any } | null {
    const { entry } = record
    const { schema, data, name } = entry
    try {
      const value = getComputedValue(
        schema,
        data,
        name,
        // Read the data paths through the record, so that only computes that
        // read their position run again when their items move:
        () => record.dataPath.value,
        {
          ...this.#walkOptions,
          itemDataPath: () => record.itemDataPath.value,
          getOptions: getOptionsDataSchema(schema)
            ? () => this.#getLoadedOptions(entry)
            : null
        }
      )
      return { value }
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

  // Computes and components share the resolver, so they get the same options.
  getOptionsResolver(entry: FieldEntry): DataSchemaResolver {
    const record = this.#getComponentRecord(entry)
    const options = getOptionsDataSchema(entry.schema)
    if (!record.optionsResolver || record.optionsSchema !== options) {
      record.optionsScope?.stop()
      record.optionsSchema = options
      record.optionsResolver = this.#createDataSchemaResolver(options, record)
      record.optionsScope = this.#createOptionsScope(record)
    }
    return record.optionsResolver
  }

  // Show the errors of the loads of the options, and replace the value once
  // they're loaded, see `getReplacedValue()`. The replaced value is derived
  // from the options, not an edit, so it's written directly.
  #createOptionsScope(record: ComponentRecord): EffectScope {
    const resolver = record.optionsResolver!
    const scope = this.#scope.run(() => effectScope())!
    scope.run(() => {
      // The error of the last load replaces the one of the previous load, e.g.
      // when the options load again after the data is replaced:
      watch(
        () => resolver.lastLoadError,
        (error, previousError) => {
          const dataPath = record.dataPath.value
          if (previousError) {
            this.removeError(dataPath, getErrorMessage(previousError))
          }
          if (error) {
            this.addError(dataPath, getErrorMessage(error))
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
          const { formatValue, parseValue } = schema
          const settings = getOptionsSettings(schema, options, {
            multiple: getMultipleValue(schema, context),
            isGrouped: false,
            createContext: values => context.extend({ options, ...values })
          })
          const replaced = getReplacedValue(
            settings,
            options,
            formatValue ? toModelData(formatValue(context)) : data[name]
          )
          if (replaced) {
            const { value } = replaced
            data[name] = toModelData(
              parseValue ? parseValue(context.extend({ value })) : value
            )
          }
        }
      }, modelWatchOptions)
    })
    return scope
  }

  #createDataSchemaResolver(
    dataSchema: Schema,
    record: ComponentRecord
  ): DataSchemaResolver {
    return new DataSchemaResolver(dataSchema, {
      createContext: () => this.#createEntryContext(record.entry),
      onLoadStart: (promise: Promise<unknown>) => this.trackPendingLoad(promise)
    })
  }

  #writeComputedValue(entry: FieldEntry, computedValue: any) {
    const { data, name } = entry
    const value = this.#getValueWithNestedDefaultValues(entry, computedValue)
    const dataPath = getRelativeDataPath(entry.dataPath, this.dataPath)
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
  #getValueWithNestedDefaultValues(entry: FieldEntry, value: any) {
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
      if (this.#shouldSetDefaultValue(nestedEntry)) {
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
    this.#walkNestedEntries(entry, valueWithDefaults, nestedEntry => {
      if (this.#shouldSetDefaultValue(nestedEntry)) {
        setDefaultValue(
          nestedEntry.schema,
          nestedEntry.data,
          nestedEntry.name,
          () => this.#createEntryContext(nestedEntry)
        )
      }
    })
    return valueWithDefaults
  }

  #walkNestedEntries(
    entry: FieldEntry,
    value: any,
    handleNestedEntry: (entry: SchemaDataEntry) => void
  ) {
    const { schema, data, name, dataPath } = entry
    const valueData = { ...data, [name]: value }
    walkSchemaData({ components: { [name]: schema } }, valueData, {
      dataPath: getParentDataPath(dataPath),
      shouldWalk: nestedEntry => this.#shouldRenderEntry(nestedEntry),
      shouldSkipSourcesWithResource: true,
      before: nestedEntry => {
        if (nestedEntry.data !== valueData) {
          handleNestedEntry(nestedEntry)
        }
      },
      options: this.#walkOptions
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
  }: Omit<FieldEntry, 'name'> & Pick<WalkedEntry, 'name'>) {
    return SchemaContext.createForSchema(this.#options.services, {
      schema,
      name,
      data,
      dataPath,
      itemDataPath,
      rootData: this.rootData
    })
  }
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

// Set up before rendering, so new data renders with its defaults right away:
const modelSetupWatchOptions = { immediate: true, flush: 'pre' } as const

// Write derived values after mounting, or the `mounted` hooks of `v-model`
// restore the values that inputs had then (vuejs/core#15774):
const modelWatchOptions = { flush: 'post' } as const

const optionsNotLoaded = Symbol('optionsNotLoaded')

const maxComputedValueWrites = 10

function createComponentRecord(entry: FieldEntry): ComponentRecord {
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

// Compare data by its raw object, as it may come through reactive proxies.
type ValuesByName<T> = Map<Key, T>

class WeakEntryMap<T> {
  protected valuesByData:
    | WeakMap<object, ValuesByName<T>>
    | Map<object, ValuesByName<T>> = new WeakMap()

  get({ data, name }: FieldKey): T | undefined {
    return this.valuesByData.get(toRaw(data))?.get(name)
  }

  set({ data, name }: FieldKey, value: T) {
    const rawData = toRaw(data)
    let valuesByName = this.valuesByData.get(rawData)
    if (!valuesByName) {
      valuesByName = new Map()
      this.valuesByData.set(rawData, valuesByName)
    }
    valuesByName.set(name, value)
  }

  delete({ data, name }: FieldKey): boolean {
    const rawData = toRaw(data)
    const valuesByName = this.valuesByData.get(rawData)
    const isDeleted = !!valuesByName?.delete(name)
    if (isDeleted && valuesByName!.size === 0) {
      this.valuesByData.delete(rawData)
    }
    return isDeleted
  }

  hasEntriesOf(data: object): boolean {
    return this.valuesByData.has(toRaw(data))
  }

  entriesOf(data: object): Iterable<[Key, T]> {
    return this.valuesByData.get(toRaw(data))?.entries() ?? []
  }
}

// Entry maps can be iterated and cleared, but keep their data alive.
class EntryMap<T> extends WeakEntryMap<T> {
  protected override valuesByData = new Map<object, ValuesByName<T>>()

  clear() {
    this.valuesByData.clear()
  }

  *values(): Generator<T> {
    for (const valuesByName of this.valuesByData.values()) {
      yield* valuesByName.values()
    }
  }
}

function hasComputedValueSource(schema: Schema): boolean {
  return !!schema.computeValue || hasValueFromDataSchema(schema)
}

function getErrorMessage(error: any): string {
  return error.message || error
}

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
