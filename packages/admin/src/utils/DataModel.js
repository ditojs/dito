import {
  effectScope,
  computed,
  watch,
  nextTick,
  shallowRef,
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
  hasItemsNumberedByOrderKey,
  updateOrder
} from './schema/data.js'

// DataModel holds the state of the data edited by a form, view, dialog or panel
// with its own data that is derived from schema and data, independently of what
// is rendered:
//
// - Missing values are set to their defaults when the data is set up, and when
//   they go missing later, e.g. in items that code adds, except the values of
//   components with `compute()`, which fall back to their defaults when
//   `compute()` doesn't return a value, unlike in new data, see
//   `initializeData()`.
// - The items of lists with `orderKey` are numbered when the data is set up,
//   which doesn't make the data dirty.
// - Computed values, the results of `schema.compute()` and of the data schemas
//   of the `computed` types (`schema.data`, `schema.dataPath`), are written
//   into the data by watchers that the model owns, one scope per component,
//   for all components whose `if` doesn't evaluate to `false`.
// - Options, `schema.options`, are resolved per component when they are first
//   read, by `compute()` through `context.options` or by the component that
//   displays them, see `getOptions()`. Both get the same option objects, and
//   computes that read options only run once they are loaded.
// - Submitting waits for the loads of data schemas and options that are still
//   pending, for a limited time, and for running uploads, see
//   `waitUntilSettled()`.
// - Components write the data through the change API, `set()`, `insert()`,
//   `remove()`, `move()` and `replaceChildren()`, which marks it edited until
//   it's replaced or saved. Edits are dirty if their owner can save them: the
//   component, see `canSave()`, or the nearest source with its own resource
//   that holds the changed list, through a submit button. The model's own
//   writes, e.g. of defaults and computed values, don't mark the data edited,
//   and neither do direct writes.
// - The errors of the fields are kept by the data that holds their values and
//   their names, see `#getFieldKey()`, so that they stay with items that move,
//   and with components that aren't mounted, e.g. in collapsed sections. The
//   errors of values only apply to the value that they were set for, so they
//   hide once it changes, also in place, while the errors of fields stay until
//   their sources remove them.
//
// Sources with their own resource are skipped, as their items are edited
// through their own forms.
//
// The model handles components through their entries, the objects that
// `processSchemaData()` passes to `before()` and `after()`, with the schema,
// data, name, data path and component path of each component. Components that
// read their options pass entries of the same shape, see `getOptions()`.
//
// `component` is the component that owns the data, e.g. `DitoForm`. Its
// `dataPath`, `componentPath`, `rootData` and `mainSchemaComponent` are used
// when present. The model needs to be stopped before the component unmounts.

export class DataModel {
  // The records of the components with computed values or options, by their
  // data and name, so that they're kept when list items move, see
  // `getComponentRecord()`. Records of components that the walk of the data
  // doesn't visit anymore, e.g. of removed items or hidden components, are
  // removed, see `updateComponentRecords()`:
  componentRecords = new EntryMap()
  // The promises of the loads that are pending, e.g. of data schemas, options
  // and uploads, and the ones of them that can't time out, see
  // `waitUntilSettled()`:
  pendingLoads = new Set()
  #untimedLoads = new Set()
  // Whether the data was changed through the change API since it was set up or
  // saved, and the sources with their own resource whose lists were, by their
  // data and name, if they can save them:
  #isEdited = shallowRef(false)
  #dirtySources = shallowRef(new EntryMap())
  // The errors of the fields, see `#getFieldKey()`, by their kind: the ones of
  // `validation` and of the `server` with the `value` that they were set for,
  // and the ones of the `field` itself:
  #errors = shallowRef(new WeakEntryMap())
  // The number of writes of computed values per data path in the current
  // microtask, see `isWriteLoop()`:
  computedValueWriteCounts = null

  // `getSchema()` and `getData()` return the schema and the data that the
  // model handles, `canSave()` whether the component can save its edits.
  constructor({ component, getSchema, getData, canSave = () => true }) {
    this.component = component
    this.getSchema = getSchema
    this.getData = getData
    this.canSave = canSave
    this.rootScope = effectScope(true)
    this.rootScope.run(() => {
      watch(
        [getSchema, getData],
        ([schema, data]) => this.initializeData(schema, data),
        modelSetupWatchOptions
      )
      // The entries are read through a computed property, so that the watchers
      // of the records can check synchronously whether their record is still
      // current, see `createComputedValueScope()`.
      this.dataEntries = computed(() => this.getDataEntries())
      watch(
        () => this.dataEntries.value.recordedEntries,
        entries => this.updateComponentRecords(entries),
        modelSetupWatchOptions
      )
      // Values that go missing after the data was set up, e.g. in items that
      // code adds, get their defaults too:
      watch(
        () => this.dataEntries.value.entriesWithMissingValues,
        entries => this.setDefaultValues(entries),
        modelSetupWatchOptions
      )
      // Data that is replaced, e.g. loaded or applied, isn't dirty:
      watch(getData, () => this.markClean(), { flush: 'sync' })
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

  // Whether the data has edits that its owners can save, see `canSave()`.
  get isDirty() {
    return (
      this.#isEdited.value && this.canSave() ||
      !this.#dirtySources.value.isEmpty
    )
  }

  // Whether the data was edited, also where it can't be saved.
  get isEdited() {
    return this.#isEdited.value || !this.#dirtySources.value.isEmpty
  }

  markDirty() {
    this.#isEdited.value = true
  }

  // Marks all data clean, or only the list of the source with its own resource
  // at `data[name]`, once the source saved it.
  markClean(data, name) {
    if (data) {
      this.#dirtySources.value.delete({ data, name })
      triggerRef(this.#dirtySources)
    } else {
      this.#isEdited.value = false
      this.#dirtySources.value = new EntryMap()
    }
  }

  // Merges `data` from the server, e.g. the response of a save, into the data
  // in place, so that its objects keep their uids, item stores, open forms and
  // errors, and keeps the parts of sources with their own resource, which load
  // them themselves. Returns the merged data, which isn't dirty.
  mergeFromServer(data) {
    const mergedData = mergeData(this.getSchema(), this.getData(), data, {
      component: this.component,
      shouldKeepSourcesWithResource: true
    })
    // Compute the values of the merged data right away, e.g. to convert values
    // that the server stores differently, as their watchers only run once it
    // rendered, see `modelWatchOptions`:
    for (const record of this.componentRecords.values()) {
      const { schema } = record.entry
      if (schema.compute && this.isRecordCurrent(record, schema)) {
        const result = this.getComputedValueResult(record)
        if (result) {
          this.writeComputedValue(record.entry, result.value)
        }
      }
    }
    this.markClean()
    return mergedData
  }

  set(data, key, value) {
    // Writes that don't change the value aren't edits:
    if (!equals(data[key], value)) {
      this.markDirty()
    }
    data[key] = value
  }

  // Merges `item`, a copy that shares the uids of `data[key]`, e.g. the draft
  // of a nested form, into that item in place, along the form of its source
  // with `sourceSchema`, see `cloneWithUids()`.
  merge(data, key, item, sourceSchema) {
    if (!equals(data[key], item)) {
      this.markDirty()
      // Merge the item as the value of its source, so that its form is the
      // same as in the data, e.g. with the children of tree items:
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

  // Changes the list in place and numbers its items again by the order key of
  // its schema, starting at the order of its first item, so that lists loaded
  // from later pages keep their offset. The change belongs to the nearest
  // source with its own resource that holds the list or is it, if any, e.g. a
  // tree whose children change.
  changeList(list, change) {
    const { listEntry, sourceEntry } = this.getListEntries(list)
    const schema = listEntry?.schema
    const isNumbered = !!schema && hasItemsNumberedByOrderKey(schema)
    const offset = isNumbered ? (list[0]?.[schema.orderKey] ?? 0) : 0
    change()
    if (isNumbered) {
      updateOrder(schema, list, offset)
    }
    if (!sourceEntry) {
      this.markDirty()
    } else if (hasSubmitButton(getButtonSchemas(sourceEntry.schema.buttons))) {
      this.#dirtySources.value.set(sourceEntry, true)
      triggerRef(this.#dirtySources)
    }
  }

  // Returns the entry of the component whose value is the list, and the one of
  // the nearest source with its own resource that holds the list or is it, by
  // walking the data, also into sources with their own resource.
  getListEntries(list) {
    const schema = this.getSchema()
    const data = this.getData()
    const sourceEntries = []
    let listEntry = null
    let sourceEntry = null
    if (data && !isEmptySchema(schema)) {
      processSchemaData(schema, data, {
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

  // Returns the key of the field at `dataPath`: the data that holds its value,
  // and its name. Unlike data paths, the data stays the same when list items
  // move. The values of lists of primitives are held by their lists.
  #getFieldKey(dataPath) {
    const path = parseDataPath(getRelativeDataPath(dataPath, this.dataPath))
    const name = path.pop()
    return { data: getValueAtDataPath(this.getData(), path, () => null), name }
  }

  // Returns the errors of the field at `dataPath`, or `null`: the errors of its
  // value, of validation and of the server as `{ message }`, followed by the
  // errors of the field as messages, e.g. of options that failed to load.
  getErrors(dataPath) {
    const { data, name } = this.#getFieldKey(dataPath)
    const entry = this.#errors.value.get({ data, name })
    return entry ? getCurrentErrors(entry, data[name]) : null
  }

  // Sets the validation errors of the value of the field at `dataPath`, see
  // `TypeMixin.validate()`. The errors of the server stay while the value does.
  setErrors(dataPath, errors) {
    this.#setErrors(this.#getFieldKey(dataPath), 'validation', errors)
  }

  // Adds an error of the field at `dataPath` rather than of its value, e.g. of
  // options that failed to load, which stays until its source removes it.
  addError(dataPath, message) {
    const key = this.#getFieldKey(dataPath)
    const errors = this.#errors.value.get(key)?.field ?? []
    if (!errors.includes(message)) {
      this.#setErrors(key, 'field', [...errors, message])
    }
  }

  removeError(dataPath, message) {
    const key = this.#getFieldKey(dataPath)
    const errors = this.#errors.value.get(key)?.field ?? []
    if (errors.includes(message)) {
      this.#setErrors(
        key,
        'field',
        errors.filter(error => error !== message)
      )
    }
  }

  // Replaces the validation errors of the values within `dataPath` with
  // `errors`, or the ones of the server with `server`, keyed by data path, as
  // validation and the server return them, and returns the ones of fields that
  // aren't displayed, or `null`.
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

  // Clears the errors of the values within `dataPath`, e.g. once they're saved.
  // The errors of the fields stay until their sources remove them.
  clearErrors(dataPath = this.dataPath) {
    this.#processFieldEntries(dataPath, entry => {
      const key = this.#getFieldKey(entry.dataPath)
      this.#setErrors(key, 'validation', null)
      this.#setErrors(key, 'server', null)
    })
  }

  // Returns the data paths of the fields within `dataPath` that have errors,
  // in the order of the schema.
  getErrorDataPaths(dataPath = this.dataPath) {
    const dataPaths = []
    this.#processFieldEntries(dataPath, entry => {
      if (this.getErrors(entry.dataPath)) {
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
      return Object.values(data).some(value => this.hasErrorsWithin(value))
    }
    return false
  }

  // Copies the errors of the values of the originals of `data`, a copy made by
  // `cloneWithUids()`, and of the data nested in it, from `model`, e.g. from
  // the parent's model to the draft of a nested form.
  copyErrors(model, data) {
    const copy = data => {
      if (isPlainObject(data) || isArray(data)) {
        const original = getOriginal(data)
        for (const [name, entry] of model.#errors.value.entriesOf(original)) {
          const key = { data, name }
          const field = this.#errors.value.get(key)?.field ?? []
          if (entry.validation.length > 0 || entry.server.length > 0) {
            this.#errors.value.set(key, { ...entry, field })
          }
        }
        Object.values(data).forEach(copy)
      }
    }
    copy(data)
    triggerRef(this.#errors)
  }

  // Sets the errors of the `kind` of the field at `key`, see `#errors`. The
  // errors of a value replace the ones of other values.
  #setErrors(key, kind, errors) {
    const { data, name } = key
    const errorsByField = this.#errors.value
    let entry = errorsByField.get(key) ?? noErrors
    if (kind !== 'field' && !equals(data[name], entry.value)) {
      // Copy the value, as lists and objects also change in place:
      entry = { ...noErrors, field: entry.field, value: clone(data[name]) }
    }
    entry = { ...entry, [kind]: errors ?? [] }
    const { validation, server, field } = entry
    if (validation.length > 0 || server.length > 0 || field.length > 0) {
      errorsByField.set(key, entry)
      triggerRef(this.#errors)
    } else if (errorsByField.delete(key)) {
      triggerRef(this.#errors)
    }
  }

  // Walks the entries of the fields within `dataPath` whose `if` doesn't
  // evaluate to `false`, and calls `handleEntry()` for each.
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
  }

  // Whether loads are pending, see `waitUntilSettled()`.
  get hasPendingLoads() {
    return this.pendingLoads.size > 0
  }

  // Waits for the pending loads, including the ones that they cause, e.g.
  // options that depend on computed values that depend on loaded options, and
  // for the watchers to write the resulting computed values into the data.
  // Loads that never finish, e.g. hung requests, would block callers like
  // `submit()` forever. After `timeout` milliseconds, the wait gives up with a
  // warning and resolves, as the server validates the data anyway, while the
  // loads keep running. Loads that can't time out, e.g. uploads, which take as
  // long as their files need, are waited for first.
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

  // Tracks the promise of a pending load until it settles, so that
  // `waitUntilSettled()` waits for it, also beyond its timeout with
  // `canTimeOut: false`.
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

  // Sets missing values to their defaults and numbers the items of lists by
  // their order key when the data is set up, see `initializeData()`.
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

  // Walks the data and returns the entries of `processSchemaData()` of the
  // components whose `if` doesn't evaluate to `false`: the ones with computed
  // values or options, by data and name, see `componentRecords`, and the ones
  // whose values are missing. Called by a computed property, so that it runs
  // again when the data structure changes, e.g. when list items are added,
  // moved or removed, values go missing, or `if` conditions change.
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

  // Returns whether the `if` of the entry's component doesn't evaluate to
  // `false`. Unlike `shouldRenderSchema()`, it doesn't evaluate the components
  // of sections and tabs, as the walk of the data visits them anyway, see
  // `getDataEntries()`, which leads to the same entries.
  // An `if` that fails only affects its own component, which is treated as
  // shown, not the walk of all others, which would stop computing them.
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

  // Returns whether the value of the entry is missing and needs its default.
  // The model writes the values of components with `compute()`, including
  // their defaults, see `computeValue()`.
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

  // Sets the defaults of the values of the entries, unless they were set in
  // the meantime.
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

  // Keeps the records of the components that are still present, with their
  // current entries, e.g. with the data paths of items that moved, creates
  // records for new ones, and removes the others, stopping their scopes. The
  // scopes of records whose schema changed are replaced.
  updateComponentRecords(entries) {
    const previousRecords = this.componentRecords
    this.componentRecords = new EntryMap()
    for (const entry of entries.values()) {
      const record = previousRecords.get(entry) ?? createComponentRecord(entry)
      previousRecords.delete(entry)
      if (record.entry.schema !== entry.schema) {
        record.computedValueScope?.stop()
        record.computedValueScope = null
      }
      record.entry = entry
      record.dataPath.value = entry.dataPath
      // Add the record before its scope is created, as its watchers may read
      // its options right away, see `getOptionsResolver()`.
      this.componentRecords.set(entry, record)
      if (hasComputedValueSource(entry.schema)) {
        record.computedValueScope ??= this.createComputedValueScope(record)
      }
    }
    for (const { computedValueScope } of previousRecords.values()) {
      computedValueScope?.stop()
    }
  }

  // Returns the record of the component of the entry, see `componentRecords`,
  // and creates it if the walk of the data didn't, e.g. for components that
  // read their options before it visits them.
  getComponentRecord(entry) {
    let record = this.componentRecords.get(entry)
    if (!record) {
      record = createComponentRecord(entry)
      this.componentRecords.set(entry, record)
    }
    return record
  }

  // Creates the scope of the watchers that write the computed values of the
  // record's component into the data, with its current entry, so that the
  // values of items that move are only computed again if their computes read
  // their position, see `getComputedValueResult()`. Records stop being
  // current before their scope is stopped, as watchers that don't belong to
  // components run in the order in which they're triggered, e.g. when list
  // items are removed or `if` conditions change. The watchers skip these
  // records, see `isRecordCurrent()`.
  createComputedValueScope(record) {
    const { schema } = record.entry
    const scope = this.rootScope.run(() => effectScope())
    scope.run(() => {
      const isRecordCurrent = computed(() =>
        this.isRecordCurrent(record, schema)
      )
      if (schema.compute) {
        watch(
          // Return a new object each time, so that the value is also written
          // when only the value in the data changed, e.g. through user input.
          () =>
            isRecordCurrent.value
              ? this.getComputedValueResult(record)
              : null,
          computedResult => {
            if (computedResult) {
              this.writeComputedValue(record.entry, computedResult.value)
            }
          },
          modelWatchOptions
        )
      }
      if (hasValueFromDataSchema(schema)) {
        const dataSchemaResolver = this.createDataSchemaResolver(schema, record)
        watch(
          () =>
            isRecordCurrent.value && !dataSchemaResolver.isLoading
              ? { value: dataSchemaResolver.value }
              : null,
          resolved => {
            if (resolved) {
              this.writeComputedValue(record.entry, resolved.value)
            }
          },
          modelWatchOptions
        )
      }
    })
    return scope
  }

  // Returns whether the record's component is still one of the current
  // entries, with the same schema, see `getDataEntries()`.
  isRecordCurrent(record, schema) {
    const currentEntry = this.dataEntries.value.recordedEntries.get(
      record.entry
    )
    return currentEntry?.schema === schema
  }

  // Calls `schema.compute()` with the main schema component of the data, like
  // `processData()`, and with the options resolved by the model, so that the
  // result doesn't depend on whether the component is rendered. Returns the
  // value as `{ value }`, or `null` if `compute()` reads options that aren't
  // loaded, which aborts it, so that the current value is kept until they are
  // and `compute()` can rely on them. The watcher that calls it depends on the
  // options through reading them, and calls it again once they're loaded.
  // Computes the value of the record's component. Its data path is read
  // through the record, so that only computes that read their position are
  // computed again when their items move, see `updateComponentRecords()`.
  getComputedValueResult(record) {
    const { entry } = record
    const { schema, data, name } = entry
    try {
      const value = computeValue(
        schema,
        data,
        name,
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

  // Returns the options of the component of the entry, or aborts the
  // `compute()` that reads them, while they're loading, see
  // `getComputedValueResult()`. Options that resolve to `undefined` aren't
  // loading, e.g. when their load failed, which logs the error, or when their
  // data path points to a missing value: `compute()` sees them as `undefined`,
  // and falls back on `options?.…` like components do, see `OptionsMixin`.
  getLoadedOptions(entry) {
    const resolver = this.getOptionsResolver(entry)
    if (resolver.isLoading) {
      throw optionsNotLoaded
    }
    return resolver.value
  }

  // Returns the options of the component of the entry, resolved from
  // `schema.options` when they're first read, `undefined` while loading, see
  // `getLoadedOptions()`.
  getOptions(entry) {
    return this.getOptionsResolver(entry).value
  }

  // Returns the resolver of the options of the component of the entry, shared
  // by all callers with the same data, name and options, so that computes and
  // the component that displays the options get the same option objects, and
  // the options only load once, also when list items move. Components that
  // keep displaying options of records that were removed keep their own
  // resolvers, see `OptionsMixin`.
  getOptionsResolver(entry) {
    const record = this.getComponentRecord(entry)
    const { options } = entry.schema
    if (!record.optionsResolver || record.optionsSchema !== options) {
      record.optionsSchema = options
      record.optionsResolver = this.createDataSchemaResolver(options, record)
    }
    return record.optionsResolver
  }

  // Creates the resolver of a data schema of the record's component, with the
  // context of its current entry.
  createDataSchemaResolver(dataSchema, record) {
    return new DataSchemaResolver(dataSchema, {
      createContext: () => this.createEntryContext(record.entry),
      onLoadStart: promise => this.trackPendingLoad(promise)
    })
  }

  // Writes the computed value into the data, with the defaults of its nested
  // values, unless it equals the value in the data.
  writeComputedValue(entry, computedValue) {
    const { data, name } = entry
    const value = this.getValueWithNestedDefaultValues(entry, computedValue)
    if (!equals(value, data[name])) {
      const dataPath = this.getRelativeDataPath(entry)
      if (this.isWriteLoop(dataPath)) {
        return
      }
      // Access `data[name]` directly to update the value without calling
      // `parse()`, see `ValueMixin`:
      data[name] = value
    }
  }

  // Returns the computed value of the entry with the missing defaults of its
  // nested values, e.g. of the items that `compute()` returns, as
  // `setDefaultValues()` would set them once the value is written. Otherwise,
  // the two would disagree on the value and keep replacing each other's
  // writes. The value isn't modified, as it may be shared, e.g. a constant:
  // The objects and arrays that hold missing values are copied, along with the
  // ones that hold these, and the value is returned as it is when nothing is
  // missing, keeping its identity, e.g. of options.
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

  // Walks the entries nested in `value`, as the value of the entry's
  // component, in place of its current one in a copy of the data that holds it,
  // and calls `handleNestedEntry()` before visiting each of them. The entry is
  // one of the recorded entries, which are all of nested components, see
  // `getRelativeDataPath()`.
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

  // Returns whether the computed value at the data path was written too often
  // in the current microtask, which happens when the sources of the value keep
  // disagreeing on it, e.g. two computes. Reports the data path once, instead
  // of letting the writes loop endlessly.
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

  // Returns the data path of the value of the entry, relative to the model's
  // data, as in its processed data. The entry is one of the recorded entries,
  // which are all of nested components, as `processSchemaData()` only calls
  // `before()` for these, and walks the components of unnested ones instead.
  // Their data paths include their own name, except for the ones of wrapped
  // primitives, whose values are the items themselves.
  getRelativeDataPath({ dataPath }) {
    return getRelativeDataPath(dataPath, this.dataPath)
  }

  // Returns the context for `if`, data schemas and options, with the component
  // that owns the data, which stays the same when components are mounted, so
  // that data schemas and options don't load again.
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

// Returns `value` with the plain objects and arrays in it that are one of
// `objects` or hold one of them copied, shallowly, and the others as they are.
// Values that occur more than once are copied at each occurrence, so that
// setting defaults in the copies never reaches the originals. Only the values
// that hold themselves, `ancestorValues`, are left as they are.
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

// The watchers of the model that set up the data and the scopes of its
// components run before the components render, so that components of new
// data, e.g. loaded data or added items, receive their defaults and computed
// values from the start: The scopes compute their values right away, see
// `createComputedValueScope()`.
const modelSetupWatchOptions = { immediate: true, flush: 'pre' }

// The other watchers of the model run after the post-flush hooks, so that they
// write the values that they derive from the data after the components that
// display them are mounted. Otherwise, the `mounted` hooks of `v-model`
// directives would restore the values that inputs had when they were mounted,
// see https://github.com/vuejs/core/issues/15774. Vue processes the updates
// that the written values cause in the same flush, before the browser renders
// them.
const modelWatchOptions = { immediate: true, flush: 'post' }

// Aborts `compute()` when it reads options that aren't loaded, see
// `DataModel.getComputedValueResult()`.
const optionsNotLoaded = Symbol('optionsNotLoaded')

// The number of writes of a computed value in one microtask after which they
// are considered a loop, see `DataModel.isWriteLoop()`.
const maxComputedValueWrites = 10

// The milliseconds after which `DataModel.waitUntilSettled()` stops waiting
// for pending loads, long enough for slow requests.
const settleTimeout = 30_000

// The errors of a field without any, see `DataModel.#errors`:
const noErrors = { value: undefined, validation: [], server: [], field: [] }

// Creates the record of the component of the entry, see
// `DataModel.componentRecords`: its current entry, the scope of the watchers
// that write its computed values, and the resolver of its options, with the
// options schema that it resolves, once they're read.
function createComponentRecord(entry) {
  return {
    entry,
    // The data path of the entry, read by computes, see
    // `getComputedValueResult()`. Unlike `entry`, it's reactive, as items
    // that move keep their records.
    dataPath: shallowRef(entry.dataPath),
    computedValueScope: null,
    optionsResolver: null,
    optionsSchema: null
  }
}

// Holds values by the data and name of the entries of components. The data is
// compared by its raw object, as it may be passed through reactive proxies.
// Weak entry maps don't keep replaced data alive.
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

  // Returns whether there was a value to delete.
  delete({ data, name }) {
    const rawData = toRaw(data)
    const valuesByName = this.valuesByData.get(rawData)
    const isDeleted = !!valuesByName?.delete(name)
    if (isDeleted && valuesByName.size === 0) {
      this.valuesByData.delete(rawData)
    }
    return isDeleted
  }

  // Returns the names and values held for `data`.
  entriesOf(data) {
    return this.valuesByData.get(toRaw(data))?.entries() ?? []
  }
}

// Entry maps can be iterated and cleared, but keep their data alive.
class EntryMap extends WeakEntryMap {
  valuesByData = new Map()

  get isEmpty() {
    return this.valuesByData.size === 0
  }

  clear() {
    this.valuesByData.clear()
  }

  *values() {
    for (const valuesByName of this.valuesByData.values()) {
      yield* valuesByName.values()
    }
  }
}

// Returns whether the schema is a source of computed values, through
// `schema.compute()` or a data schema of the `computed` types.
function hasComputedValueSource(schema) {
  return !!schema.compute || hasValueFromDataSchema(schema)
}

// Returns the errors of the field with the errors `entry` and the value
// `value`, or `null`: the ones of the value only while it's the value that they
// were set for, as values also change through direct writes, e.g. of `change`
// handlers.
function getCurrentErrors(entry, value) {
  const errors = equals(value, entry.value)
    ? [...entry.validation, ...entry.server, ...entry.field]
    : entry.field
  return errors.length > 0 ? errors : null
}
