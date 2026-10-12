import {
  effectScope,
  computed,
  watch,
  nextTick,
  shallowRef,
  shallowReactive,
  toRaw,
  triggerRef
} from 'vue'
import {
  isArray,
  isPlainObject,
  isEmpty,
  equals,
  clone,
  parseDataPath,
  getValueAtDataPath
} from '@ditojs/utils'
import DitoContext from '../DitoContext.js'
import { DataSchemaResolver } from './DataSchemaResolver.js'
import { getParentDataPath, getRelativeDataPath } from './data.js'
import { mergeData } from './mergeData.ts'
import { getOriginal } from './uid.js'
import {
  isEmptySchema,
  getButtonSchemas,
  hasSubmitButton
} from './schema/lookup.js'
import { isSourceWithResource } from './schema/structure.js'
import {
  getSchemaValue,
  shouldSetDefaultValue,
  setDefaultValue,
  initializeData,
  computeValue,
  hasValueFromDataSchema,
  processSchemaData,
  processData,
  hasItemsNumberedByOrderKey,
  updateOrder
} from './schema/data.js'

// The state of the data that a form, view, dialog or panel edits, derived from
// its schema and data independently of what is rendered.
export class DataModel {
  // By data and name, so that records stay with list items that move:
  componentRecords = new EntryMap()
  pendingLoads = new Set()
  #untimedLoads = new Set()
  // The writes of values that components hold back, e.g. debounced edits:
  pendingWrites = new Set()
  // The owners of edits with their schemas: '' for the container, else the
  // data paths of sources with their own resource, which can't be inlined.
  #editedOwners = shallowReactive(new Map())
  // Errors by the data that holds the value and its name, so that they stay
  // with items that move:
  #errors = shallowRef(new WeakEntryMap())
  #fieldErrors = shallowRef(new WeakEntryMap())
  computedValueWriteCounts = null

  constructor({ component, getSchema, getData, canSave = () => true }) {
    this.component = component
    this.getSchema = getSchema
    this.getData = getData
    this.canSave = canSave
    this.rootScope = effectScope(true)
    this.rootScope.run(() => {
      // Computed, so watchers can check synchronously if records are current:
      this.dataEntries = computed(() => this.getDataEntries())
      // Built only when read, e.g. by `context.processedItem`, and cached until
      // the data that it read changes:
      this.processedData = computed(() => this.getProcessedData())
      this.processedRootData = computed(() =>
        this.getProcessedRootData(this.rootData)
      )
      // Set up data right away, so that edits never land before its computed
      // values, whose watchers run after rendering:
      watch(
        [getSchema, getData],
        ([schema, data], [, previousData] = []) => {
          this.initializeData(schema, data)
          this.writeComputedValues()
          // Data that is replaced, e.g. loaded or applied, isn't edited:
          if (data !== previousData) {
            this.markClean()
          }
        },
        { immediate: true, flush: 'sync' }
      )
      watch(
        () => this.dataEntries.value.recordedEntries,
        entries => this.updateComponentRecords(entries),
        modelSetupWatchOptions
      )
      // Values that go missing later, e.g. in added items, get defaults too:
      watch(
        () => this.dataEntries.value.entriesWithMissingValues,
        entries => this.setDefaultValues(entries),
        modelSetupWatchOptions
      )
    })
  }

  get dataPath() {
    return this.component.dataPath ?? ''
  }

  get componentPath() {
    return this.component.componentPath ?? ''
  }

  get rootData() {
    return this.component.rootData ?? this.getData()
  }

  get isDirty() {
    return [...this.#editedOwners.values()].some(sourceSchema =>
      sourceSchema
        ? hasSubmitButton(getButtonSchemas(sourceSchema.buttons))
        : this.canSave()
    )
  }

  get isEdited() {
    return this.#editedOwners.size > 0
  }

  markEdited() {
    this.#editedOwners.set('', null)
  }

  markClean(dataPath = null) {
    if (dataPath) {
      this.#editedOwners.delete(dataPath)
    } else {
      this.#editedOwners.clear()
    }
  }

  mergeFromServer(data) {
    const mergedData = mergeData(this.getSchema(), this.getData(), data, {
      component: this.component,
      shouldKeepSourcesWithResource: true
    })
    this.writeComputedValues()
    this.markClean()
    return mergedData
  }

  // Write the computed values of the current data right away, also of records
  // that the update of the data entries hasn't created yet.
  writeComputedValues() {
    this.updateComponentRecords(this.dataEntries.value.recordedEntries)
    for (const record of this.componentRecords.values()) {
      record.writeComputedValue?.()
    }
  }

  set(data, key, value) {
    // Writes that don't change the value aren't edits, and keep its identity:
    if (!equals(data[key], value)) {
      this.markEdited()
      data[key] = value
    }
  }

  // Merge `item`, e.g. the draft of a nested form, into `data[key]` in place.
  merge(data, key, item, sourceSchema) {
    if (!equals(data[key], item)) {
      this.markEdited()
      // Merge it as the value of its source, e.g. with tree item children:
      data[key] = mergeData(
        { components: { [key]: sourceSchema } },
        { [key]: data[key] },
        { [key]: item },
        { component: this.component, shouldMatchUids: true }
      )[key]
    }
  }

  insert(list, index, item) {
    this.changeList(list, () => list.splice(index, 0, item))
  }

  remove(list, index) {
    this.changeList(list, () => list.splice(index, 1))
  }

  move(list, from, to) {
    this.changeList(list, () => list.splice(to, 0, ...list.splice(from, 1)))
  }

  replaceChildren(list, items) {
    this.changeList(list, () => list.splice(0, list.length, ...items))
  }

  // Number the items from the order of the first one, which keeps the offset
  // of loaded pages. The edit belongs to the nearest source with its own
  // resource that holds the list or is it, e.g. a tree whose children change.
  changeList(list, change) {
    const { listEntry, sourceEntry } = this.getListEntries(list)
    const schema = listEntry?.schema
    const isNumbered = !!schema && hasItemsNumberedByOrderKey(schema)
    const offset = isNumbered ? (list[0]?.[schema.orderKey] ?? 0) : 0
    change()
    if (isNumbered) {
      updateOrder(schema, list, offset)
    }
    if (sourceEntry) {
      this.#editedOwners.set(sourceEntry.dataPath, sourceEntry.schema)
    } else {
      this.markEdited()
    }
  }

  getListEntries(list) {
    const schema = this.getSchema()
    const data = this.getData()
    const sourceEntries = []
    let listEntry = null
    let sourceEntry = null
    if (data && !isEmptySchema(schema)) {
      processSchemaData(schema, data, {
        dataPath: this.dataPath,
        before: entry => {
          if (isSourceWithResource(entry.schema)) {
            sourceEntries.push(entry)
          }
          if (toRaw(entry.data[entry.name]) === toRaw(list)) {
            listEntry = entry
            sourceEntry = sourceEntries.at(-1) ?? null
          }
        },
        after: entry => {
          if (isSourceWithResource(entry.schema)) {
            sourceEntries.pop()
          }
        },
        options: { component: this.component, rootData: this.rootData }
      })
    }
    return { listEntry, sourceEntry }
  }

  // Unlike data paths, the data that holds a value stays when items move.
  #getFieldKey(dataPath) {
    const path = parseDataPath(getRelativeDataPath(dataPath, this.dataPath))
    const name = path.pop()
    return { data: getValueAtDataPath(this.getData(), path, () => null), name }
  }

  getErrors(dataPath) {
    const { data, name } = this.#getFieldKey(dataPath)
    const entry = this.#errors.value.get({ data, name })
    return entry ? getCurrentErrors(entry, data[name]) : null
  }

  // The errors of the field itself, e.g. of options that failed to load:
  getFieldErrors(dataPath) {
    return this.#fieldErrors.value.get(this.#getFieldKey(dataPath)) ?? null
  }

  setErrors(dataPath, errors) {
    this.#setErrors(this.#getFieldKey(dataPath), 'validation', errors)
  }

  addError(dataPath, message) {
    const key = this.#getFieldKey(dataPath)
    const messages = this.#fieldErrors.value.get(key) ?? []
    if (!messages.includes(message)) {
      this.#fieldErrors.value.set(key, [...messages, message])
      triggerRef(this.#fieldErrors)
    }
  }

  removeError(dataPath, message) {
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

  // Return the errors that no field displays, or `null`.
  replaceErrors(errors, { dataPath = this.dataPath, server = false } = {}) {
    const unmatchedErrors = { ...errors }
    this.#processFieldEntries(dataPath, entry => {
      const fieldErrors = errors[entry.dataPath] ?? null
      this.#setErrors(
        this.#getFieldKey(entry.dataPath),
        server ? 'server' : 'validation',
        fieldErrors
      )
      if (fieldErrors) {
        delete unmatchedErrors[entry.dataPath]
      }
    })
    return isEmpty(unmatchedErrors) ? null : unmatchedErrors
  }

  // The errors of the fields stay until their sources remove them.
  clearErrors(dataPath = this.dataPath) {
    this.#processFieldEntries(dataPath, entry => {
      if (this.#errors.value.delete(this.#getFieldKey(entry.dataPath))) {
        triggerRef(this.#errors)
      }
    })
  }

  getErrorDataPaths(dataPath = this.dataPath) {
    const dataPaths = []
    this.#processFieldEntries(dataPath, entry => {
      if (
        this.getErrors(entry.dataPath) ||
        this.getFieldErrors(entry.dataPath)
      ) {
        dataPaths.push(entry.dataPath)
      }
    })
    return dataPaths
  }

  // Returns whether `data` or the data nested in it hold fields with errors,
  // also where they aren't displayed, e.g. in the items of nested forms.
  hasErrorsWithin(data) {
    if (isPlainObject(data) || isArray(data)) {
      for (const [name, entry] of this.#errors.value.entriesOf(data)) {
        if (getCurrentErrors(entry, data[name])) {
          return true
        }
      }
      if (this.#fieldErrors.value.hasEntriesOf(data)) {
        return true
      }
      return Object.values(data).some(value => this.hasErrorsWithin(value))
    }
    return false
  }

  // Copy the errors of the originals of `data` and of the data nested in it,
  // e.g. from the parent's model to the draft of a nested form.
  copyErrors(model, data) {
    const copy = data => {
      if (isPlainObject(data) || isArray(data)) {
        const original = getOriginal(data)
        for (const [name, entry] of model.#errors.value.entriesOf(original)) {
          this.#errors.value.set({ data, name }, entry)
        }
        Object.values(data).forEach(copy)
      }
    }
    copy(data)
    triggerRef(this.#errors)
  }

  // The errors of a value replace the ones of other values.
  #setErrors(key, kind, errors) {
    const { data, name } = key
    let entry = this.#errors.value.get(key)
    if (!entry || !equals(data[name], entry.value)) {
      // Copy the value, as lists and objects also change in place:
      entry = { value: clone(data[name]), validation: [], server: [] }
    }
    entry = { ...entry, [kind]: errors ?? [] }
    if (entry.validation.length > 0 || entry.server.length > 0) {
      this.#errors.value.set(key, entry)
      triggerRef(this.#errors)
    } else if (this.#errors.value.delete(key)) {
      triggerRef(this.#errors)
    }
  }

  #processFieldEntries(dataPath, handleEntry) {
    const schema = this.getSchema()
    const data = this.getData()
    const isWithin = entry => (
      getRelativeDataPath(entry.dataPath, dataPath) !== null
    )
    if (data && !isEmptySchema(schema)) {
      processSchemaData(schema, data, {
        dataPath: this.dataPath,
        componentPath: this.componentPath,
        // Walk the components within `dataPath`, and the ones that contain it:
        shouldProcess: entry => (
          (
            isWithin(entry) ||
            getRelativeDataPath(dataPath, entry.dataPath) !== null
          ) &&
          this.shouldRenderEntry(entry)
        ),
        shouldSkipSourcesWithResource: true,
        before: entry => {
          if (isWithin(entry)) {
            handleEntry(entry)
          }
        },
        options: { component: this.component, rootData: this.rootData }
      })
    }
  }

  stop() {
    this.rootScope.stop()
    this.componentRecords.clear()
    this.pendingLoads.clear()
    this.#untimedLoads.clear()
    this.pendingWrites.clear()
  }

  writePendingValues() {
    for (const write of this.pendingWrites) {
      write()
    }
  }

  get hasPendingLoads() {
    return this.pendingLoads.size > 0
  }

  // Loads that never finish would block `submit()` forever, so we give up
  // after `timeout`, as the server validates the data anyway. Loads that can't
  // time out, e.g. uploads, are waited for first.
  async waitUntilSettled({ timeout = settleTimeout } = {}) {
    while (this.#untimedLoads.size > 0) {
      await Promise.all(this.#untimedLoads)
    }
    let timeoutId = null
    const timedOut = new Promise(resolve => {
      timeoutId = setTimeout(() => resolve(true), timeout)
    })
    const settled = (async () => {
      while (this.hasPendingLoads) {
        await Promise.all(this.pendingLoads)
        await nextTick()
      }
      return false
    })()
    try {
      const hasTimedOut = await Promise.race([settled, timedOut])
      if (hasTimedOut) {
        console.warn(
          `The data model didn't settle within ${timeout}ms, as ` +
          `${this.pendingLoads.size} loads of data schemas or options are ` +
          `still pending. Continuing without them.`
        )
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  trackPendingLoad(promise, { canTimeOut = true } = {}) {
    this.pendingLoads.add(promise)
    if (!canTimeOut) {
      this.#untimedLoads.add(promise)
    }
    promise.finally(() => {
      this.pendingLoads.delete(promise)
      this.#untimedLoads.delete(promise)
    })
  }

  initializeData(schema, data) {
    if (data && !isEmptySchema(schema)) {
      initializeData(schema, data, this.component, {
        dataPath: this.dataPath,
        rootData: this.rootData,
        shouldSkipSourcesWithResource: true,
        // The model writes the values of components with `compute()`,
        // including their defaults:
        shouldSetDefaultsOfComponentsWithCompute: false
      })
    }
  }

  getProcessedData(data = this.getData(), rootData = this.rootData) {
    const schema = this.getSchema()
    return data && !isEmptySchema(schema)
      ? processData(schema, this.component.sourceSchema, data, this.dataPath, {
          component: this.component.mainSchemaComponent ?? this.component,
          rootData,
          target: 'server'
        })
      : null
  }

  // Process `rootData` in the model that holds the root: its own cached root
  // data, or the root of a nested form with the draft in place of the item, see
  // `createDraftRoot()`.
  getProcessedRootData(rootData) {
    const parentModel = this.dataPath
      ? this.component.parentComponent?.dataModel
      : null
    return parentModel
      ? parentModel.getProcessedRootData(rootData)
      : rootData === this.rootData
        ? this.processedData.value
        : this.getProcessedData(rootData, rootData)
  }

  getDataEntries() {
    const schema = this.getSchema()
    const data = this.getData()
    const recordedEntries = new EntryMap()
    const entriesWithMissingValues = []
    if (data && !isEmptySchema(schema)) {
      processSchemaData(schema, data, {
        dataPath: this.dataPath,
        componentPath: this.componentPath,
        shouldProcess: entry => this.shouldRenderEntry(entry),
        shouldSkipSourcesWithResource: true,
        before: entry => {
          if (hasComputedValueSource(entry.schema) || entry.schema.options) {
            recordedEntries.set(entry, entry)
          }
          if (this.shouldSetDefaultValue(entry)) {
            entriesWithMissingValues.push(entry)
          }
        },
        options: { component: this.component, rootData: this.rootData }
      })
    }
    return { recordedEntries, entriesWithMissingValues }
  }

  // An `if` that fails only affects its own component, which counts as shown.
  shouldRenderEntry(entry) {
    if (entry.schema.if === undefined) {
      return true
    }
    try {
      return getSchemaValue('if', {
        type: Boolean,
        schema: entry.schema,
        context: this.createEntryContext(entry),
        default: true
      })
    } catch (error) {
      console.error(error)
      return true
    }
  }

  shouldSetDefaultValue(entry) {
    const { schema, data, name } = entry
    return shouldSetDefaultValue(
      schema,
      data,
      name,
      () => this.createEntryContext(entry),
      { shouldSetDefaultsOfComponentsWithCompute: false }
    )
  }

  setDefaultValues(entries) {
    for (const entry of entries) {
      if (this.shouldSetDefaultValue(entry)) {
        const { schema, data, name } = entry
        setDefaultValue(schema, data, name, () =>
          this.createEntryContext(entry)
        )
      }
    }
  }

  updateComponentRecords(entries) {
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
      record.dataPath.value = entry.dataPath
      // Add the record first, as its watchers may read its options right away:
      this.componentRecords.set(entry, record)
      if (hasComputedValueSource(entry.schema)) {
        record.computedValueScope ??= this.createComputedValueScope(record)
      }
    }
    for (const { computedValueScope } of previousRecords.values()) {
      computedValueScope?.stop()
    }
  }

  getComponentRecord(entry) {
    let record = this.componentRecords.get(entry)
    if (!record) {
      record = createComponentRecord(entry)
      this.componentRecords.set(entry, record)
    }
    return record
  }

  // Records stop being current before their scope is stopped, as watchers
  // outside of components run in the order in which they're triggered.
  createComputedValueScope(record) {
    const { schema } = record.entry
    const scope = this.rootScope.run(() => effectScope())
    scope.run(() => {
      const isRecordCurrent = computed(() =>
        this.isRecordCurrent(record, schema)
      )
      const dataSchemaResolver = schema.compute
        ? null
        : this.createDataSchemaResolver(schema, record)
      // Return a new object each time, so that the value is also written when
      // only the value in the data changed, e.g. through user input:
      const currentResult = computed(() =>
        !isRecordCurrent.value
          ? null
          : schema.compute
            ? this.getComputedValueResult(record)
            : dataSchemaResolver.isLoading
              ? null
              : { value: dataSchemaResolver.value }
      )
      const write = result => {
        if (result) {
          this.writeComputedValue(record.entry, result.value)
        }
      }
      record.writeComputedValue = () => write(currentResult.value)
      watch(currentResult, write, modelWatchOptions)
      record.writeComputedValue()
    })
    return scope
  }

  isRecordCurrent(record, schema) {
    const currentEntry = this.dataEntries.value.recordedEntries.get(
      record.entry
    )
    return currentEntry?.schema === schema
  }

  // Return `null` while `compute()` reads options that aren't loaded yet, to
  // keep the current value until they are.
  getComputedValueResult(record) {
    const { entry } = record
    const { schema, data, name } = entry
    try {
      const value = computeValue(
        schema,
        data,
        name,
        // Read the data path through the record, so that only computes that
        // read their position run again when their items move:
        () => record.dataPath.value,
        {
          component: this.component.mainSchemaComponent ?? this.component,
          rootData: this.rootData,
          getOptions: schema.options ? () => this.getLoadedOptions(entry) : null
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
  getLoadedOptions(entry) {
    const resolver = this.getOptionsResolver(entry)
    if (resolver.isLoading) {
      throw optionsNotLoaded
    }
    return resolver.value
  }

  // Computes and components share the resolver, so they get the same options.
  getOptionsResolver(entry) {
    const record = this.getComponentRecord(entry)
    const { options } = entry.schema
    if (!record.optionsResolver || record.optionsSchema !== options) {
      record.optionsSchema = options
      record.optionsResolver = this.createDataSchemaResolver(options, record)
    }
    return record.optionsResolver
  }

  createDataSchemaResolver(dataSchema, record) {
    return new DataSchemaResolver(dataSchema, {
      createContext: () => this.createEntryContext(record.entry),
      onLoadStart: promise => this.trackPendingLoad(promise)
    })
  }

  writeComputedValue(entry, computedValue) {
    const { data, name } = entry
    const value = this.getValueWithNestedDefaultValues(entry, computedValue)
    const dataPath = getRelativeDataPath(entry.dataPath, this.dataPath)
    if (!equals(value, data[name]) && !this.isWriteLoop(dataPath)) {
      // Write `data[name]` directly, without calling `parse()`:
      data[name] = value
    }
  }

  // Add the defaults that `setDefaultValues()` would add once it's written, or
  // the two keep replacing each other's writes. We copy only what holds missing
  // values, as the value may be shared, e.g. a constant.
  getValueWithNestedDefaultValues(entry, value) {
    const { data, name } = entry
    if (
      !isPlainObject(value) && !isArray(value) ||
      // The current value gets its defaults from `setDefaultValues()`:
      toRaw(value) === toRaw(data[name])
    ) {
      return value
    }
    const dataWithMissingValues = new Set()
    this.processNestedEntries(entry, value, nestedEntry => {
      if (this.shouldSetDefaultValue(nestedEntry)) {
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
    this.processNestedEntries(entry, valueWithDefaults, nestedEntry => {
      if (this.shouldSetDefaultValue(nestedEntry)) {
        setDefaultValue(
          nestedEntry.schema,
          nestedEntry.data,
          nestedEntry.name,
          () => this.createEntryContext(nestedEntry)
        )
      }
    })
    return valueWithDefaults
  }

  processNestedEntries(entry, value, handleNestedEntry) {
    const { schema, data, name, dataPath } = entry
    const valueData = { ...data, [name]: value }
    processSchemaData({ components: { [name]: schema } }, valueData, {
      dataPath: getParentDataPath(dataPath),
      shouldProcess: nestedEntry => this.shouldRenderEntry(nestedEntry),
      shouldSkipSourcesWithResource: true,
      before: nestedEntry => {
        if (nestedEntry.data !== valueData) {
          handleNestedEntry(nestedEntry)
        }
      },
      options: { component: this.component, rootData: this.rootData }
    })
  }

  // Sources of a value may keep disagreeing on it, e.g. two computes, so we
  // report it once instead of letting the writes loop endlessly.
  isWriteLoop(dataPath) {
    if (!this.computedValueWriteCounts) {
      this.computedValueWriteCounts = new Map()
      queueMicrotask(() => {
        this.computedValueWriteCounts = null
      })
    }
    const count = (this.computedValueWriteCounts.get(dataPath) ?? 0) + 1
    this.computedValueWriteCounts.set(dataPath, count)
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

  // The component that owns the data stays, so options don't load again.
  createEntryContext({ schema, data, name, dataPath }) {
    return DitoContext.createForSchema(this.component, {
      schema,
      name,
      data,
      dataPath,
      rootData: this.rootData
    })
  }
}

// Copy the objects and arrays that are or hold one of `objects` shallowly, at
// each occurrence, so that defaults set in copies never reach the originals.
function copyContainersHolding(value, objects, ancestorValues = new Set()) {
  if (
    !isPlainObject(value) && !isArray(value) ||
    ancestorValues.has(value)
  ) {
    return value
  }
  ancestorValues.add(value)
  const copyValue = () => (isArray(value) ? [...value] : { ...value })
  let copy = objects.has(value) ? copyValue() : null
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
const modelSetupWatchOptions = { immediate: true, flush: 'pre' }

// Write derived values after mounting, or the `mounted` hooks of `v-model`
// restore the values that inputs had then (vuejs/core#15774):
const modelWatchOptions = { flush: 'post' }

const optionsNotLoaded = Symbol('optionsNotLoaded')

const maxComputedValueWrites = 10

const settleTimeout = 30_000

function createComponentRecord(entry) {
  return {
    entry,
    // Reactive, as items that move keep their records:
    dataPath: shallowRef(entry.dataPath),
    computedValueScope: null,
    writeComputedValue: null,
    optionsResolver: null,
    optionsSchema: null
  }
}

// Compare data by its raw object, as it may come through reactive proxies.
class WeakEntryMap {
  valuesByData = new WeakMap()

  get({ data, name }) {
    return this.valuesByData.get(toRaw(data))?.get(name)
  }

  set({ data, name }, value) {
    const rawData = toRaw(data)
    let valuesByName = this.valuesByData.get(rawData)
    if (!valuesByName) {
      valuesByName = new Map()
      this.valuesByData.set(rawData, valuesByName)
    }
    valuesByName.set(name, value)
  }

  delete({ data, name }) {
    const rawData = toRaw(data)
    const valuesByName = this.valuesByData.get(rawData)
    const isDeleted = !!valuesByName?.delete(name)
    if (isDeleted && valuesByName.size === 0) {
      this.valuesByData.delete(rawData)
    }
    return isDeleted
  }

  hasEntriesOf(data) {
    return this.valuesByData.has(toRaw(data))
  }

  entriesOf(data) {
    return this.valuesByData.get(toRaw(data))?.entries() ?? []
  }
}

// Entry maps can be iterated and cleared, but keep their data alive.
class EntryMap extends WeakEntryMap {
  valuesByData = new Map()

  clear() {
    this.valuesByData.clear()
  }

  *values() {
    for (const valuesByName of this.valuesByData.values()) {
      yield* valuesByName.values()
    }
  }
}

function hasComputedValueSource(schema) {
  return !!schema.compute || hasValueFromDataSchema(schema)
}

// Errors apply only to the value that they were set for, as values also
// change through direct writes, e.g. of `change` handlers.
function getCurrentErrors(entry, value) {
  return equals(value, entry.value)
    ? [...entry.validation, ...entry.server]
    : null
}
