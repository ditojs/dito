import {
  effectScope,
  computed,
  watch,
  nextTick,
  shallowRef,
  toRaw
} from 'vue'
import {
  isArray,
  isPlainObject,
  equals,
  clone,
  parseDataPath,
  getValueAtDataPath
} from '@ditojs/utils'
import DitoContext from '../DitoContext.js'
import { DataSchemaResolver } from './DataSchemaResolver.js'
import {
  appendDataPath,
  getParentDataPath,
  getRelativeDataPath
} from './data.js'
import { isNested } from './schema/structure.js'
import { isEmptySchema } from './schema/lookup.js'
import {
  getSchemaValue,
  shouldSetDefaultValue,
  setDefaultValue,
  initializeData,
  computeValue,
  hasValueFromDataSchema,
  processSchemaData,
  processData
} from './schema/data.js'

// DataModel holds the state of the data edited by a form, view or dialog that
// is derived from schema and data, independently of what is rendered:
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
//   pending, for a limited time, see `waitUntilSettled()`.
// - The data is dirty when its processed data differs from a snapshot taken
//   when the data was set up, saved or applied, see `isDirty`. The values that
//   the model derives until it settled, e.g. from loaded options, don't count,
//   see `takeProcessedDataSnapshot()`. Only forms track this, by passing
//   `getSourceSchema()`, see the constructor.
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
  // The promises of the loads of data schemas and options that are pending,
  // see `waitUntilSettled()`:
  pendingLoads = new Set()
  // The data that the snapshot was taken of, and its processed data to compare
  // with in `isDirty`, see `takeProcessedDataSnapshot()`:
  processedDataSnapshot = shallowRef(null)
  // The data paths of the values that the model writes while it settles after
  // the snapshot is taken, which `isDirty` takes from the current data, `null`
  // once it settled, see `takeProcessedDataSnapshot()`:
  derivedValueDataPaths = null
  // The sets of data paths of the values that the model writes while clean
  // changes settle, one per pending `applyCleanChanges()`:
  cleanChangesDerivedValueDataPaths = new Set()
  // The number of writes of computed values per data path in the current
  // microtask, see `isWriteLoop()`:
  computedValueWriteCounts = null

  // `getSchema()` and `getData()` return the schema and the data that the
  // model handles. `getSourceSchema()` returns the schema of the source that
  // the data is an item of, as needed by `processData()`. Only forms pass it,
  // to track whether their data is dirty, see `isDirty`.
  constructor({ component, getSchema, getData, getSourceSchema = null }) {
    this.component = component
    this.getSchema = getSchema
    this.getData = getData
    this.getSourceSchema = getSourceSchema
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
      if (getSourceSchema) {
        // Data that is set up, e.g. loaded, saved or applied, isn't dirty:
        // After the data is set up, see `modelSetupWatchOptions`.
        watch(
          getData,
          () => this.takeProcessedDataSnapshot().catch(console.error),
          modelWatchOptions
        )
      }
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

  // Returns whether the processed data differs from the snapshot taken when
  // the data was set up, saved or applied, see `takeProcessedDataSnapshot()`.
  // Excluded values don't count, unless their components have `process()`,
  // see `processData()`, and neither do the values that the model derives
  // until it settled.
  get isDirty() {
    const processedDataSnapshot = this.processedDataSnapshot.value
    const data = this.getData()
    // A snapshot only applies to the data that it was taken of. Data that was
    // replaced since isn't dirty until its own snapshot is taken, and neither
    // is missing data.
    if (!data || processedDataSnapshot?.data !== data) {
      return false
    }
    const processedData = this.getProcessedDataForDirtyCheck()
    const processedDataToCompare = this.derivedValueDataPaths
      ? takeOverValuesAtDataPaths(
          processedDataSnapshot.processedData,
          processedData,
          this.derivedValueDataPaths
        )
      : processedDataSnapshot.processedData
    return !equals(processedData, processedDataToCompare)
  }

  stop() {
    this.rootScope.stop()
    this.componentRecords.clear()
    this.pendingLoads.clear()
  }

  // Whether loads of data schemas or options are pending, see
  // `waitUntilSettled()`.
  get hasPendingLoads() {
    return this.pendingLoads.size > 0
  }

  // Waits for the pending loads of data schemas and options, including the
  // ones that they cause, e.g. options that depend on computed values that
  // depend on loaded options, and for the watchers to write the resulting
  // computed values into the data.
  // Loads that never finish, e.g. hung requests, would block callers like
  // `submit()` forever. After `timeout` milliseconds, the wait gives up with a
  // warning and resolves, as the server validates the data anyway, while the
  // loads keep running. `timeout: null` waits as long as it takes, for the
  // model's own bookkeeping, which nothing waits for.
  async waitUntilSettled({ timeout = settleTimeout } = {}) {
    let timeoutId = null
    const timedOut =
      timeout != null
        ? new Promise(resolve => {
            timeoutId = setTimeout(() => resolve(true), timeout)
          })
        : null
    const settled = (async () => {
      while (this.hasPendingLoads) {
        await Promise.all(this.pendingLoads)
        await nextTick()
      }
      return false
    })()
    try {
      const hasTimedOut = await (
        timedOut
          ? Promise.race([settled, timedOut])
          : settled
      )
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

  // Takes the snapshot of the processed data that `isDirty` compares with,
  // when the data is set up, saved or applied. Until the model settled, i.e.
  // the pending loads finished and the computed values that depend on them are
  // written into the data, see `waitUntilSettled()`, the values that the
  // model writes are recorded in `derivedValueDataPaths` and don't count, as
  // they're derived from the data, e.g. from loaded options. Once settled, they
  // are taken over into the snapshot, so that changes made in the meantime,
  // e.g. by the user, count right away. Values that the model derives from
  // these changes while it settles are taken over too, so reverting the
  // changes afterwards leaves the data dirty, which only asks for confirmation
  // unnecessarily.
  async takeProcessedDataSnapshot() {
    const data = this.getData()
    const derivedValueDataPaths = data ? new Set() : null
    this.derivedValueDataPaths = derivedValueDataPaths
    this.processedDataSnapshot.value = data
      ? { data, processedData: clone(this.getProcessedDataForDirtyCheck()) }
      : null
    if (!data) {
      return
    }
    // Let the watchers and the rendering start their loads first:
    await nextTick()
    await this.waitUntilSettled({ timeout: null })
    // Snapshots that were taken since settle by themselves.
    const isSnapshotReplaced = (
      this.derivedValueDataPaths !==
      derivedValueDataPaths
    )
    // Check whether the model stopped first, as its component may be gone.
    const isModelStopped = !this.rootScope.active
    if (isSnapshotReplaced || isModelStopped) {
      return
    }
    this.derivedValueDataPaths = null
    const processedDataSnapshot = this.processedDataSnapshot.value
    if (processedDataSnapshot?.data === this.getData()) {
      this.processedDataSnapshot.value = {
        data,
        processedData: takeOverValuesAtDataPaths(
          processedDataSnapshot.processedData,
          this.getProcessedDataForDirtyCheck(),
          derivedValueDataPaths
        )
      }
    }
  }

  // Returns the processed data that `isDirty` compares with
  // `processedDataSnapshot`, and that the snapshot is taken of. The data is
  // processed like for the clipboard, not for the server, which gives
  // references to new items random prefixes each time, see
  // `SchemaGraph.getReferencePrefix()`.
  getProcessedDataForDirtyCheck() {
    const schema = this.getSchema()
    const data = this.getData()
    return data && !isEmptySchema(schema)
      ? processData(schema, this.getSourceSchema(), data, this.dataPath, {
          // Like `getComputedValueResult()`:
          component: this.component.mainSchemaComponent ?? this.component,
          rootData: this.rootData,
          schemaOnly: true,
          target: 'clipboard',
          // Reading the dirty state doesn't call `process()`, see
          // `processData()`:
          shouldCallProcess: false
        })
      : null
  }

  // Makes clean changes to the data, which don't make it dirty, while other
  // changes still do, e.g. to apply what an action on the server already
  // saved: The values that `makeChanges()` changes in the processed data are
  // compared right after it is called synchronously, so that changes made
  // while the model settles, e.g. by the user, aren't included. Once the model
  // settled, they are taken over into the snapshot, along with the values that
  // the model writes in the meantime, e.g. derived from the changes. Like in
  // `takeProcessedDataSnapshot()`, these include the values derived from
  // other changes. Arrays whose length changes are taken over as a whole, see
  // `takeOverChangedValues()`.
  async applyCleanChanges(makeChanges) {
    const data = this.getData()
    const hasSnapshotOfData = this.processedDataSnapshot.value?.data === data
    // Clone the processed data, as it shares nested values with the data,
    // which `makeChanges()` may change in place.
    const processedDataBeforeChanges = hasSnapshotOfData
      ? clone(this.getProcessedDataForDirtyCheck())
      : null
    makeChanges()
    if (hasSnapshotOfData) {
      const processedDataAfterChanges = clone(
        this.getProcessedDataForDirtyCheck()
      )
      const derivedValueDataPaths = new Set()
      this.cleanChangesDerivedValueDataPaths.add(derivedValueDataPaths)
      try {
        // Let the watchers write the values derived from the changes first:
        await nextTick()
        await this.waitUntilSettled({ timeout: null })
      } finally {
        this.cleanChangesDerivedValueDataPaths.delete(derivedValueDataPaths)
      }
      // Take the changes over into the current snapshot of the data, which may
      // have been replaced in the meantime, e.g. once the model settled.
      const processedDataSnapshot = this.processedDataSnapshot.value
      if (processedDataSnapshot?.data === data && this.rootScope.active) {
        this.processedDataSnapshot.value = {
          data,
          processedData: takeOverValuesAtDataPaths(
            takeOverChangedValues(
              processedDataSnapshot.processedData,
              processedDataBeforeChanges,
              processedDataAfterChanges
            ),
            this.getProcessedDataForDirtyCheck(),
            derivedValueDataPaths
          )
        }
      }
    }
  }

  // Records the data path of a computed value that the model writes, as
  // derived while it settles, see `takeProcessedDataSnapshot()` and
  // `applyCleanChanges()`. Defaults don't need to be recorded, as the processed
  // data holds the defaults of missing values already, see `processData()`.
  recordDerivedValueDataPath(dataPath) {
    this.derivedValueDataPaths?.add(dataPath)
    for (const dataPaths of this.cleanChangesDerivedValueDataPaths) {
      dataPaths.add(dataPath)
    }
  }

  // Tracks the promise of a pending load until it settles, so that
  // `waitUntilSettled()` waits for it.
  trackPendingLoad(promise) {
    this.pendingLoads.add(promise)
    promise.finally(() => this.pendingLoads.delete(promise))
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
  // values of items that move aren't computed again. Records stop being
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
              ? this.getComputedValueResult(record.entry)
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

  // Returns whether the model computes the value of the component with the
  // data and name of the entry, i.e. whether its walk of the data visits the
  // component.
  hasComputedValueEntry(entry) {
    const currentEntry = this.dataEntries.value.recordedEntries.get(entry)
    return !!currentEntry && hasComputedValueSource(currentEntry.schema)
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
  getComputedValueResult(entry) {
    const { schema, data, name, dataPath } = entry
    try {
      const value = computeValue(schema, data, name, dataPath, {
        component: this.component.mainSchemaComponent ?? this.component,
        rootData: this.rootData,
        getOptions: schema.options ? () => this.getLoadedOptions(entry) : null
      })
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
      // Values written while the model settles are derived, see
      // `takeProcessedDataSnapshot()`:
      this.recordDerivedValueDataPath(dataPath)
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
  // and calls `handleNestedEntry()` before visiting each of them.
  processNestedEntries(entry, value, handleNestedEntry) {
    const { schema, data, name, dataPath } = entry
    const valueData = { ...data, [name]: value }
    processSchemaData({ components: { [name]: schema } }, valueData, {
      dataPath: isNested(schema) ? getParentDataPath(dataPath) : dataPath,
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
  // data, as in its processed data.
  getRelativeDataPath({ schema, name, dataPath }) {
    // The data paths of nested components include their own name.
    const valueDataPath = isNested(schema)
      ? dataPath
      : appendDataPath(dataPath, name)
    return getRelativeDataPath(valueDataPath, this.dataPath)
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

// Returns a copy of `processedData` with the values at `dataPaths` taken over
// from `currentProcessedData`, or removed if they're missing there. Values
// whose parents are missing in `processedData` are left out, as their parents
// differ anyway.
function takeOverValuesAtDataPaths(
  processedData,
  currentProcessedData,
  dataPaths
) {
  if (dataPaths.size === 0) {
    return processedData
  }
  const result = clone(processedData)
  for (const dataPath of dataPaths) {
    const tokens = parseDataPath(dataPath)
    const parentDataPath = tokens.slice(0, -1)
    const key = tokens.at(-1)
    const parent = getValueAtDataPath(result, parentDataPath, () => null)
    if (parent && typeof parent === 'object') {
      const value = getValueAtDataPath(
        currentProcessedData,
        dataPath,
        () => notFound
      )
      if (value === notFound) {
        delete parent[key]
      } else {
        parent[key] = clone(value)
      }
    }
  }
  return result
}

// Returns a copy of `target` with the values that differ between `before` and
// `after` taken over from `after`, comparing objects and arrays of the same
// length entry by entry. Arrays whose length changed are taken over as a whole,
// as their entries can't be matched, including changes of their entries that
// were made before.
function takeOverChangedValues(target, before, after) {
  if (equals(before, after)) {
    return target
  }
  const isSameShape = (
    (
      isPlainObject(before) &&
      isPlainObject(after) &&
      isPlainObject(target)
    ) || (
      isArray(before) &&
      isArray(after) &&
      isArray(target) &&
      before.length === after.length &&
      after.length === target.length
    )
  )
  if (!isSameShape) {
    return clone(after)
  }
  const result = isArray(target) ? [...target] : { ...target }
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (!(key in after)) {
      delete result[key]
    } else {
      result[key] = takeOverChangedValues(target[key], before[key], after[key])
    }
  }
  return result
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

const notFound = Symbol('notFound')

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

// Creates the record of the component of the entry, see
// `DataModel.componentRecords`: its current entry, the scope of the watchers
// that write its computed values, and the resolver of its options, with the
// options schema that it resolves, once they're read.
function createComponentRecord(entry) {
  return {
    entry,
    computedValueScope: null,
    optionsResolver: null,
    optionsSchema: null
  }
}

// Holds values by the data and name of the entries of components, see
// `DataModel.componentRecords`. The data is compared by its raw object, as it
// may be passed through reactive proxies.
class EntryMap {
  valuesByData = new Map()

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
    if (valuesByName?.delete(name) && valuesByName.size === 0) {
      this.valuesByData.delete(rawData)
    }
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
